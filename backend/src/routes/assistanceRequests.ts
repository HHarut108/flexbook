import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { TripLeg } from '@fast-travel/shared';
import { requireAdminAuth } from '../middleware/requireAdminAuth';
import { tripCache } from '../utils/tripCache';
import { redis, recordRedisOk, recordRedisError } from '../utils/redisClient';

interface TripData {
  origin?: string;
  cities: string[];
  legs: TripLeg[];
}

interface AssistanceRequest {
  id: string;
  createdAt: string;
  fullName: string;
  email: string;
  phone: string;
  tripData: TripData;
  tripSlug: string;
  totalPrice: number;
}

const tripLegSchema = z.object({
  originIata: z.string().length(3),
  destinationIata: z.string().length(3),
  departureDatetime: z.string().min(1),
  priceUsd: z.number().nonnegative().optional(),
  isReturn: z.boolean().optional(),
}).passthrough();

const submitSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().min(5).max(40),
  tripData: z.object({
    origin: z.string().max(120).optional(),
    cities: z.array(z.string().max(120)).max(50).default([]),
    legs: z.array(tripLegSchema).min(1).max(50),
  }),
});

const REDIS_LIST_KEY = 'assistance:requests';
const memRequests: AssistanceRequest[] = [];

async function saveRequest(req: AssistanceRequest): Promise<void> {
  if (redis) {
    try {
      await redis.lpush(REDIS_LIST_KEY, JSON.stringify(req));
      recordRedisOk();
      return;
    } catch (err) {
      recordRedisError(err);
    }
  }
  memRequests.unshift(req); // newest first
}

async function loadRequests(): Promise<AssistanceRequest[]> {
  if (redis) {
    try {
      const raw = await redis.lrange<string>(REDIS_LIST_KEY, 0, -1);
      recordRedisOk();
      return raw.map((item) => {
        try {
          return typeof item === 'string' ? JSON.parse(item) : item;
        } catch {
          return item as unknown as AssistanceRequest;
        }
      });
    } catch (err) {
      recordRedisError(err);
    }
  }
  return [...memRequests];
}

function makeSlug(origin: string | undefined, legs: TripLeg[]): string {
  const o = (origin ?? 'x').toLowerCase().replace(/\s+/g, '').slice(0, 6);
  const dests = legs
    .filter((l) => !l.isReturn)
    .map((l) => l.destinationIata?.toLowerCase() ?? '')
    .filter(Boolean)
    .join('-');
  const firstLeg = legs[0];
  const date = firstLeg
    ? new Date(firstLeg.departureDatetime)
        .toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        .toLowerCase()
        .replace(/[\s,]/g, '')
    : '';
  const suffix = crypto.randomBytes(3).toString('base64url').slice(0, 4);
  return [o, dests, date, suffix].filter(Boolean).join('-');
}

export const assistanceRequestRoutes: FastifyPluginAsync = async (app) => {
  // Public — anyone with a trip plan can submit a request
  app.post('/assistance-requests', {
    config: {
      rateLimit: { max: 5, timeWindow: '1 minute' },
    },
  }, async (req, reply) => {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path.join('.') ?? 'body';
      return reply.status(400).send({ error: `${field}: ${issue?.message ?? 'Invalid request'}` });
    }

    const { fullName, email, phone, tripData } = parsed.data;
    const legs = tripData.legs as unknown as TripLeg[];
    const origin = tripData.origin;
    const cities = tripData.cities;

    // Compute total server-side from actual leg prices
    const totalPrice = legs.reduce((sum, l) => sum + (l.priceUsd ?? 0), 0);

    // Generate share slug and store minimal itinerary so /trips/:slug resolves.
    // status: 'complete' so the share link opens the itinerary view (not the decision screen).
    const tripSlug = makeSlug(origin, legs);
    await tripCache.set(tripSlug, {
      origin: {
        iata: legs[0]?.originIata ?? '',
        name: origin ?? '',
        city: { id: '', name: origin ?? '', countryCode: '', countryName: '', lat: 0, lng: 0 },
        timezone: '',
      },
      legs,
      status: 'complete',
      createdAt: new Date().toISOString(),
      passengers: 1,
    });

    const request: AssistanceRequest = {
      id: `req_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      createdAt: new Date().toISOString(),
      fullName,
      email,
      phone,
      tripData: { origin, cities, legs },
      tripSlug,
      totalPrice,
    };

    await saveRequest(request);
    app.log.info(`Assistance request: ${request.id} from ${email}`);

    return reply.status(201).send({ id: request.id, tripSlug });
  });

  // Admin-only — retrieve all submitted requests, newest first
  app.get('/assistance-requests', { preHandler: requireAdminAuth }, async (_req, reply) => {
    const requests = await loadRequests();
    return reply.send({ requests });
  });
};
