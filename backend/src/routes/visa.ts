import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config';
import { fetchWithTimeout } from '../utils/http';
import { ok, fail } from '../utils/response';

const requirementSchema = z.object({
  passport: z.string().length(2).toUpperCase(),
  destination: z.string().length(2).toUpperCase(),
});

interface Requirement {
  passport: string;
  destination: string;
  status: string;
  days?: number;
  label: string;
}

interface Country {
  code: string;
  name: string;
}

const REQ_TTL_MS = 60 * 60 * 1000; // 1h
const COUNTRIES_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const reqCache = new Map<string, { data: Requirement; expiresAt: number }>();
let countriesCache: { data: Country[]; expiresAt: number } | null = null;

function disabledReply() {
  return fail('VISA_DISABLED', 'Visa lookups are not configured on this server.');
}

async function callVisaService<T>(path: string): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  const base = config.VISA_SERVICE_URL.replace(/\/$/, '');
  try {
    const res = await fetchWithTimeout(`${base}${path}`, {}, 8000);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      let message = `Upstream returned HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(body) as { error?: string };
        if (parsed.error) message = parsed.error;
      } catch {
        /* not JSON */
      }
      return { ok: false, status: res.status, message };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upstream unreachable';
    return { ok: false, status: 502, message };
  }
}

export async function visaRoutes(app: FastifyInstance) {
  app.get('/visa/requirement', async (request, reply) => {
    if (!config.VISA_SERVICE_URL) {
      return reply.status(503).send(disabledReply());
    }

    const parsed = requirementSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply
        .status(400)
        .send(fail('INVALID_PARAMS', 'Both "passport" and "destination" must be ISO-2 codes.'));
    }
    const { passport, destination } = parsed.data;
    const key = `${passport}:${destination}`;

    const cached = reqCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return ok(cached.data);
    }

    const result = await callVisaService<Requirement>(
      `/visa?passport=${passport}&destination=${destination}`,
    );
    if (!result.ok) {
      const status = result.status === 400 ? 400 : 502;
      const code = result.status === 400 ? 'INVALID_PARAMS' : 'UPSTREAM_ERROR';
      return reply.status(status).send(fail(code, result.message, status === 502));
    }

    reqCache.set(key, { data: result.data, expiresAt: Date.now() + REQ_TTL_MS });
    return ok(result.data);
  });

  app.get('/visa/countries', async (_request, reply) => {
    if (!config.VISA_SERVICE_URL) {
      return reply.status(503).send(disabledReply());
    }

    if (countriesCache && countriesCache.expiresAt > Date.now()) {
      return ok(countriesCache.data);
    }

    const result = await callVisaService<{ countries: Country[] }>('/countries');
    if (!result.ok) {
      return reply.status(502).send(fail('UPSTREAM_ERROR', result.message, true));
    }

    countriesCache = {
      data: result.data.countries,
      expiresAt: Date.now() + COUNTRIES_TTL_MS,
    };
    return ok(result.data.countries);
  });
}
