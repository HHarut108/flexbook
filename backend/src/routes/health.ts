import { FastifyInstance } from 'fastify';
import { ok } from '../utils/response';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    return ok({ status: 'ok', ts: new Date().toISOString() });
  });
}
