import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Itinerary } from '@fast-travel/shared';
import { tripCache, generateTripSlug } from '../utils/tripCache';

// Runtime schema for the POST /trips body. The endpoint is intentionally
// unauthenticated (so no-account share links work), which means the surface
// is exposed to every internet client — we must validate every field and
// cap the body size.
//
// Mirrors the Itinerary / TripLeg / Airport types in packages/shared. Keep
// these in sync if the shared types change.
const citySchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  countryCode: z.string().length(2),
  countryName: z.string().min(1).max(120),
  lat: z.number(),
  lng: z.number(),
});

const airportSchema = z.object({
  iata: z.string().length(3),
  name: z.string().min(1).max(200),
  city: citySchema,
  timezone: z.string().max(80),
  distanceKm: z.number().optional(),
});

const weatherSummarySchema = z.object({
  temperatureC: z.number(),
  condition: z.enum(['clear', 'cloudy', 'rain', 'snow', 'storm', 'unknown']),
  isForecast: z.boolean(),
  date: z.string(),
});

const priceInfoSchema = z.object({
  amount: z.number(),
  currency: z.string().max(8),
  provider: z.string().max(40),
  deeplink: z.string().url().max(2048),
  priceUpdatedAt: z.string(),
  priceStatus: z.enum(['cached', 'live', 'stale']),
});

const tripLegSchema = z.object({
  // FlightOption fields
  flightId: z.string().min(1).max(200),
  originIata: z.string().length(3),
  originCity: z.string().min(1).max(120),
  destinationIata: z.string().length(3),
  destinationCity: z.string().min(1).max(120),
  destinationCountry: z.string().min(1).max(120),
  destinationLat: z.number(),
  destinationLng: z.number(),
  departureDatetime: z.string(),
  arrivalDatetime: z.string(),
  durationMinutes: z.number().int().nonnegative(),
  airlineName: z.string().max(120),
  airlineCode: z.string().max(8).optional(),
  stops: z.number().int().nonnegative(),
  viaIatas: z.array(z.string().length(3)).max(10).optional(),
  viaCoords: z.array(z.object({ lat: z.number(), lng: z.number() })).max(10).optional(),
  priceUsd: z.number().nonnegative(),
  bookingUrl: z.string().url().max(2048),
  priceInfo: priceInfoSchema.optional(),
  weather: weatherSummarySchema.optional(),
  // TripLeg-specific fields
  stopIndex: z.number().int().min(1),
  stayDurationDays: z.number().int().min(1).max(90),
  nextDepartureDate: z.string(),
  isReturn: z.boolean(),
});

const itinerarySchema = z.object({
  origin: airportSchema,
  legs: z.array(tripLegSchema).max(20),
  status: z.enum(['planning', 'complete']),
  createdAt: z.string(),
  completedAt: z.string().optional(),
  passengers: z.number().int().min(1).max(9),
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
