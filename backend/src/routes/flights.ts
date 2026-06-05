import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { flightService } from '../services/FlightService';
import { airportService } from '../services/AirportService';
import { ok, fail } from '../utils/response';
import { SerpApiRateLimitError, SerpApiUnavailableError, SerpApiResponseError } from '../providers/SerpApiFlightProvider';
import { RapidApiRateLimitError, RapidApiAuthError, RapidApiUnavailableError } from '../providers/RapidApiKiwiFlightProvider';

const searchQuerySchema = z.object({
  originIata: z.string().length(3).toUpperCase(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  destination: z.string().length(3).toUpperCase().optional(),
  deduplicate: z.coerce.boolean().default(true),
  sort: z.enum(['price', 'duration', 'quality']).default('price'),
  maxStopovers: z.coerce.number().int().min(0).max(2).optional(),
  currency: z.string().length(3).toUpperCase().default('USD'),
  cabinClass: z.enum(['M', 'W', 'C', 'F']).optional(),
  passengers: z.coerce.number().int().min(1).max(9).default(1),
  apiMode: z.enum(['real', 'mock']).optional(),
  fresh: z.coerce.boolean().default(false),
  country: z.string().length(2).toUpperCase().optional(),
});

/**
 * Multi-city legs encoded as a single query param:
 *   legs=FROM1,TO1,YYYY-MM-DD|FROM2,TO2,YYYY-MM-DD|…
 * Same wire format the FE already produces for the per-leg one-way fallback,
 * so existing URLs stay valid.
 */
const LEG_SEGMENT = /^([A-Z]{3}),([A-Z]{3}),(\d{4}-\d{2}-\d{2})$/;

const multiCityQuerySchema = z.object({
  legs: z.string().min(1),
  currency: z.string().length(3).toUpperCase().default('USD'),
  cabinClass: z.enum(['M', 'W', 'C', 'F']).optional(),
  passengers: z.coerce.number().int().min(1).max(9).default(1),
  maxStopovers: z.coerce.number().int().min(0).max(2).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
  apiMode: z.enum(['real', 'mock']).optional(),
});

const roundTripQuerySchema = z.object({
  originIata: z.string().length(3).toUpperCase(),
  destinationIata: z.string().length(3).toUpperCase(),
  outboundDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'outboundDate must be YYYY-MM-DD'),
  inboundDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'inboundDate must be YYYY-MM-DD'),
  currency: z.string().length(3).toUpperCase().default('USD'),
  cabinClass: z.enum(['M', 'W', 'C', 'F']).optional(),
  passengers: z.coerce.number().int().min(1).max(9).default(1),
  maxStopovers: z.coerce.number().int().min(0).max(2).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(15),
  apiMode: z.enum(['real', 'mock']).optional(),
}).refine((d) => d.inboundDate >= d.outboundDate, {
  message: 'inboundDate must be on or after outboundDate',
  path: ['inboundDate'],
});

export async function flightRoutes(app: FastifyInstance) {
  app.get('/flights/search', async (request, reply) => {
    const parsed = searchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(fail('INVALID_PARAMS', parsed.error.issues[0]?.message ?? 'Invalid params'));
    }

    const { originIata, date, destination, deduplicate, sort, maxStopovers, currency, cabinClass, passengers, apiMode, fresh, country } = parsed.data;

    const origin = airportService.getByIata(originIata);
    const originCity = origin?.city.name ?? originIata;

    try {
      const result = await flightService.search(
        originIata, originCity, date, destination, deduplicate,
        { sort, maxStopovers, currency, cabinClass, passengers, country },
        apiMode,
        fresh,
      );
      return ok({ origin: originIata, date, cacheStatus: result.cacheStatus, results: result.flights });
    } catch (err) {
      if (err instanceof SerpApiRateLimitError) {
        return reply.status(429).headers({ 'Retry-After': '60' }).send(
          fail('RATE_LIMITED', 'Too many requests to the flight API. Please wait a moment and try again.', true),
        );
      }
      if (err instanceof SerpApiUnavailableError) {
        app.log.warn(err, 'SerpAPI temporarily unavailable');
        return reply.status(503).send(fail('FLIGHT_API_UNAVAILABLE', 'Flight search is temporarily unavailable. Please try again shortly.', true));
      }
      if (err instanceof SerpApiResponseError) {
        app.log.error(err, 'SerpAPI returned an error in response body');
        return reply.status(503).send(fail('FLIGHT_API_ERROR', 'Flight search is temporarily unavailable. Please try again shortly.', true));
      }
      if (err instanceof RapidApiRateLimitError) {
        return reply.status(429).headers({ 'Retry-After': '60' }).send(
          fail('RATE_LIMITED', 'RapidAPI rate limit reached. Please wait a moment and try again.', true),
        );
      }
      if (err instanceof RapidApiAuthError) {
        app.log.error(err, 'RapidAPI auth failure — invalid or missing API key');
        return reply.status(503).send(fail('FLIGHT_API_AUTH_ERROR', 'Flight search is temporarily unavailable. Please try again shortly.', true));
      }
      if (err instanceof RapidApiUnavailableError) {
        app.log.warn(err, 'RapidAPI temporarily unavailable');
        return reply.status(503).send(fail('FLIGHT_API_UNAVAILABLE', 'Flight search is temporarily unavailable. Please try again shortly.', true));
      }
      app.log.error(err, 'Flight search failed');
      return reply.status(502).send(fail('FLIGHT_API_UNAVAILABLE', 'Could not fetch flights. Please try again.', true));
    }
  });

  app.get('/flights/multi-city', async (request, reply) => {
    const parsed = multiCityQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(fail('INVALID_PARAMS', parsed.error.issues[0]?.message ?? 'Invalid params'));
    }
    const { legs: legsRaw, currency, cabinClass, passengers, maxStopovers, limit, apiMode } = parsed.data;

    const legs = legsRaw.split('|').map((seg) => seg.toUpperCase().match(LEG_SEGMENT));
    if (legs.some((m) => !m)) {
      return reply.status(400).send(fail('INVALID_PARAMS', 'legs must be FROM,TO,YYYY-MM-DD segments joined by |'));
    }
    const parsedLegs = legs.map((m) => ({
      originIata: m![1],
      destinationIata: m![2],
      date: m![3],
    }));
    if (parsedLegs.length < 2) {
      return reply.status(400).send(fail('INVALID_PARAMS', 'multi-city requires at least 2 legs'));
    }
    if (parsedLegs.length > 6) {
      return reply.status(400).send(fail('INVALID_PARAMS', 'multi-city supports at most 6 legs'));
    }

    try {
      const { trips } = await flightService.searchMultiCity(
        parsedLegs,
        { currency, cabinClass, passengers, maxStopovers, limit },
        apiMode,
      );
      return ok({ legs: parsedLegs, trips });
    } catch (err) {
      if (err instanceof RapidApiRateLimitError) {
        return reply.status(429).headers({ 'Retry-After': '60' }).send(
          fail('RATE_LIMITED', 'RapidAPI rate limit reached. Please wait a moment and try again.', true),
        );
      }
      if (err instanceof RapidApiAuthError) {
        app.log.error(err, 'RapidAPI auth failure — invalid or missing API key');
        return reply.status(503).send(fail('FLIGHT_API_AUTH_ERROR', 'Flight search is temporarily unavailable. Please try again shortly.', true));
      }
      if (err instanceof RapidApiUnavailableError) {
        app.log.warn(err, 'RapidAPI temporarily unavailable');
        return reply.status(503).send(fail('FLIGHT_API_UNAVAILABLE', 'Flight search is temporarily unavailable. Please try again shortly.', true));
      }
      app.log.error(err, 'Multi-city search failed');
      return reply.status(502).send(fail('FLIGHT_API_UNAVAILABLE', 'Could not fetch multi-city flights. Please try again.', true));
    }
  });

  app.get('/flights/round-trip', async (request, reply) => {
    const parsed = roundTripQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(fail('INVALID_PARAMS', parsed.error.issues[0]?.message ?? 'Invalid params'));
    }
    const { originIata, destinationIata, outboundDate, inboundDate, currency, cabinClass, passengers, maxStopovers, limit, apiMode } = parsed.data;
    try {
      const { pairs } = await flightService.searchRoundTrip(
        originIata,
        destinationIata,
        outboundDate,
        inboundDate,
        { currency, cabinClass, passengers, maxStopovers, limit },
        apiMode,
      );
      return ok({ origin: originIata, destination: destinationIata, outboundDate, inboundDate, pairs });
    } catch (err) {
      if (err instanceof RapidApiRateLimitError) {
        return reply.status(429).headers({ 'Retry-After': '60' }).send(
          fail('RATE_LIMITED', 'RapidAPI rate limit reached. Please wait a moment and try again.', true),
        );
      }
      if (err instanceof RapidApiAuthError) {
        app.log.error(err, 'RapidAPI auth failure — invalid or missing API key');
        return reply.status(503).send(fail('FLIGHT_API_AUTH_ERROR', 'Flight search is temporarily unavailable. Please try again shortly.', true));
      }
      if (err instanceof RapidApiUnavailableError) {
        app.log.warn(err, 'RapidAPI temporarily unavailable');
        return reply.status(503).send(fail('FLIGHT_API_UNAVAILABLE', 'Flight search is temporarily unavailable. Please try again shortly.', true));
      }
      app.log.error(err, 'Round-trip search failed');
      return reply.status(502).send(fail('FLIGHT_API_UNAVAILABLE', 'Could not fetch round-trip flights. Please try again.', true));
    }
  });
}
