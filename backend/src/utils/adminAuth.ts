import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../config';
import { redis, recordRedisOk, recordRedisError } from './redisClient';

const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// ── Token ────────────────────────────────────────────────────────────────────

export function createToken(): string {
  const expiresAt = String(Date.now() + TTL_MS);
  const sig = sign(expiresAt);
  return `${expiresAt}.${sig}`;
}

export function verifyToken(token: string): boolean {
  const dot = token.lastIndexOf('.');
  if (dot === -1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (Date.now() > Number(payload)) return false;
  const expected = sign(payload);
  try {
    return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

function sign(payload: string): string {
  if (!config.ADMIN_SESSION_SECRET) {
    // Refuse to sign — would otherwise use a hardcoded fallback and let attackers forge tokens.
    // Production startup already fails when this is empty; this guard covers test/dev misuse.
    throw new Error('ADMIN_SESSION_SECRET is not configured');
  }
  return createHmac('sha256', config.ADMIN_SESSION_SECRET).update(payload).digest('hex');
}

// ── Rate limiter ─────────────────────────────────────────────────────────────
// Redis-backed when available (shared across instances and restart-safe);
// falls back to in-memory bucket per process when Redis is unreachable.

interface Bucket {
  count: number;
  blockedUntil: number;
}

const MAX_ATTEMPTS = 5;
const BLOCK_SECONDS = 15 * 60; // 15 minutes
const ATTEMPT_WINDOW_SECONDS = 15 * 60;
const buckets = new Map<string, Bucket>();

function attemptsKey(ip: string): string {
  return `admin:login:attempts:${ip}`;
}

function blockKey(ip: string): string {
  return `admin:login:blocked:${ip}`;
}

export async function checkRateLimit(ip: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  if (redis) {
    try {
      const ttl = await redis.ttl(blockKey(ip));
      recordRedisOk();
      if (ttl > 0) return { allowed: false, retryAfter: ttl };
      return { allowed: true };
    } catch (err) {
      recordRedisError(err);
      // Fall through to in-memory bucket
    }
  }

  const now = Date.now();
  const b = buckets.get(ip);
  if (b && now < b.blockedUntil) {
    return { allowed: false, retryAfter: Math.ceil((b.blockedUntil - now) / 1000) };
  }
  return { allowed: true };
}

export async function recordFailedAttempt(ip: string): Promise<void> {
  if (redis) {
    try {
      const count = await redis.incr(attemptsKey(ip));
      if (count === 1) await redis.expire(attemptsKey(ip), ATTEMPT_WINDOW_SECONDS);
      if (count >= MAX_ATTEMPTS) {
        await redis.set(blockKey(ip), '1', { ex: BLOCK_SECONDS });
        await redis.del(attemptsKey(ip));
      }
      recordRedisOk();
      return;
    } catch (err) {
      recordRedisError(err);
      // Fall through to in-memory bucket
    }
  }

  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now >= b.blockedUntil) {
    buckets.set(ip, { count: 1, blockedUntil: 0 });
  } else {
    b.count += 1;
    if (b.count >= MAX_ATTEMPTS) {
      b.blockedUntil = now + BLOCK_SECONDS * 1000;
    }
  }
}

export async function clearAttempts(ip: string): Promise<void> {
  if (redis) {
    try {
      await redis.del(attemptsKey(ip), blockKey(ip));
      recordRedisOk();
    } catch (err) {
      recordRedisError(err);
    }
  }
  buckets.delete(ip);
}
