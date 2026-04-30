import { FastifyPluginAsync } from 'fastify';
import NodeCache from 'node-cache';
import crypto from 'crypto';
import { Itinerary } from '@fast-travel/shared';

const cache = new NodeCache({ stdTTL: 2592000 }); // 30 days

function generateSlug(itinerary: Itinerary): string {
  const origin = itinerary.origin.iata.toLowerCase();
  const outboundLegs = itinerary.legs.filter((l) => !l.isReturn);
  const dests = outboundLegs.map((l) => l.destinationIata.toLowerCase()).join('-');
  const firstLeg = itinerary.legs[0];
  const date = firstLeg
    ? new Date(firstLeg.departureDatetime)
        .toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        .toLowerCase()
        .replace(' ', '')   // "jun25"
        .replace(',', '')
    : '';
  const suffix = crypto.randomBytes(3).toString('base64url').slice(0, 4);
  return [origin, dests, date, suffix].filter(Boolean).join('-');
}

export const tripRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: Itinerary }>('/trips', async (req, reply) => {
    const itinerary = req.body;
    if (!itinerary?.origin || !Array.isArray(itinerary.legs)) {
      return reply.status(400).send({ error: 'Invalid itinerary' });
    }
    const id = generateSlug(itinerary);
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
