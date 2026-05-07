import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '../utils/adminAuth';

export async function requireAdminAuth(request: FastifyRequest, reply: FastifyReply) {
  const auth = request.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  if (!verifyToken(auth.slice(7))) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
}
