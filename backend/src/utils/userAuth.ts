import { randomInt } from 'crypto';
import { sign, verify } from 'jsonwebtoken';
import { hash, compare } from 'bcryptjs';
import { config } from '../config';
import { Resend } from 'resend';

const BCRYPT_ROUNDS = 12;
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const JWT_TTL = '30d';
export const COOKIE_NAME = 'user_session';

// ── Password ──────────────────────────────────────────────────────────────────

export const hashPassword = (pw: string) => hash(pw, BCRYPT_ROUNDS);
export const verifyPassword = (pw: string, hashed: string) => compare(pw, hashed);

// ── OTP ───────────────────────────────────────────────────────────────────────

export function generateOtp(): string {
  return String(randomInt(100000, 999999));
}

export function otpExpiresAt(): Date {
  return new Date(Date.now() + OTP_TTL_MS);
}

export const hashOtp = (code: string) => hash(code, BCRYPT_ROUNDS);
export const compareOtp = (code: string, hashed: string) => compare(code, hashed);

// ── JWT ───────────────────────────────────────────────────────────────────────

export interface UserJwtPayload {
  sub: string;   // userId
  email: string;
}

export function signUserToken(payload: UserJwtPayload): string {
  return sign(payload, config.USER_JWT_SECRET, { expiresIn: JWT_TTL });
}

export function verifyUserToken(token: string): UserJwtPayload | null {
  try {
    return verify(token, config.USER_JWT_SECRET) as UserJwtPayload;
  } catch {
    return null;
  }
}

// ── Email ─────────────────────────────────────────────────────────────────────

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(config.RESEND_API_KEY);
  return _resend;
}

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  if (!config.RESEND_API_KEY) {
    console.log(`[DEV] OTP for ${email}: ${otp}`);
    return;
  }
  const result = await getResend().emails.send({
    from: 'Flexbook <noreply@flexbook.space>',
    to: email,
    subject: 'Your Flexbook verification code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="color:#1a1a1a;margin-bottom:8px">Verify your email</h2>
        <p style="color:#555;margin-bottom:24px">Enter the code below in the app. It expires in 10 minutes.</p>
        <div style="background:#f4f4f4;border-radius:8px;padding:24px;text-align:center;font-size:36px;font-weight:700;letter-spacing:8px;color:#1a1a1a">
          ${otp}
        </div>
        <p style="color:#999;font-size:12px;margin-top:24px">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
  if (result.error) {
    console.error('[Resend] Failed to send OTP email:', result.error);
    throw new Error(`Email delivery failed: ${result.error.message}`);
  }
}

// ── Cookie helpers ────────────────────────────────────────────────────────────

export const cookieOptions = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  // Production deploys frontend and API on different domains (vercel.app vs API host),
  // so the cookie must be SameSite=None to be sent on cross-site fetches. In dev (HTTP
  // localhost) we use 'lax' because 'none' requires Secure.
  sameSite: (config.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  path: '/',
  maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
};
