import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyUserToken, COOKIE_NAME } from '../utils/userAuth';

export async function requireUserAuth(req: FastifyRequest, reply: FastifyReply) {
  const token = (req as any).cookies?.[COOKIE_NAME];
  if (!token) {
    return reply.status(401).send({ error: { message: 'Not authenticated' } });
  }
  const payload = verifyUserToken(token);
  if (!payload) {
    return reply.status(401).send({ error: { message: 'Session expired' } });
  }
  (req as any).userId = payload.sub;
  (req as any).userEmail = payload.email;
}
