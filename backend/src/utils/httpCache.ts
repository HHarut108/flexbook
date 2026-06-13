import { FastifyReply } from 'fastify';

// Cache-Control presets for read-only endpoints whose responses are a pure
// function of their query string (no per-user data, never Set-Cookie). These
// let the browser and any shared cache in front of us (Vercel's edge proxies
// /api/*) serve repeats without round-tripping to Render — which matters most
// on free-tier cold starts.
//
// `stale-while-revalidate` lets a cache serve the slightly-stale copy instantly
// while it refreshes in the background, so users never block on revalidation.
// These HTTP TTLs sit *below* the service-worker runtimeCaching windows in
// vite.config.ts — the SW is the long-lived offline layer; this is the
// in-session / edge layer.
export const CACHE_CONTROL = {
  // Airport gazetteer is effectively static; deterministic per query.
  AIRPORTS: 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
  // Airline logos change very rarely; keyed by codes + height.
  AIRLINE_LOGOS: 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800',
  // Country metadata (flag, currency, capital) is stable for weeks.
  COUNTRY_INFO: 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=2592000',
} as const;

export function setCacheControl(reply: FastifyReply, value: string): void {
  reply.header('Cache-Control', value);
}
