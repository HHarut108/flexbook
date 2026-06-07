import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Itinerary } from '@fast-travel/shared';
import { tripCache, generateTripSlug } from '../utils/tripCache';

// Runtime schema for the POST /trips body. The endpoint is intentionally
// unauthenticated (so no-account share links work), which means the surface
// is exposed to every internet client.
//
// Design note: the schema's job here is type-confusion defense (no nulls
// where strings are expected, no objects where arrays are expected) and
// length defense (capped strings/arrays). It is NOT a business-rule check.
// Real provider data legitimately includes:
//   - empty bookingUrl when Kiwi has no booking edge (see
//     RapidApiKiwiFlightProvider.ts:177)
//   - empty destinationCountry / city.countryCode when the provider lacks
//     country metadata (same file, line 196)
//   - stayDurationDays === 0 on return legs and outbound legs constructed
//     before the user picks a stay length (FlightResultsScreen.tsx:177,
//     ReturnFlightsScreen.tsx:65,82)
// Hard size protection comes from bodyLimit + the per-field .max() caps
// below; oversized-payload defense does not depend on rejecting empties.
//
// Mirrors the Itinerary / TripLeg / Airport types in packages/shared.
const citySchema = z.object({
  id: z.string().max(120),
  name: z.string().max(120),
  countryCode: z.string().max(8),
  countryName: z.string().max(120),
  lat: z.number(),
  lng: z.number(),
});

const airportSchema = z.object({
  iata: z.string().max(8),
  name: z.string().max(200),
  city: citySchema,
  timezone: z.string().max(80),
  distanceKm: z.number().optional(),
});

const weatherSummarySchema = z.object({
  temperatureC: z.number(),
  condition: z.enum(['clear', 'cloudy', 'rain', 'snow', 'storm', 'unknown']),
  isForecast: z.boolean(),
  date: z.string().max(20),
});

const priceInfoSchema = z.object({
  amount: z.number(),
  currency: z.string().max(8),
  provider: z.string().max(40),
  deeplink: z.string().max(2048),
  priceUpdatedAt: z.string().max(40),
  priceStatus: z.enum(['cached', 'live', 'stale']),
});

const tripLegSchema = z.object({
  // FlightOption fields
  flightId: z.string().max(200),
  originIata: z.string().max(8),
  originCity: z.string().max(120),
  destinationIata: z.string().max(8),
  destinationCity: z.string().max(120),
  destinationCountry: z.string().max(120),
  destinationLat: z.number(),
  destinationLng: z.number(),
  departureDatetime: z.string().max(40),
  arrivalDatetime: z.string().max(40),
  durationMinutes: z.number().nonnegative(),
  airlineName: z.string().max(120),
  airlineCode: z.string().max(8).optional(),
  stops: z.number().int().nonnegative(),
  viaIatas: z.array(z.string().max(8)).max(10).optional(),
  viaCoords: z.array(z.object({ lat: z.number(), lng: z.number() })).max(10).optional(),
  priceUsd: z.number().nonnegative(),
  bookingUrl: z.string().max(2048),
  priceInfo: priceInfoSchema.optional(),
  weather: weatherSummarySchema.optional(),
  // TripLeg-specific fields
  stopIndex: z.number().int().nonnegative(),
  stayDurationDays: z.number().int().min(0).max(90),
  nextDepartureDate: z.string().max(40),
  isReturn: z.boolean(),
});

const pickSchema = z.object({
  city: z.string().max(120),
  kind: z.enum(['stay', 'do', 'eat']),
  name: z.string().max(200),
});

const itinerarySchema = z.object({
  origin: airportSchema,
  legs: z.array(tripLegSchema).max(20),
  status: z.enum(['planning', 'complete']),
  createdAt: z.string().max(40),
  completedAt: z.string().max(40).optional(),
  passengers: z.number().int().min(1).max(9),
  picks: z.array(pickSchema).max(60).optional(),
});

// 32KB is generous for an itinerary (typically 1–4 legs ~1–2KB each) while
// keeping a hard ceiling on cache abuse.
const TRIPS_BODY_LIMIT_BYTES = 32 * 1024;

export const tripRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: Itinerary }>(
    '/trips',
    {
      // Per-route body size cap (Fastify default is 1MB) — unauthenticated
      // write endpoint, so cap aggressively.
      bodyLimit: TRIPS_BODY_LIMIT_BYTES,
      // Per-route rate limit, plugged into the global @fastify/rate-limit
      // bucket (keyed by client IP, which is the real client because
      // trustProxy is on — see backend/src/index.ts).
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const parsed = itinerarySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: { message: 'Invalid itinerary', details: parsed.error.flatten() } });
      }
      const itinerary = parsed.data as Itinerary;
      const id = generateTripSlug(itinerary);
      await tripCache.set(id, itinerary);
      return reply.send({ id });
    },
  );

  app.get<{ Params: { id: string } }>('/trips/:id', async (req, reply) => {
    const { id } = req.params;
    const itinerary = await tripCache.get(id);
    if (!itinerary) {
      return reply.status(404).send({ error: 'Trip link has expired or does not exist' });
    }
    return reply.send(itinerary);
  });
};
