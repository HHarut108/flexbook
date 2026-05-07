import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../config';

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
  const secret = config.ADMIN_SESSION_SECRET || 'insecure-default-set-ADMIN_SESSION_SECRET';
  return createHmac('sha256', secret).update(payload).digest('hex');
}

// ── Rate limiter (in-memory, per IP) ─────────────────────────────────────────

interface Bucket {
  count: number;
  blockedUntil: number;
}

const MAX_ATTEMPTS = 5;
const BLOCK_MS = 15 * 60 * 1000; // 15 minutes
const buckets = new Map<string, Bucket>();

export function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const b = buckets.get(ip);
  if (b && now < b.blockedUntil) {
    return { allowed: false, retryAfter: Math.ceil((b.blockedUntil - now) / 1000) };
  }
  return { allowed: true };
}

export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now >= b.blockedUntil) {
    buckets.set(ip, { count: 1, blockedUntil: 0 });
  } else {
    b.count += 1;
    if (b.count >= MAX_ATTEMPTS) {
      b.blockedUntil = now + BLOCK_MS;
    }
  }
}

export function clearAttempts(ip: string): void {
  buckets.delete(ip);
}
