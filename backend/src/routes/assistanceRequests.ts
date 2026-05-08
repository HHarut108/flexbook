import { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';
import { TripLeg } from '@fast-travel/shared';
import { requireAdminAuth } from '../middleware/requireAdminAuth';
import { tripCache } from '../utils/tripCache';

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
  totalPrice: number; // computed server-side from legs
}

const requests: AssistanceRequest[] = [];

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
  app.post('/assistance-requests', async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';

    if (!fullName || !email || !phone) {
      return reply.status(400).send({ error: 'fullName, email, and phone are required.' });
    }

    const rawTripData = (body.tripData ?? {}) as Record<string, unknown>;
    const legs = Array.isArray(rawTripData.legs) ? (rawTripData.legs as TripLeg[]) : [];
    const origin = typeof rawTripData.origin === 'string' ? rawTripData.origin : undefined;
    const cities = Array.isArray(rawTripData.cities) ? (rawTripData.cities as string[]) : [];

    // Compute total server-side from actual leg prices — ignores any client-sent totalPrice
    const totalPrice = legs.reduce((sum, l) => sum + (l.priceUsd ?? 0), 0);

    // Generate a share slug so the admin can open the trip as the user would see it.
    // We store a minimal Itinerary so GET /trips/:slug resolves the link.
    const tripSlug = makeSlug(origin, legs);
    tripCache.set(tripSlug, {
      origin: {
        iata: legs[0]?.originIata ?? '',
        name: origin ?? '',
        city: { id: '', name: origin ?? '', countryCode: '', countryName: '', lat: 0, lng: 0 },
        timezone: '',
      },
      legs,
      status: 'planning',
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

    requests.push(request);
    app.log.info(`Assistance request: ${request.id} from ${email}`);

    return reply.status(201).send({ id: request.id, tripSlug });
  });

  // Admin-only — retrieve all submitted requests, newest first
  app.get('/assistance-requests', { preHandler: requireAdminAuth }, async (_req, reply) => {
    return reply.send({ requests: [...requests].reverse() });
  });
};
