import { COOKIE_NAME } from './userAuth';

export async function requireAuth(req: any, reply: any) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return reply.status(401).send({ error: { message: 'Not authenticated' } });
  const { verifyUserToken } = await import('./userAuth');
  const payload = verifyUserToken(token);
  if (!payload) return reply.status(401).send({ error: { message: 'Session expired' } });
  req.userId = payload.sub;
}
