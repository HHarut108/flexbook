import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  getMetrics,
  getMetricsHistory,
  getSessionMetrics,
  getAllTimeMetrics,
  startedAt,
} from '../utils/apiMetrics';
import { getCacheStats } from '../utils/cache';
import { config } from '../config';
import { sendDailyReport, sendHistoryReport } from '../services/EmailReportService';
import { requireAdminAuth } from '../middleware/requireAdminAuth';

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
  app.get('/metrics', { preHandler: requireAdminAuth }, async (request, reply) => {
    const parsed = singleSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'date must be YYYY-MM-DD' });
    }
    const result = await getMetrics(parsed.data.date);
    return { startedAt, ...result };
  });

  // GET /metrics/history?from=YYYY-MM-DD&to=YYYY-MM-DD
  app.get('/metrics/history', { preHandler: requireAdminAuth }, async (request, reply) => {
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

  // GET /metrics/session — in-memory counts since server start, with primary/fallback breakdown
  app.get('/metrics/session', { preHandler: requireAdminAuth }, async () => {
    return getSessionMetrics();
  });

  // GET /metrics/alltime — all-time cumulative counts with primary/fallback breakdown
  app.get('/metrics/alltime', { preHandler: requireAdminAuth }, async () => {
    const calls = await getAllTimeMetrics();
    return { calls };
  });

  // GET /metrics/cache — in-memory cache hit/miss stats per namespace since server start
  app.get('/metrics/cache', { preHandler: requireAdminAuth }, async () => {
    const stats = getCacheStats();
    const redisConnected = !!(config.UPSTASH_REDIS_REST_URL && config.UPSTASH_REDIS_REST_TOKEN);
    return { ...stats, redis: { connected: redisConnected } };
  });

  // POST /metrics/report  — send on-demand email report
  app.post('/metrics/report', { preHandler: requireAdminAuth }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, string>;

    if (body.from && body.to) {
      if (body.from > body.to) {
        return reply.status(400).send({ error: 'from must be before or equal to to' });
      }
      const result = await sendHistoryReport(body.from, body.to);
      return result.sent
        ? { sent: true, type: 'history', from: body.from, to: body.to }
        : reply.status(500).send({ sent: false, error: result.error });
    }

    const result = await sendDailyReport(body.date);
    return result.sent
      ? { sent: true, type: 'daily', date: body.date ?? new Date().toISOString().slice(0, 10) }
      : reply.status(500).send({ sent: false, error: result.error });
  });
}
