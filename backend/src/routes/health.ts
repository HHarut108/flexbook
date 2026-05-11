import { FastifyInstance } from 'fastify';
import { ok } from '../utils/response';
import { getRedisHealth } from '../utils/redisClient';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    return ok({
      status: 'ok',
      ts: new Date().toISOString(),
      redis: getRedisHealth(),
    });
  });
}
