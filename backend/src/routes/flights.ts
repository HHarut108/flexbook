import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { flightService } from '../services/FlightService';
import { airportService } from '../services/AirportService';
import { ok, fail } from '../utils/response';
import { KiwiRateLimitError, KiwiUnavailableError } from '../providers/KiwiFlightProvider';
import { SerpApiRateLimitError, SerpApiUnavailableError, SerpApiResponseError } from '../providers/SerpApiFlightProvider';
import { RapidApiRateLimitError, RapidApiAuthError, RapidApiUnavailableError } from '../providers/RapidApiKiwiFlightProvider';

const searchQuerySchema = z.object({
  originIata: z.string().length(3).toUpperCase(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  destination: z.string().length(3).toUpperCase().optional(),
  deduplicate: z.coerce.boolean().default(true),
  limit: z.coerce.number().int().min(1).max(10).default(10),
  sort: z.enum(['price', 'duration', 'quality']).default('price'),
  maxStopovers: z.coerce.number().int().min(0).max(2).optional(),
  currency: z.string().length(3).toUpperCase().default('USD'),
  cabinClass: z.enum(['M', 'W', 'C', 'F']).optional(),
  passengers: z.coerce.number().int().min(1).max(9).default(1),
  apiMode: z.enum(['real', 'mock']).optional(),
});

export async function flightRoutes(app: FastifyInstance) {
  app.get('/flights/search', async (request, reply) => {
    const parsed = searchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(fail('INVALID_PARAMS', parsed.error.issues[0]?.message ?? 'Invalid params'));
    }

    const { originIata, date, destination, deduplicate, limit, sort, maxStopovers, currency, cabinClass, passengers, apiMode } = parsed.data;

    const origin = airportService.getByIata(originIata);
    const originCity = origin?.city.name ?? originIata;

    try {
      const flights = await flightService.search(
        originIata, originCity, date, destination, deduplicate, limit,
        { sort, maxStopovers, currency, cabinClass, passengers },
        apiMode,
      );
      return ok(flights);
    } catch (err) {
      if (err instanceof KiwiRateLimitError) {
        const headers: Record<string, string> = { 'Retry-After': String(err.retryAfter ?? 60) };
        return reply.status(429).headers(headers).send(
          fail('RATE_LIMITED', 'Too many requests to the flight API. Please wait a moment and try again.', true),
        );
      }
      if (err instanceof KiwiUnavailableError) {
        app.log.warn(err, 'Kiwi API temporarily unavailable');
        return reply.status(503).send(fail('FLIGHT_API_UNAVAILABLE', 'Flight search is temporarily unavailable. Please try again shortly.', true));
      }
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
        return reply.status(503).send(fail('FLIGHT_API_ERROR', `SerpAPI error — check API key or quota. Detail: ${err.message}`, true));
      }
      if (err instanceof RapidApiRateLimitError) {
        return reply.status(429).headers({ 'Retry-After': '60' }).send(
          fail('RATE_LIMITED', 'RapidAPI rate limit reached. Please wait a moment and try again.', true),
        );
      }
      if (err instanceof RapidApiAuthError) {
        app.log.error(err, 'RapidAPI auth failure — invalid or missing API key');
        return reply.status(503).send(fail('FLIGHT_API_AUTH_ERROR', 'RapidAPI key is invalid or missing. Check RAPIDAPI_KEY env var on Render.', true));
      }
      if (err instanceof RapidApiUnavailableError) {
        app.log.warn(err, 'RapidAPI temporarily unavailable');
        return reply.status(503).send(fail('FLIGHT_API_UNAVAILABLE', 'Flight search is temporarily unavailable. Please try again shortly.', true));
      }
      app.log.error(err, 'Flight search failed');
      return reply.status(502).send(fail('FLIGHT_API_UNAVAILABLE', 'Could not fetch flights. Please try again.', true));
    }
  });
}
