import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { requireAdminAuth } from '../middleware/requireAdminAuth';
import { decryptPii } from '../utils/pii';

export async function adminUsersRoutes(app: FastifyInstance) {
  // GET /admin/users — list every registered user with all signup data.
  app.get('/admin/users', { preHandler: requireAdminAuth }, async (_req, reply) => {
    const users = await db.user.findMany({
      include: { citizenships: true, visas: true },
      orderBy: { createdAt: 'desc' },
    });
    const safe = users.map((u: any) => {
      const { passwordHash: _pw, citizenships, visas, ...rest } = u;
      return {
        ...rest,
        citizenships: (citizenships ?? []).map((c: any) => ({
          ...c,
          documentNumber: decryptPii(c.documentNumber),
        })),
        visas: (visas ?? []).map((v: any) => ({
          ...v,
          documentNumber: decryptPii(v.documentNumber),
        })),
      };
    });
    return reply.send({ users: safe });
  });
}
