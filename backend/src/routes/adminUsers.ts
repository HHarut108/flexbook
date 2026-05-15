import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { requireAdminAuth } from '../middleware/requireAdminAuth';
import { decryptPii } from '../utils/pii';

export async function adminUsersRoutes(app: FastifyInstance) {
  // GET /admin/users — list every registered user with all signup data.
  // Decrypts the encrypted PII columns (passport/ID numbers, visa sticker numbers)
  // for admin viewing. The encryption-at-rest still protects against DB dumps.
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
          stickerNumber: decryptPii(v.stickerNumber),
        })),
      };
    });
    return reply.send({ users: safe });
  });
}
