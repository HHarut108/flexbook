import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { requireAdminAuth } from '../middleware/requireAdminAuth';

export async function adminUsersRoutes(app: FastifyInstance) {
  // GET /admin/users — list every registered user with all signup data.
  app.get('/admin/users', { preHandler: requireAdminAuth }, async (_req, reply) => {
    const users = await db.user.findMany({
      include: { citizenships: true, visas: true },
      orderBy: { createdAt: 'desc' },
    });
    const safe = users.map((u: { passwordHash: string } & Record<string, unknown>) => {
      const { passwordHash: _pw, ...rest } = u;
      return rest;
    });
    return reply.send({ users: safe });
  });
}
