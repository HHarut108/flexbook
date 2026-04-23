import { FastifyPluginAsync } from 'fastify';
import NodeCache from 'node-cache';
import crypto from 'crypto';
import { Itinerary } from '@fast-travel/shared';

const cache = new NodeCache({ stdTTL: 86400 }); // 24 hours

export const tripRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: Itinerary }>('/trips', async (req, reply) => {
    const itinerary = req.body;
    if (!itinerary?.origin || !Array.isArray(itinerary.legs)) {
      return reply.status(400).send({ error: 'Invalid itinerary' });
    }
    const id = crypto.randomBytes(6).toString('base64url');
    cache.set(id, itinerary);
    return reply.send({ id });
  });

  app.get<{ Params: { id: string } }>('/trips/:id', async (req, reply) => {
    const { id } = req.params;
    const itinerary = cache.get<Itinerary>(id);
    if (!itinerary) {
      return reply.status(404).send({ error: 'Trip link has expired or does not exist' });
    }
    return reply.send(itinerary);
  });
};
