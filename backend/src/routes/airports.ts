import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { airportService } from '../services/AirportService';
import { ok, fail } from '../utils/response';

const searchQuerySchema = z.object({
  q: z.string().min(1).max(100),
});

const nearbyQuerySchema = z.object({
  iata: z.string().length(3).toUpperCase(),
});

const nearbyByCoordsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export async function airportRoutes(app: FastifyInstance) {
  app.get('/airports/search', async (request, reply) => {
    const parsed = searchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(fail('INVALID_PARAMS', 'Query param "q" is required'));
    }
    const results = airportService.search(parsed.data.q);
    return ok(results);
  });

  app.get('/airports/nearby', async (request, reply) => {
    const parsed = nearbyQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply
        .status(400)
        .send(fail('INVALID_PARAMS', 'Query param "iata" must be a 3-letter code'));
    }
    const results = airportService.nearby(parsed.data.iata);
    return ok(results);
  });

  // Geolocation-based nearby: /airports/nearby-coords?lat=41.38&lng=2.17
  app.get('/airports/nearby-coords', async (request, reply) => {
    const parsed = nearbyByCoordsSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply
        .status(400)
        .send(fail('INVALID_PARAMS', 'Query params "lat" and "lng" are required numbers'));
    }
    const results = airportService.nearbyByCoords(parsed.data.lat, parsed.data.lng);
    return ok(results);
  });
}
