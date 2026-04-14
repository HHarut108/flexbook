import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { weatherService } from '../services/WeatherService';
import { ok, fail } from '../utils/response';

const batchBodySchema = z.object({
  destinations: z
    .array(
      z.object({
        iata: z.string().length(3).toUpperCase(),
        lat: z.number(),
        lng: z.number(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .min(1)
    .max(10),
  apiMode: z.enum(['real', 'mock']).optional(),
});

export async function weatherRoutes(app: FastifyInstance) {
  app.post('/weather/batch', async (request, reply) => {
    const parsed = batchBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(fail('INVALID_PARAMS', parsed.error.issues[0]?.message ?? 'Invalid body'));
    }

    try {
      const { destinations, apiMode } = parsed.data;
      const results = await weatherService.getBatch(destinations, apiMode);
      return ok(results);
    } catch (err) {
      app.log.error(err, 'Weather batch failed');
      return reply.status(502).send(fail('WEATHER_API_UNAVAILABLE', 'Weather data unavailable', true));
    }
  });
}
