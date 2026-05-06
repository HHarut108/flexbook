import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getMetrics, getMetricsHistory, startedAt } from '../utils/apiMetrics';

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

const singleSchema = z.object({
  date: z.string().regex(dateRe).optional(),
});

const historySchema = z.object({
  from: z.string().regex(dateRe),
  to: z.string().regex(dateRe),
});

export async function metricsRoutes(app: FastifyInstance) {
  // GET /metrics?date=YYYY-MM-DD  (defaults to today)
  app.get('/metrics', async (request, reply) => {
    const parsed = singleSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'date must be YYYY-MM-DD' });
    }
    const result = await getMetrics(parsed.data.date);
    return { startedAt, ...result };
  });

  // GET /metrics/history?from=YYYY-MM-DD&to=YYYY-MM-DD
  app.get('/metrics/history', async (request, reply) => {
    const parsed = historySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'from and to must be YYYY-MM-DD' });
    }
    const { from, to } = parsed.data;
    if (from > to) {
      return reply.status(400).send({ error: 'from must be before or equal to to' });
    }
    const history = await getMetricsHistory(from, to);
    return { from, to, history };
  });
}
