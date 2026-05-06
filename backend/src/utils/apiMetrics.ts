import { Redis } from '@upstash/redis';
import { config } from '../config';

// In-memory fallback used when Upstash credentials are not configured
const memCounts = new Map<string, number>();
const startedAt = new Date().toISOString();

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

export function increment(service: string): void {
  if (redis) {
    redis.hincrby(todayKey(), service, 1).catch(() => {
      memCounts.set(service, (memCounts.get(service) ?? 0) + 1);
    });
  } else {
    memCounts.set(service, (memCounts.get(service) ?? 0) + 1);
  }
}

/** Returns all-time cumulative counts by scanning all daily keys. */
export async function getAllTimeMetrics(): Promise<Record<string, number>> {
  if (!redis) return Object.fromEntries(memCounts);

  const totals: Record<string, number> = {};
  let cursor = 0;
  do {
    const [next, keys] = await redis.scan(cursor, { match: 'api:calls:????-??-??', count: 100 });
    cursor = Number(next);
    if (keys.length > 0) {
      const hashes = await Promise.all(keys.map((k) => redis!.hgetall<Record<string, number>>(k)));
      for (const hash of hashes) {
        if (!hash) continue;
        for (const [service, count] of Object.entries(hash)) {
          totals[service] = (totals[service] ?? 0) + Number(count);
        }
      }
    }
  } while (cursor !== 0);

  return totals;
}

/** Returns counts for a single date (defaults to today). */
export async function getMetrics(date?: string): Promise<{ date: string; calls: Record<string, number>; persistent: boolean }> {
  const d = date ?? new Date().toISOString().slice(0, 10);
  if (redis) {
    const raw = await redis.hgetall<Record<string, number>>(`api:calls:${d}`);
    const calls = raw
      ? Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Number(v)]))
      : {};
    return { date: d, calls, persistent: true };
  }
  return { date: d, calls: Object.fromEntries(memCounts), persistent: false };
}

/** Returns counts for a date range (inclusive). Only available with Redis. */
export async function getMetricsHistory(from: string, to: string): Promise<{ date: string; calls: Record<string, number> }[]> {
  if (!redis) return [];

  const days: string[] = [];
  const cursor = new Date(from);
  const end = new Date(to);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  const results = await Promise.all(
    days.map(async (d) => {
      const raw = await redis!.hgetall<Record<string, number>>(`api:calls:${d}`);
      const calls = raw
        ? Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Number(v)]))
        : {};
      return { date: d, calls };
    }),
  );

  return results;
}

export { startedAt };
