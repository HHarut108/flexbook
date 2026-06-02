import type { FastifyRequest, FastifyReply } from 'fastify';
import { COOKIE_NAME } from './userAuth';

// Pre-handler for protected routes. On success, attaches `userId` to the
// request (see types/fastify.d.ts for the module augmentation). Returns
// 401 otherwise.
export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    reply.status(401).send({ error: { message: 'Not authenticated' } });
    return;
  }
  const { verifyUserToken } = await import('./userAuth');
  const payload = verifyUserToken(token);
  if (!payload) {
    reply.status(401).send({ error: { message: 'Session expired' } });
    return;
  }
  req.userId = payload.sub;
}
