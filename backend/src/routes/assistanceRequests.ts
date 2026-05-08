import { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';
import { Itinerary, AssistanceRequest } from '@fast-travel/shared';
import { requireAdminAuth } from '../middleware/requireAdminAuth';
import { tripCache, generateTripSlug } from '../utils/tripCache';

const requests: AssistanceRequest[] = [];

export const assistanceRequestRoutes: FastifyPluginAsync = async (app) => {
  // POST /assistance-requests  — public, called by the user app
  app.post<{ Body: Itinerary }>('/assistance-requests', async (req, reply) => {
    const itinerary = req.body;
    if (!itinerary?.origin || !Array.isArray(itinerary.legs)) {
      return reply.status(400).send({ error: 'Invalid itinerary' });
    }

    const tripSlug = generateTripSlug(itinerary);
    tripCache.set(tripSlug, itinerary);

    const request: AssistanceRequest = {
      id: crypto.randomUUID(),
      itinerary,
      tripSlug,
      requestedAt: new Date().toISOString(),
    };

    requests.push(request);
    return reply.status(201).send({ id: request.id, tripSlug });
  });

  // GET /assistance-requests  — admin only, newest first
  app.get('/assistance-requests', { preHandler: requireAdminAuth }, async (_req, reply) => {
    return reply.send([...requests].reverse());
  });
};
