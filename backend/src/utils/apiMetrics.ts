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
      // fall back to memory if Redis write fails
      memCounts.set(service, (memCounts.get(service) ?? 0) + 1);
    });
  } else {
    memCounts.set(service, (memCounts.get(service) ?? 0) + 1);
  }
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
