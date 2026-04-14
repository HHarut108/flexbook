import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { airlineLogoService } from '../services/AirlineLogoService';
import { fail, ok } from '../utils/response';

const logoQuerySchema = z.object({
  codes: z.string().min(1, 'codes is required'),
  height: z.coerce.number().int().min(16).max(512).default(48),
  apiMode: z.enum(['real', 'mock']).optional(),
});

export async function airlineRoutes(app: FastifyInstance) {
  app.get('/airlines/logos', async (request, reply) => {
    const parsed = logoQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(fail('INVALID_PARAMS', parsed.error.issues[0]?.message ?? 'Invalid params'));
    }

    const { codes, height, apiMode } = parsed.data;
    const codeList = codes
      .split(',')
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean);

    try {
      const logos = await airlineLogoService.getLogos(codeList, height, apiMode);
      return ok(logos);
    } catch (err) {
      app.log.error(err, 'Airline logo lookup failed');
      return reply.status(502).send(fail('AIRLINE_LOGOS_UNAVAILABLE', 'Could not fetch airline logos.', true));
    }
  });
}
