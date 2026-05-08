import { Redis } from '@upstash/redis';
import { config } from '../config';

export type CallType = 'primary' | 'fallback';

export const startedAt = new Date().toISOString();

// Always-on in-memory session counter (tracks since process start, regardless of Redis)
const sessionCounts = new Map<string, number>();

let redis: Redis | null = null;
if (config.UPSTASH_REDIS_REST_URL && config.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: config.UPSTASH_REDIS_REST_URL,
    token: config.UPSTASH_REDIS_REST_TOKEN,
  });
}

function todayKey(): string {
  return `api:calls:${new Date().toISOString().slice(0, 10)}`;
}

export function increment(service: string, type: CallType = 'primary'): void {
  const field = `${service}:${type}`;
  sessionCounts.set(field, (sessionCounts.get(field) ?? 0) + 1);
  if (redis) {
    redis.hincrby(todayKey(), field, 1).catch(() => {});
  }
}

/**
 * Collapses raw hash fields ("service:primary", "service:fallback", legacy "service")
 * into a per-service breakdown object.
 */
function parseBreakdown(
  raw: Record<string, number>,
): Record<string, { primary: number; fallback: number }> {
  const out: Record<string, { primary: number; fallback: number }> = {};
  for (const [key, count] of Object.entries(raw)) {
    const isTyped = key.endsWith(':primary') || key.endsWith(':fallback');
    if (isTyped) {
      const colonIdx = key.lastIndexOf(':');
      const service = key.slice(0, colonIdx);
      const type = key.slice(colonIdx + 1) as CallType;
      if (!out[service]) out[service] = { primary: 0, fallback: 0 };
      out[service][type] += Number(count);
    } else {
      // Legacy key without type suffix — treat as primary
      if (!out[key]) out[key] = { primary: 0, fallback: 0 };
      out[key].primary += Number(count);
    }
  }
  return out;
}

/** Returns in-memory counts since server start, with primary/fallback breakdown. */
export function getSessionMetrics(): {
  startedAt: string;
  calls: Record<string, { primary: number; fallback: number }>;
} {
  const raw: Record<string, number> = {};
  for (const [k, v] of sessionCounts) raw[k] = v;
  return { startedAt, calls: parseBreakdown(raw) };
}

/** Returns counts for a single date (defaults to today). */
export async function getMetrics(
  date?: string,
): Promise<{ date: string; calls: Record<string, number>; persistent: boolean }> {
  const d = date ?? new Date().toISOString().slice(0, 10);
  if (redis) {
    const raw = await redis.hgetall<Record<string, number>>(`api:calls:${d}`);
    if (raw) {
      const breakdown = parseBreakdown(
        Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Number(v)])),
      );
      const calls: Record<string, number> = {};
      for (const [svc, b] of Object.entries(breakdown)) calls[svc] = b.primary + b.fallback;
      return { date: d, calls, persistent: true };
    }
    return { date: d, calls: {}, persistent: true };
  }
  // No Redis — derive from session counts
  const breakdown = parseBreakdown(Object.fromEntries(sessionCounts));
  const calls: Record<string, number> = {};
  for (const [svc, b] of Object.entries(breakdown)) calls[svc] = b.primary + b.fallback;
  return { date: d, calls, persistent: false };
}

/** Returns counts for a date range (inclusive). Only available with Redis. */
export async function getMetricsHistory(
  from: string,
  to: string,
): Promise<{ date: string; calls: Record<string, number> }[]> {
  if (!redis) return [];

  const days: string[] = [];
  const cursor = new Date(from);
  const end = new Date(to);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return Promise.all(
    days.map(async (d) => {
      const raw = await redis!.hgetall<Record<string, number>>(`api:calls:${d}`);
      if (!raw) return { date: d, calls: {} };
      const breakdown = parseBreakdown(
        Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Number(v)])),
      );
      const calls: Record<string, number> = {};
      for (const [svc, b] of Object.entries(breakdown)) calls[svc] = b.primary + b.fallback;
      return { date: d, calls };
    }),
  );
}

/** Returns all-time cumulative counts with primary/fallback breakdown. */
export async function getAllTimeMetrics(): Promise<
  Record<string, { primary: number; fallback: number }>
> {
  if (!redis) {
    const raw: Record<string, number> = {};
    for (const [k, v] of sessionCounts) raw[k] = v;
    return parseBreakdown(raw);
  }

  const totals: Record<string, number> = {};
  let cursor = 0;
  do {
    const [next, keys] = await redis.scan(cursor, { match: 'api:calls:????-??-??', count: 100 });
    cursor = Number(next);
    if (keys.length > 0) {
      const hashes = await Promise.all(
        keys.map((k) => redis!.hgetall<Record<string, number>>(k)),
      );
      for (const hash of hashes) {
        if (!hash) continue;
        for (const [k, count] of Object.entries(hash)) {
          totals[k] = (totals[k] ?? 0) + Number(count);
        }
      }
    }
  } while (cursor !== 0);

  return parseBreakdown(totals);
}
