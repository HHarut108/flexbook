// Module augmentation so requireAuth() can attach userId to FastifyRequest
// in a type-safe way. Without this, every route handler that reads
// req.userId would have to cast `req as any`, defeating TS type checking.
//
// Picked up automatically because tsconfig.json includes "src/**/*".
import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    /** Populated by the requireAuth preHandler. Undefined on unauthenticated routes. */
    userId?: string;
  }
}
