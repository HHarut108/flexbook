import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Airport } from '@fast-travel/shared';
import { config } from '../config';
import { airportService } from '../services/AirportService';
import { ok, fail } from '../utils/response';
import { resolveLocation } from '../utils/resolveLocation';

const LOCATION_MARKER = /^([A-Z]{3}|@[a-z0-9_]+)$/;

function normalizeMarker(raw: string): string {
  return raw.startsWith('@') ? '@' + raw.slice(1).toLowerCase() : raw.toUpperCase();
}

const querySchema = z.object({
  from: z.string().min(1).max(40).transform(normalizeMarker).refine((v) => LOCATION_MARKER.test(v), 'from must be a 3-letter IATA or @city_id'),
  limit: z.coerce.number().int().min(1).max(10).default(3),
});

export interface SuggestedRoute {
  from: Airport;
  to: Airport;
  tagline: string;
  source: 'analytics' | 'curated';
}

interface CacheEntry {
  expiresAt: number;
  routes: SuggestedRoute[];
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

/* Curated fallback — popular destinations keyed by origin region. Used to
   backfill when PostHog is short on data (cold-start or a new origin). The
   region of the origin is inferred from its country code; if no region matches,
   we fall back to GLOBAL. */
const REGION_BY_COUNTRY: Record<string, string> = {
  GB: 'EU', FR: 'EU', DE: 'EU', ES: 'EU', IT: 'EU', NL: 'EU', BE: 'EU',
  PT: 'EU', AT: 'EU', CH: 'EU', SE: 'EU', NO: 'EU', DK: 'EU', FI: 'EU',
  IE: 'EU', PL: 'EU', CZ: 'EU', GR: 'EU', HU: 'EU', RO: 'EU',
  TR: 'MENA', AE: 'MENA', SA: 'MENA', EG: 'MENA', QA: 'MENA', IL: 'MENA',
  US: 'NA', CA: 'NA', MX: 'NA',
  JP: 'APAC', KR: 'APAC', CN: 'APAC', SG: 'APAC', HK: 'APAC', TH: 'APAC',
  IN: 'APAC', AU: 'APAC', PH: 'APAC', MY: 'APAC', VN: 'APAC', ID: 'APAC',
  BR: 'LATAM', AR: 'LATAM', CL: 'LATAM', CO: 'LATAM', PE: 'LATAM',
};

const CURATED_BY_REGION: Record<string, string[]> = {
  EU: ['BCN', 'CDG', 'FCO', 'AMS', 'IST', 'LHR', 'PRG', 'LIS'],
  MENA: ['CDG', 'LHR', 'IST', 'DXB', 'JFK', 'BCN', 'FCO'],
  NA: ['LHR', 'CDG', 'CUN', 'NRT', 'BCN', 'FCO', 'IST'],
  APAC: ['BKK', 'NRT', 'SIN', 'HND', 'ICN', 'DXB', 'CDG'],
  LATAM: ['MIA', 'JFK', 'MAD', 'CDG', 'LIS'],
  GLOBAL: ['LHR', 'CDG', 'BCN', 'FCO', 'IST', 'JFK', 'DXB'],
};

const TAGLINES: Record<string, string> = {
  PAR: 'City break favourite',
  CDG: 'City break favourite',
  BCN: 'Sun & tapas',
  FCO: 'La dolce vita',
  AMS: 'Canals & culture',
  IST: 'Two continents in one trip',
  LHR: 'London essentials',
  PRG: 'Old-world weekend',
  LIS: 'Atlantic charm',
  DXB: 'Desert luxe',
  JFK: 'Transatlantic deal',
  NRT: 'Tokyo lights',
  HND: 'Tokyo lights',
  BKK: 'Tropical city break',
  SIN: 'Garden city',
  ICN: 'Seoul on a budget',
  CUN: 'Beach reset',
  MIA: 'Beach + nightlife',
  MAD: 'Tapas & flamenco',
};

function regionForOrigin(originIata: string): string {
  const origin = airportService.getByIata(originIata);
  if (!origin) return 'GLOBAL';
  return REGION_BY_COUNTRY[origin.city.countryCode] ?? 'GLOBAL';
}

function taglineFor(destIata: string): string {
  return TAGLINES[destIata] ?? 'Popular right now';
}

/* Query PostHog HogQL for the top N destinations from a given origin in the
   last 30 days. Returns [] on any failure (network, auth, parse) — the caller
   then backfills from the curated list. */
async function fetchPostHogTopDestinations(
  originIata: string,
  limit: number,
): Promise<string[]> {
  if (!config.POSTHOG_API_KEY || !config.POSTHOG_PROJECT_ID) return [];

  const hogql = `
    SELECT properties.to AS dest, count() AS c
    FROM events
    WHERE event = 'when_to_go_search'
      AND properties.from = '${originIata.replace(/'/g, '')}'
      AND timestamp > now() - INTERVAL 30 DAY
      AND notEmpty(properties.to)
    GROUP BY dest
    ORDER BY c DESC
    LIMIT ${limit * 3}
  `;

  const url = `${config.POSTHOG_HOST}/api/projects/${config.POSTHOG_PROJECT_ID}/query/`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.POSTHOG_API_KEY}`,
      },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query: hogql } }),
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: Array<[string, number]> };
    if (!Array.isArray(json.results)) return [];
    return json.results
      .map((row) => (Array.isArray(row) ? String(row[0] ?? '') : ''))
      .filter((iata) => /^[A-Z]{3}$/.test(iata.toUpperCase()))
      .map((iata) => iata.toUpperCase());
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function suggestedRoutesRoutes(app: FastifyInstance) {
  app.get('/suggested-routes', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply
        .status(400)
        .send(fail('INVALID_PARAMS', 'Query param "from" must be a 3-letter IATA'));
    }
    const { from: fromMarker, limit } = parsed.data;

    // For city markers, resolveLocation orders members by direct-route
    // popularity DESC, so the first IATA is the busiest hub — use it as
    // the canonical "origin" airport in the response (kept for FE map
    // anchoring) and as the analytics-query key. Direct-route inspiration
    // is unioned across all member airports so a Milan-city pick can
    // surface a route that's only direct from BGY but not MXP.
    const originIatas = resolveLocation(fromMarker);
    if (originIatas.length === 0) {
      return reply
        .status(404)
        .send(fail('NOT_FOUND', `Unknown origin marker "${fromMarker}"`));
    }
    const primaryIata = originIatas[0];
    const origin = airportService.getByIata(primaryIata);
    if (!origin) {
      return reply
        .status(404)
        .send(fail('NOT_FOUND', `Unknown origin IATA "${primaryIata}"`));
    }

    const cacheKey = `${fromMarker}:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return ok({ origin, routes: cached.routes });
    }

    const analyticsIatas = await fetchPostHogTopDestinations(primaryIata, limit);
    const routes: SuggestedRoute[] = [];
    const seen = new Set<string>(originIatas);

    for (const iata of analyticsIatas) {
      if (routes.length >= limit) break;
      if (seen.has(iata)) continue;
      const route = buildRouteFromAny(originIatas, origin, iata, 'analytics');
      if (route) {
        routes.push(route);
        seen.add(iata);
      }
    }

    if (routes.length < limit) {
      const region = regionForOrigin(primaryIata);
      const curated = CURATED_BY_REGION[region] ?? CURATED_BY_REGION.GLOBAL;
      for (const iata of curated) {
        if (routes.length >= limit) break;
        if (seen.has(iata)) continue;
        const route = buildRouteFromAny(originIatas, origin, iata, 'curated');
        if (route) {
          routes.push(route);
          seen.add(iata);
        }
      }
    }

    /* Last-resort fallback for small airports whose curated regional list has
       no non-stop service (e.g. BUS / Batumi has only 5 direct destinations,
       none of which appear in our hand-picked EU/MENA list). Pull straight
       from the OpenFlights direct-routes data, ranked by global hub size — so
       even a remote origin still surfaces *something* the user can fly. For
       city markers, union the direct destinations across all member airports. */
    if (routes.length < limit) {
      const directIatas = unionDirectDestinations(originIatas);
      for (const iata of directIatas) {
        if (routes.length >= limit) break;
        if (seen.has(iata)) continue;
        const route = buildRouteFromAny(originIatas, origin, iata, 'curated');
        if (route) {
          routes.push(route);
          seen.add(iata);
        }
      }
    }

    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, routes });
    return ok({ origin, routes });
  });
}

/** True if ANY member airport in `originIatas` has a non-stop service to
 *  `destIata`. Used so a city-origin can inspire routes that may only be
 *  direct from one of its airports (e.g. Wizz routes from BGY but not MXP). */
function buildRouteFromAny(
  originIatas: string[],
  primaryOrigin: Airport,
  destIata: string,
  source: 'analytics' | 'curated',
): SuggestedRoute | null {
  if (originIatas.some((o) => o.toUpperCase() === destIata.toUpperCase())) return null;
  const anyDirect = originIatas.some((o) => airportService.hasDirectRoute(o, destIata));
  if (!anyDirect) return null;
  const dest = airportService.getByIata(destIata);
  if (!dest) return null;
  return { from: primaryOrigin, to: dest, tagline: taglineFor(dest.iata), source };
}

/** Union of direct destinations across all origin airports, de-duplicated.
 *  Order preserved from the first airport that contributed each IATA. */
function unionDirectDestinations(originIatas: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const origin of originIatas) {
    for (const dest of airportService.directDestinations(origin)) {
      if (seen.has(dest)) continue;
      seen.add(dest);
      out.push(dest);
    }
  }
  return out;
}
