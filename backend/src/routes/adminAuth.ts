import { FastifyInstance } from 'fastify';
import { timingSafeEqual } from 'crypto';
import { config } from '../config';
import { createToken, checkRateLimit, recordFailedAttempt, clearAttempts } from '../utils/adminAuth';

export async function adminAuthRoutes(app: FastifyInstance) {
  app.post('/admin/login', async (request, reply) => {
    const ip = request.ip;

    const rate = checkRateLimit(ip);
    if (!rate.allowed) {
      return reply
        .status(429)
        .send({ error: `Too many failed attempts. Try again in ${rate.retryAfter}s.` });
    }

    const body = (request.body ?? {}) as Record<string, string>;
    const password = body.password ?? '';

    if (!config.ADMIN_PASSWORD) {
      app.log.warn('ADMIN_PASSWORD is not set — admin login is disabled');
      return reply.status(503).send({ error: 'Admin login is not configured.' });
    }

    let match = false;
    try {
      const a = Buffer.from(password);
      const b = Buffer.from(config.ADMIN_PASSWORD);
      match = a.length === b.length && timingSafeEqual(a, b);
    } catch {
      match = false;
    }

    if (!match) {
      recordFailedAttempt(ip);
      // Same message whether wrong password or empty — no enumeration
      return reply.status(401).send({ error: 'Invalid password.' });
    }

    clearAttempts(ip);
    return { token: createToken() };
  });
}
