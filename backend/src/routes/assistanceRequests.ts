import { FastifyPluginAsync } from 'fastify';
import NodeCache from 'node-cache';
import { requireAdminAuth } from '../middleware/requireAdminAuth';

const cache = new NodeCache({ stdTTL: 0 }); // no expiry — requests persist until server restart
let counter = 0;

interface TripData {
  origin?: string;
  cities: string[];
  totalPrice: number;
  legs: unknown[];
}

interface AssistanceRequest {
  id: string;
  createdAt: string;
  fullName: string;
  email: string;
  phone: string;
  tripData: TripData;
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

    const id = `req_${Date.now()}_${++counter}`;
    const request: AssistanceRequest = {
      id,
      createdAt: new Date().toISOString(),
      fullName,
      email,
      phone,
      tripData: (body.tripData ?? { origin: undefined, cities: [], totalPrice: 0, legs: [] }) as TripData,
    };

    cache.set(id, request);
    app.log.info(`Assistance request received: ${id} from ${email}`);

    return reply.status(201).send({ id });
  });

  // Admin-only — retrieve all submitted requests
  app.get('/assistance-requests', { preHandler: requireAdminAuth }, async (_req, reply) => {
    const keys = cache.keys();
    const requests = keys
      .map((k) => cache.get<AssistanceRequest>(k))
      .filter((r): r is AssistanceRequest => r !== undefined);

    requests.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return reply.send({ requests });
  });
};
