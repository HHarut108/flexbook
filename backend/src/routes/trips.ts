import { FastifyPluginAsync } from 'fastify';
import { Itinerary } from '@fast-travel/shared';
import { tripCache, generateTripSlug } from '../utils/tripCache';

export const tripRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: Itinerary }>('/trips', async (req, reply) => {
    const itinerary = req.body;
    if (!itinerary?.origin || !Array.isArray(itinerary.legs)) {
      return reply.status(400).send({ error: 'Invalid itinerary' });
    }
    const id = generateTripSlug(itinerary);
    tripCache.set(id, itinerary);
    return reply.send({ id });
  });

  app.get<{ Params: { id: string } }>('/trips/:id', async (req, reply) => {
    const { id } = req.params;
    const itinerary = tripCache.get<Itinerary>(id);
    if (!itinerary) {
      return reply.status(404).send({ error: 'Trip link has expired or does not exist' });
    }
    return reply.send(itinerary);
  });
};
