import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { airportService } from '../services/AirportService';
import { ok, fail } from '../utils/response';
import { setCacheControl, CACHE_CONTROL } from '../utils/httpCache';

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
  // Returns { results, fallback? }. `fallback` is populated when the typed
  // query didn't match any commercial airport but resolved to a known place
  // via the gazetteer (e.g. "São Carlos" → nearest commercial = VCP/CGH/GRU).
  app.get('/airports/search', async (request, reply) => {
    const parsed = searchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(fail('INVALID_PARAMS', 'Query param "q" is required'));
    }
    const result = airportService.searchWithFallback(parsed.data.q);
    setCacheControl(reply, CACHE_CONTROL.AIRPORTS);
    return ok(result);
  });

  app.get('/airports/nearby', async (request, reply) => {
    const parsed = nearbyQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply
        .status(400)
        .send(fail('INVALID_PARAMS', 'Query param "iata" must be a 3-letter code'));
    }
    const results = airportService.nearby(parsed.data.iata);
    setCacheControl(reply, CACHE_CONTROL.AIRPORTS);
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
    setCacheControl(reply, CACHE_CONTROL.AIRPORTS);
    return ok(results);
  });
}
