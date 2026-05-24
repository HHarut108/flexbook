import { Redis } from '@upstash/redis';
import { config } from '../config';

export const redis: Redis | null =
  config.UPSTASH_REDIS_REST_URL && config.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: config.UPSTASH_REDIS_REST_URL,
        token: config.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

export const redisConfigured = redis !== null;

interface RedisHealthState {
  lastOkAt: number | null;
  lastErrorAt: number | null;
  lastError: string | null;
  consecutiveErrors: number;
}

const state: RedisHealthState = {
  lastOkAt: null,
  lastErrorAt: null,
  lastError: null,
  consecutiveErrors: 0,
};

let warnedAt = 0;
const WARN_THROTTLE_MS = 60_000;

interface Logger {
  warn: (obj: unknown, msg?: string) => void;
}

let logger: Logger | null = null;

export function setRedisLogger(l: Logger): void {
  logger = l;
}

export function recordRedisOk(): void {
  state.lastOkAt = Date.now();
  state.consecutiveErrors = 0;
}

export function recordRedisError(err: unknown): void {
  state.lastErrorAt = Date.now();
  state.lastError = err instanceof Error ? err.message : String(err);
  state.consecutiveErrors += 1;
  if (logger && Date.now() - warnedAt > WARN_THROTTLE_MS) {
    warnedAt = Date.now();
    logger.warn(
      { err: state.lastError, consecutiveErrors: state.consecutiveErrors },
      'Redis call failed',
    );
  }
}

export function getRedisHealth(): {
  configured: boolean;
  healthy: boolean;
  lastOkAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  consecutiveErrors: number;
} {
  const healthy =
    redisConfigured &&
    state.consecutiveErrors === 0 &&
    (state.lastOkAt !== null || state.lastErrorAt === null);
  return {
    configured: redisConfigured,
    healthy,
    lastOkAt: state.lastOkAt ? new Date(state.lastOkAt).toISOString() : null,
    lastErrorAt: state.lastErrorAt ? new Date(state.lastErrorAt).toISOString() : null,
    lastError: state.lastError,
    consecutiveErrors: state.consecutiveErrors,
  };
}
