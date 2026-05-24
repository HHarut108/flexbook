import crypto from 'crypto';
import { config } from '../config';

// Application-layer encryption for sensitive identity fields (passport/ID
// document numbers, and visa sticker numbers when they land). AES-256-GCM with
// a random 12-byte IV per value. Values are stored as
// `enc:v1:<iv>:<ciphertext>:<authTag>` so we can detect legacy plaintext rows
// (anything without the prefix) and pass them through untouched until they're
// next written.

const VERSION_PREFIX = 'enc:v1:';
// Dev-only fallback so local development works without setting an env var.
// Production refuses to start without PII_ENCRYPTION_KEY (enforced in config.ts).
// Base64 of the 32-byte ASCII string "dev-only-pii-key-not-for-prod-12".
const DEV_KEY_BASE64 = 'ZGV2LW9ubHktcGlpLWtleS1ub3QtZm9yLXByb2QtMTI=';

let _key: Buffer | null = null;

function getKey(): Buffer {
  if (_key) return _key;
  const raw = config.PII_ENCRYPTION_KEY || DEV_KEY_BASE64;
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    throw new Error('PII_ENCRYPTION_KEY must decode to 32 bytes (base64-encoded 256-bit key)');
  }
  _key = buf;
  return _key;
}

export function encryptPii(plain: string | null | undefined): string | null {
  if (plain === null || plain === undefined || plain === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION_PREFIX}${iv.toString('base64')}:${encrypted.toString('base64')}:${tag.toString('base64')}`;
}

export function decryptPii(stored: string | null | undefined): string | null {
  if (stored === null || stored === undefined || stored === '') return null;
  if (!stored.startsWith(VERSION_PREFIX)) return stored; // legacy plaintext — pass through
  const rest = stored.slice(VERSION_PREFIX.length);
  const parts = rest.split(':');
  if (parts.length !== 3) return stored; // malformed — return as-is rather than crash
  const [ivB64, cipherB64, tagB64] = parts;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(cipherB64, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return stored; // corrupt or wrong key — fail soft rather than break the response
  }
}
