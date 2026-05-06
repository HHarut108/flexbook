import { FastifyInstance } from 'fastify';
import { getMetrics } from '../utils/apiMetrics';

export async function metricsRoutes(app: FastifyInstance) {
  app.get('/metrics', async () => {
    return getMetrics();
  });
}
