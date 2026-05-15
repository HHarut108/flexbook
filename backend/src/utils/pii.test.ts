import { describe, it, expect } from 'vitest';
import { encryptPii, decryptPii } from './pii';

describe('pii encryption', () => {
  it('round-trips a value', () => {
    const plain = 'AB1234567';
    const enc = encryptPii(plain);
    expect(enc).not.toBeNull();
    expect(enc).toMatch(/^enc:v1:/);
    expect(decryptPii(enc)).toBe(plain);
  });

  it('returns null for null/undefined/empty input', () => {
    expect(encryptPii(null)).toBeNull();
    expect(encryptPii(undefined)).toBeNull();
    expect(encryptPii('')).toBeNull();
    expect(decryptPii(null)).toBeNull();
    expect(decryptPii(undefined)).toBeNull();
    expect(decryptPii('')).toBeNull();
  });

  it('passes through legacy plaintext values (no enc:v1: prefix)', () => {
    // Pre-encryption rows in the DB are stored as plaintext. decryptPii must
    // return them unchanged until the next write re-stores them encrypted.
    expect(decryptPii('legacy-passport-number-123')).toBe('legacy-passport-number-123');
  });

  it('produces a different ciphertext each call (random IV)', () => {
    const a = encryptPii('same-input');
    const b = encryptPii('same-input');
    expect(a).not.toBe(b);
    expect(decryptPii(a)).toBe('same-input');
    expect(decryptPii(b)).toBe('same-input');
  });

  it('returns the stored value (not null) for malformed enc:v1: payloads — fails soft', () => {
    expect(decryptPii('enc:v1:nope')).toBe('enc:v1:nope');
    expect(decryptPii('enc:v1:a:b:c')).toBe('enc:v1:a:b:c'); // valid shape but garbage bytes
  });
});
