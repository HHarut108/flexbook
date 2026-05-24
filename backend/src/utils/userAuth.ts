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
    subject: 'Welcome to Flexbook — verify your email',
    html: buildOtpEmailHtml(otp),
    text: buildOtpEmailText(otp),
  });
  if (result.error) {
    console.error('[Resend] Failed to send OTP email:', result.error);
    throw new Error(`Email delivery failed: ${result.error.message}`);
  }
}

function buildOtpEmailHtml(otp: string): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">Your Flexbook verification code is ${otp}. It expires in 10 minutes.</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f9">
      <tr><td align="center" style="padding:32px 16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,0.08)">

          <!-- Brand banner -->
          <tr><td style="background:linear-gradient(135deg,#4f46e5 0%,#3730a3 50%,#f97316 130%);padding:36px 32px;text-align:center">
            <div style="font-size:30px;font-weight:900;letter-spacing:-0.04em;color:#ffffff;line-height:1">
              <span>flex</span><span style="color:#fb923c">/</span><span>book</span>
            </div>
            <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:8px;letter-spacing:0.02em">Cheapest fares. Biggest adventures.</div>
          </td></tr>

          <!-- Body -->
          <tr><td style="padding:36px 32px 8px 32px">
            <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:700;color:#0f172a">Welcome to Flexbook! 👋</h1>
            <p style="margin:0 0 20px 0;font-size:15px;line-height:1.55;color:#334155">
              Thanks for signing up — we're glad to have you on board. To finish creating your account, please
              confirm your email by entering the code below in the app.
            </p>

            <div style="background:#f4f5f9;border:1px solid #e2e8f0;border-radius:12px;padding:24px;text-align:center;margin:8px 0 20px 0">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.14em;color:#64748b;font-weight:600;margin-bottom:10px">Your verification code</div>
              <div style="font-family:'SF Mono','Menlo','Consolas',monospace;font-size:36px;font-weight:700;letter-spacing:10px;color:#3730a3">${otp}</div>
              <div style="font-size:12px;color:#64748b;margin-top:10px">This code expires in <strong>10 minutes</strong>.</div>
            </div>

            <p style="margin:0 0 8px 0;font-size:14px;line-height:1.55;color:#334155">
              Once verified, you'll be able to save trips, sync them across devices, and reach customer support faster.
            </p>
          </td></tr>

          <!-- Disclaimer -->
          <tr><td style="padding:8px 32px 28px 32px">
            <div style="border-top:1px solid #e2e8f0;padding-top:20px;font-size:12px;line-height:1.55;color:#64748b">
              <strong style="color:#475569">Didn't sign up for Flexbook?</strong><br/>
              You can safely ignore this email — no account will be created and we won't email you again.
              Someone may have entered your address by mistake.
            </div>
          </td></tr>

          <!-- Footer -->
          <tr><td style="background:#fafafa;padding:18px 32px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #f1f5f9">
            © ${new Date().getFullYear()} Flexbook · This is an automated message, please do not reply.
          </td></tr>

        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function buildOtpEmailText(otp: string): string {
  return [
    'Welcome to Flexbook!',
    '',
    `Your verification code is: ${otp}`,
    'This code expires in 10 minutes.',
    '',
    "Didn't sign up for Flexbook? You can safely ignore this email — no account will be created.",
    '',
    `© ${new Date().getFullYear()} Flexbook`,
  ].join('\n');
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
