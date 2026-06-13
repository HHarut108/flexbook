import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { FlightOption } from '@fast-travel/shared';
import { flightService } from '../services/FlightService';
import { ok, fail } from '../utils/response';
import { resolveLocation, isCityMarker, CITY_AIRPORT_CAP } from '../utils/resolveLocation';
import { airportService } from '../services/AirportService';
import { SerpApiRateLimitError, SerpApiUnavailableError, SerpApiResponseError } from '../providers/SerpApiFlightProvider';
import { RapidApiRateLimitError, RapidApiAuthError, RapidApiUnavailableError } from '../providers/RapidApiKiwiFlightProvider';
import { FlightProviderConfigError } from '../services/FlightService';

/** Collapse multiple flights with the same landing airport down to the
 *  cheapest. Used after fan-out across a city origin so the result list
 *  doesn't grow N× when N origin airports all serve the same destination. */
function dedupeByDestinationKeepCheapest(flights: FlightOption[]): FlightOption[] {
  const cheapest = new Map<string, FlightOption>();
  for (const f of flights) {
    const existing = cheapest.get(f.destinationIata);
    if (!existing || f.priceUsd < existing.priceUsd) cheapest.set(f.destinationIata, f);
  }
  return [...cheapest.values()].sort((a, b) => a.priceUsd - b.priceUsd);
}

/** A location marker is either a 3-letter IATA (e.g. "FCO") or "@<city_id>"
 *  (e.g. "@rome_it") that resolves to all member airports. Validated at the
 *  route layer; resolution to IATAs happens via resolveLocation(). */
const LOCATION_MARKER = /^([A-Z]{3}|@[a-z0-9_]+)$/;

/** Coerce loose query-string casing into the canonical marker form:
 *  IATAs → upper, city ids → lower with leading @. */
function normalizeMarker(raw: string): string {
  return raw.startsWith('@') || raw.startsWith('@'.toLowerCase())
    ? '@' + raw.slice(1).toLowerCase()
    : raw.toUpperCase();
}

const searchQuerySchema = z.object({
  originIata: z.string().min(1).max(40).transform(normalizeMarker).refine((v) => LOCATION_MARKER.test(v), 'originIata must be a 3-letter IATA or @city_id'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  destination: z.string().min(1).max(40).transform(normalizeMarker).refine((v) => LOCATION_MARKER.test(v), 'destination must be a 3-letter IATA or @city_id').optional(),
  deduplicate: z.coerce.boolean().default(true),
  sort: z.enum(['price', 'duration', 'quality']).default('price'),
  maxStopovers: z.coerce.number().int().min(0).max(2).optional(),
  currency: z.string().length(3).toUpperCase().default('USD'),
  cabinClass: z.enum(['M', 'W', 'C', 'F']).optional(),
  passengers: z.coerce.number().int().min(1).max(9).default(1),
  apiMode: z.enum(['real', 'mock']).optional(),
  fresh: z.coerce.boolean().default(false),
  country: z.string().length(2).toUpperCase().optional(),
  /** When true and `originIata` is a bare IATA belonging to a multi-airport
   *  city (e.g. BVA → Paris), expand the search to all peer airports in that
   *  metro (capped at CITY_AIRPORT_CAP). Trip Builder sets this for mid-trip
   *  hops and the return leg, where users typically don't care which
   *  airport they depart from on day 3 of a Paris stay. The initial origin
   *  airport stays single — that's the user's deliberate pick. No-op when
   *  the marker is already a `@city_id` (already expanded) or the IATA's
   *  city has only one commercial airport. */
  expandMetro: z.coerce.boolean().default(false),
});

/**
 * Multi-city legs encoded as a single query param:
 *   legs=FROM1,TO1,YYYY-MM-DD|FROM2,TO2,YYYY-MM-DD|…
 * FROM/TO are location markers (IATA or @city_id), same wire format the FE
 * already produces. Older URLs with pure IATAs continue to validate.
 */
const LEG_SEGMENT = /^(@?[A-Za-z0-9_]+),(@?[A-Za-z0-9_]+),(\d{4}-\d{2}-\d{2})$/;

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
  originIata: z.string().min(1).max(40).transform(normalizeMarker).refine((v) => LOCATION_MARKER.test(v), 'originIata must be a 3-letter IATA or @city_id'),
  destinationIata: z.string().min(1).max(40).transform(normalizeMarker).refine((v) => LOCATION_MARKER.test(v), 'destinationIata must be a 3-letter IATA or @city_id'),
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

    const { originIata, date, destination, deduplicate, sort, maxStopovers, currency, cabinClass, passengers, apiMode, fresh, country, expandMetro } = parsed.data;

    let originIatas = resolveLocation(originIata);
    if (originIatas.length === 0) {
      return reply.status(400).send(fail('INVALID_PARAMS', `Unknown origin city marker: ${originIata}`));
    }
    // expandMetro: bare arrival IATA → all peer airports of its metro. Skipped
    // when the caller already passed a `@city_id` (resolveLocation handled it)
    // or when the airport is the only commercial field in its city.
    if (expandMetro && !isCityMarker(originIata)) {
      const metro = airportService.cityByIata(originIata);
      if (metro) originIatas = metro.airports.slice(0, CITY_AIRPORT_CAP);
    }
    const destinationIatas = destination ? resolveLocation(destination) : undefined;
    if (destination && (!destinationIatas || destinationIatas.length === 0)) {
      return reply.status(400).send(fail('INVALID_PARAMS', `Unknown destination city marker: ${destination}`));
    }

    try {
      const result = await flightService.searchOneWayFanOut(
        originIatas, date, destinationIatas,
        { sort, maxStopovers, currency, cabinClass, passengers, country },
        apiMode,
        fresh,
      );
      // Re-apply destination dedup once across the merged fan-out result.
      // Per-task dedup was disabled inside searchOneWayFanOut so we don't
      // lose cheaper options to the same airport from a different origin.
      // Skip when destination is locked: every result lands at the same IATA,
      // so dedup would collapse 30+ itineraries down to a single row.
      const shouldDedupe = deduplicate && !destination;
      const flights = shouldDedupe ? dedupeByDestinationKeepCheapest(result.flights) : result.flights;
      return ok({ origin: originIata, date, cacheStatus: result.cacheStatus, results: flights });
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
      if (err instanceof FlightProviderConfigError) {
        app.log.error(err, 'No flight provider configured');
        return reply.status(503).send(fail('FLIGHT_API_NOT_CONFIGURED', 'Flight search is not configured. Please contact support.', false));
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

    // Don't upper-case before splitting — @city_id markers are lower-case.
    const matched = legsRaw.split('|').map((seg) => seg.match(LEG_SEGMENT));
    if (matched.some((m) => !m)) {
      return reply.status(400).send(fail('INVALID_PARAMS', 'legs must be FROM,TO,YYYY-MM-DD segments joined by | (FROM/TO may be 3-letter IATA or @city_id)'));
    }
    const parsedLegs = matched.map((m) => ({
      originMarker: normalizeMarker(m![1]),
      destinationMarker: normalizeMarker(m![2]),
      date: m![3],
    }));
    if (parsedLegs.length < 2) {
      return reply.status(400).send(fail('INVALID_PARAMS', 'multi-city requires at least 2 legs'));
    }
    if (parsedLegs.length > 6) {
      return reply.status(400).send(fail('INVALID_PARAMS', 'multi-city supports at most 6 legs'));
    }

    // Resolve each leg's origin/destination markers into IATA arrays. A
    // single airport selection yields a 1-element array; a city marker
    // expands to ≤4 member airports (capped in resolveLocation).
    const resolvedLegs: { originIatas: string[]; destinationIatas: string[]; date: string }[] = [];
    for (const leg of parsedLegs) {
      const originIatas = resolveLocation(leg.originMarker);
      const destinationIatas = resolveLocation(leg.destinationMarker);
      if (originIatas.length === 0 || destinationIatas.length === 0) {
        return reply.status(400).send(
          fail('INVALID_PARAMS', `Unknown city marker in leg: ${leg.originMarker} → ${leg.destinationMarker}`),
        );
      }
      resolvedLegs.push({ originIatas, destinationIatas, date: leg.date });
    }

    try {
      const { trips } = await flightService.searchMultiCity(
        resolvedLegs,
        { currency, cabinClass, passengers, maxStopovers, limit },
        apiMode,
      );
      // Preserve the marker form in the echo so the FE can round-trip the
      // request (URL state ↔ API call) without losing city-pick identity.
      const echoLegs = parsedLegs.map((l) => ({
        originIata: l.originMarker,
        destinationIata: l.destinationMarker,
        date: l.date,
      }));
      return ok({ legs: echoLegs, trips });
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
    const originIatas = resolveLocation(originIata);
    const destinationIatas = resolveLocation(destinationIata);
    if (originIatas.length === 0 || destinationIatas.length === 0) {
      return reply.status(400).send(
        fail('INVALID_PARAMS', `Unknown city marker: ${originIatas.length === 0 ? originIata : destinationIata}`),
      );
    }
    try {
      const { pairs } = await flightService.searchRoundTripFanOut(
        originIatas,
        destinationIatas,
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
