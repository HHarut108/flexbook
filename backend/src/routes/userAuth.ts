import '@fastify/cookie';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import {
  hashPassword,
  verifyPassword,
  generateOtp,
  hashOtp,
  compareOtp,
  otpExpiresAt,
  sendOtpEmail,
  signUserToken,
  COOKIE_NAME,
  cookieOptions,
} from '../utils/userAuth';
import { redis, recordRedisOk, recordRedisError } from '../utils/redisClient';
import { encryptPii, decryptPii } from '../utils/pii';

// ── Rate limit helpers (same Redis-with-in-memory-fallback pattern) ───────────

interface LoginBucket { count: number; blockedUntil: number }
const loginBuckets = new Map<string, LoginBucket>();
const resendBuckets = new Map<string, number>(); // ip -> unblock timestamp

const LOGIN_MAX = 5;
const LOGIN_BLOCK_S = 15 * 60;
const RESEND_COOLDOWN_S = 60;

async function checkLoginRateLimit(ip: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  if (redis) {
    try {
      const ttl = await redis.ttl(`user:login:blocked:${ip}`);
      recordRedisOk();
      if (ttl > 0) return { allowed: false, retryAfter: ttl };
      return { allowed: true };
    } catch (e) { recordRedisError(e); }
  }
  const now = Date.now();
  const b = loginBuckets.get(ip);
  if (b && now < b.blockedUntil) return { allowed: false, retryAfter: Math.ceil((b.blockedUntil - now) / 1000) };
  return { allowed: true };
}

async function recordLoginFail(ip: string): Promise<void> {
  if (redis) {
    try {
      const count = await redis.incr(`user:login:attempts:${ip}`);
      if (count === 1) await redis.expire(`user:login:attempts:${ip}`, LOGIN_BLOCK_S);
      if (count >= LOGIN_MAX) {
        await redis.set(`user:login:blocked:${ip}`, '1', { ex: LOGIN_BLOCK_S });
        await redis.del(`user:login:attempts:${ip}`);
      }
      recordRedisOk(); return;
    } catch (e) { recordRedisError(e); }
  }
  const now = Date.now();
  const b = loginBuckets.get(ip) ?? { count: 0, blockedUntil: 0 };
  b.count += 1;
  if (b.count >= LOGIN_MAX) b.blockedUntil = now + LOGIN_BLOCK_S * 1000;
  loginBuckets.set(ip, b);
}

async function clearLoginAttempts(ip: string): Promise<void> {
  if (redis) {
    try { await redis.del(`user:login:attempts:${ip}`, `user:login:blocked:${ip}`); recordRedisOk(); return; }
    catch (e) { recordRedisError(e); }
  }
  loginBuckets.delete(ip);
}

async function checkResendCooldown(ip: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  if (redis) {
    try {
      const ttl = await redis.ttl(`user:otp:resend:${ip}`);
      recordRedisOk();
      if (ttl > 0) return { allowed: false, retryAfter: ttl };
      return { allowed: true };
    } catch (e) { recordRedisError(e); }
  }
  const unblock = resendBuckets.get(ip) ?? 0;
  const now = Date.now();
  if (now < unblock) return { allowed: false, retryAfter: Math.ceil((unblock - now) / 1000) };
  return { allowed: true };
}

async function setResendCooldown(ip: string): Promise<void> {
  if (redis) {
    try { await redis.set(`user:otp:resend:${ip}`, '1', { ex: RESEND_COOLDOWN_S }); recordRedisOk(); return; }
    catch (e) { recordRedisError(e); }
  }
  resendBuckets.set(ip, Date.now() + RESEND_COOLDOWN_S * 1000);
}

// ── Validation schemas ────────────────────────────────────────────────────────

// First / last names: letters (any script), space, hyphen, apostrophe — 1-50 chars.
const NAME_RE = /^[\p{L}][\p{L}\s'\-]{0,49}$/u;
const GENDER_VALUES = ['male', 'female', 'other', 'prefer_not_to_say'] as const;

const registerBody = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
  firstName: z.string().min(1).max(50).regex(NAME_RE, 'Invalid first name'),
  lastName: z.string().min(1).max(50).regex(NAME_RE, 'Invalid last name'),
  gender: z.enum(GENDER_VALUES).optional(),
  birthday: z.string().optional(),
  citizenships: z.array(z.object({
    countryCode: z.string().length(2),
    countryName: z.string().min(1),
    documentNumber: z.string().max(50).optional(),
    isPrimary: z.boolean().optional(),
  })).max(2).optional(),
  visas: z.array(z.object({
    citizenshipCountryCode: z.string().length(2).optional(),
    countryCode: z.string().length(2),
    countryName: z.string().min(1),
    visaType: z.string().max(50).optional(),
    documentNumber: z.string().max(50).optional(),
    validUntil: z.string().max(20).optional(),
  })).max(20).optional(),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifyOtpBody = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

const changePasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const deleteAccountBody = z.object({
  password: z.string().min(1),
});

const visaInputSchema = z.object({
  id: z.string().optional(),
  citizenshipId: z.string().optional(),
  citizenshipCountryCode: z.string().length(2).optional(),
  countryCode: z.string().length(2),
  countryName: z.string().min(1),
  visaType: z.string().max(100).optional().nullable(),
  documentNumber: z.string().max(100).optional().nullable(),
  validUntil: z.string().max(20).optional().nullable(),
});

const updateProfileBody = z.object({
  firstName: z.string().min(1).max(50).regex(NAME_RE, 'Invalid first name').optional(),
  lastName: z.string().min(1).max(50).regex(NAME_RE, 'Invalid last name').optional(),
  gender: z.enum(GENDER_VALUES).nullable().optional(),
  birthday: z.string().nullable().optional(),
  countryOfResidenceCode: z.string().length(2).nullable().optional(),
  countryOfResidenceName: z.string().min(1).nullable().optional(),
  citizenships: z.array(z.object({
    countryCode: z.string().length(2),
    countryName: z.string().min(1),
    documentNumber: z.string().optional().nullable(),
    isPrimary: z.boolean().optional(),
  })).max(2).optional(),
  visas: z.array(visaInputSchema).max(20).optional(),
});

// ── Route plugin ──────────────────────────────────────────────────────────────

export async function userAuthRoutes(app: FastifyInstance) {

  // POST /auth/register
  app.post('/auth/register', {
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
  }, async (req, reply) => {
    const parsed = registerBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: { message: 'Invalid input', details: parsed.error.flatten() } });
    const { email, password, firstName, lastName, gender, birthday, citizenships, visas } = parsed.data;

    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      if (!existing.emailVerified) {
        // Re-register: overwrite profile fields with the latest values so a corrected
        // second attempt wins over the first (e.g. user mistyped their birthday before).
        const passwordHash = await hashPassword(password);
        await db.user.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            firstName,
            lastName,
            gender: gender ?? null,
            birthday: birthday ?? null,
            visas: { deleteMany: {} },
            citizenships: {
              deleteMany: {},
              create: citizenships?.length
                ? citizenships.map((c, i) => ({
                    countryCode: c.countryCode,
                    countryName: c.countryName,
                    documentNumber: encryptPii(c.documentNumber),
                    isPrimary: i === 0,
                  }))
                : [],
            },
          },
        });
        if (visas?.length) {
          await createVisasForUser(existing.id, visas);
        }
        await db.oTP.updateMany({ where: { userId: existing.id, used: false }, data: { used: true } });
        const code = generateOtp();
        await db.oTP.create({ data: { userId: existing.id, code: await hashOtp(code), expiresAt: otpExpiresAt() } });
        try {
          await sendOtpEmail(existing.email, code);
        } catch (emailErr) {
          req.log.error({ err: emailErr }, 'Failed to send OTP email during re-register');
          return reply.status(500).send({ error: { message: 'Account exists but email delivery failed. Please try again.' } });
        }
        return reply.status(200).send({ success: true, data: { message: 'Verification code resent', emailVerified: false } });
      }
      return reply.status(409).send({ error: { message: 'Email already registered' } });
    }

    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        gender: gender ?? null,
        birthday: birthday ?? null,
        citizenships: citizenships?.length
          ? {
              create: citizenships.map((c, i) => ({
                countryCode: c.countryCode,
                countryName: c.countryName,
                documentNumber: encryptPii(c.documentNumber),
                isPrimary: i === 0,
              })),
            }
          : undefined,
      },
    });
    if (visas?.length) {
      await createVisasForUser(user.id, visas);
    }

    const code = generateOtp();
    await db.oTP.create({ data: { userId: user.id, code: await hashOtp(code), expiresAt: otpExpiresAt() } });
    try {
      await sendOtpEmail(user.email, code);
    } catch (emailErr) {
      req.log.error({ err: emailErr }, 'Failed to send OTP email after registration');
      return reply.status(500).send({ error: { message: 'Account created but email delivery failed. Please contact support.' } });
    }

    return reply.status(201).send({ success: true, data: { message: 'Account created. Check your email for the verification code.' } });
  });

  // POST /auth/verify-otp
  app.post('/auth/verify-otp', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
  }, async (req, reply) => {
    const parsed = verifyOtpBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: { message: 'Invalid input' } });
    const { email, code } = parsed.data;

    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return reply.status(400).send({ error: { message: 'Invalid code' } });

    const candidates = await db.oTP.findMany({
      where: { userId: user.id, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    let matchedOtp: typeof candidates[0] | null = null;
    for (const candidate of candidates) {
      if (await compareOtp(code, candidate.code)) { matchedOtp = candidate; break; }
    }
    if (!matchedOtp) return reply.status(400).send({ error: { message: 'Invalid or expired code' } });

    await db.oTP.update({ where: { id: matchedOtp.id }, data: { used: true } });
    const updated = await db.user.update({
      where: { id: user.id },
      data: { emailVerified: true, lastLoginAt: new Date() },
      include: { citizenships: true, visas: true },
    });

    const token = signUserToken({ sub: updated.id, email: updated.email });
    return reply
      .setCookie(COOKIE_NAME, token, cookieOptions)
      .send({ success: true, data: { user: safeUser(updated) } });
  });

  // POST /auth/resend-otp
  app.post('/auth/resend-otp', async (req, reply) => {
    const ip = req.ip;
    const cooldown = await checkResendCooldown(ip);
    if (!cooldown.allowed) return reply.status(429).send({ error: { message: `Please wait ${cooldown.retryAfter}s before requesting a new code` } });

    const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: { message: 'Invalid input' } });

    const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (!user || user.emailVerified) {
      // Don't reveal whether the email exists
      await setResendCooldown(ip);
      return reply.send({ success: true, data: { message: 'If this email is pending verification, a new code has been sent.' } });
    }

    await db.oTP.updateMany({ where: { userId: user.id, used: false }, data: { used: true } });
    const code = generateOtp();
    await db.oTP.create({ data: { userId: user.id, code: await hashOtp(code), expiresAt: otpExpiresAt() } });
    await sendOtpEmail(user.email, code);
    await setResendCooldown(ip);

    return reply.send({ success: true, data: { message: 'Verification code sent' } });
  });

  // POST /auth/login
  app.post('/auth/login', async (req, reply) => {
    const ip = req.ip;
    const rl = await checkLoginRateLimit(ip);
    if (!rl.allowed) return reply.status(429).send({ error: { message: `Too many attempts. Try again in ${rl.retryAfter}s` } });

    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: { message: 'Invalid input' } });
    const { email, password } = parsed.data;

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { citizenships: true, visas: true },
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      await recordLoginFail(ip);
      return reply.status(401).send({ error: { message: 'Invalid email or password' } });
    }

    if (!user.emailVerified) {
      return reply.status(403).send({ error: { message: 'Please verify your email before logging in' } });
    }

    await clearLoginAttempts(ip);
    // Stamp the last successful login. Fire-and-forget; failure here shouldn't
    // block the login response.
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const token = signUserToken({ sub: user.id, email: user.email });
    return reply
      .setCookie(COOKIE_NAME, token, cookieOptions)
      .send({ success: true, data: { user: { ...safeUser(user), lastLoginAt: new Date().toISOString() } } });
  });

  // POST /auth/logout
  app.post('/auth/logout', async (_req, reply) => {
    return reply
      .clearCookie(COOKIE_NAME, { path: '/' })
      .send({ success: true, data: { message: 'Logged out' } });
  });

  // GET /auth/me  (requires auth)
  app.get('/auth/me', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = await db.user.findUnique({
      where: { id: (req as any).userId },
      include: { citizenships: true, visas: true },
    });
    if (!user) return reply.status(404).send({ error: { message: 'User not found' } });
    return reply.send({ success: true, data: { user: safeUser(user) } });
  });

  // PATCH /auth/profile  (requires auth) — update name, birthday, country of residence,
  // citizenships, and visas. Citizenships and visas are passed as full replacement arrays.
  app.patch('/auth/profile', { preHandler: [requireAuth] }, async (req, reply) => {
    const parsed = updateProfileBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: { message: 'Invalid input', details: parsed.error.flatten() } });
    const userId = (req as any).userId as string;
    const { firstName, lastName, gender, birthday, countryOfResidenceCode, countryOfResidenceName, citizenships, visas } = parsed.data;

    await db.user.update({
      where: { id: userId },
      data: {
        ...(firstName !== undefined ? { firstName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
        ...(gender !== undefined ? { gender } : {}),
        ...(birthday !== undefined ? { birthday } : {}),
        ...(countryOfResidenceCode !== undefined ? { countryOfResidenceCode } : {}),
        ...(countryOfResidenceName !== undefined ? { countryOfResidenceName } : {}),
      },
    });

    if (citizenships !== undefined) {
      await db.userCitizenship.deleteMany({ where: { userId } });
      for (let i = 0; i < citizenships.length; i++) {
        const c = citizenships[i];
        await db.userCitizenship.create({
          data: {
            userId,
            countryCode: c.countryCode,
            countryName: c.countryName,
            documentNumber: encryptPii(c.documentNumber),
            isPrimary: c.isPrimary ?? i === 0,
          },
        });
      }
    }

    if (visas !== undefined) {
      const existingCitizenships = await db.userCitizenship.findMany({ where: { userId } });
      const byCountryCode = new Map<string, string>(
        existingCitizenships.map((c: { id: string; countryCode: string }) => [c.countryCode, c.id]),
      );
      const byId = new Set<string>(existingCitizenships.map((c: { id: string }) => c.id));
      await db.userVisa.deleteMany({ where: { userId } });
      for (const v of visas) {
        // Resolve which citizenship this visa attaches to. Accept either explicit citizenshipId
        // or citizenshipCountryCode (e.g. "the visa is stamped in my AM passport").
        let citizenshipId: string | undefined;
        if (v.citizenshipId && byId.has(v.citizenshipId)) citizenshipId = v.citizenshipId;
        if (!citizenshipId && v.citizenshipCountryCode) citizenshipId = byCountryCode.get(v.citizenshipCountryCode);
        if (!citizenshipId) continue;
        await db.userVisa.create({
          data: {
            userId,
            citizenshipId,
            countryCode: v.countryCode,
            countryName: v.countryName,
            visaType: v.visaType ?? null,
            documentNumber: encryptPii(v.documentNumber),
            validUntil: v.validUntil ?? null,
          },
        });
      }
    }

    const fresh = await db.user.findUnique({
      where: { id: userId },
      include: { citizenships: true, visas: true },
    });
    return reply.send({ success: true, data: { user: safeUser(fresh) } });
  });

  // PATCH /auth/password  (requires auth)
  app.patch('/auth/password', { preHandler: [requireAuth] }, async (req, reply) => {
    const parsed = changePasswordBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: { message: 'Invalid input' } });

    const user = await db.user.findUnique({ where: { id: (req as any).userId } });
    if (!user) return reply.status(404).send({ error: { message: 'User not found' } });

    if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
      return reply.status(401).send({ error: { message: 'Current password is incorrect' } });
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await db.user.update({ where: { id: user.id }, data: { passwordHash } });
    return reply.send({ success: true, data: { message: 'Password updated' } });
  });

  // DELETE /auth/account  (requires auth)
  app.delete('/auth/account', { preHandler: [requireAuth] }, async (req, reply) => {
    const parsed = deleteAccountBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: { message: 'Invalid input' } });

    const user = await db.user.findUnique({ where: { id: (req as any).userId } });
    if (!user) return reply.status(404).send({ error: { message: 'User not found' } });

    if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return reply.status(401).send({ error: { message: 'Password is incorrect' } });
    }

    await db.user.delete({ where: { id: user.id } });
    return reply
      .clearCookie(COOKIE_NAME, { path: '/' })
      .send({ success: true, data: { message: 'Account deleted' } });
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeUser(user: any) {
  const { passwordHash: _, ...safe } = user;
  // decryptPii is a no-op for null/empty and for legacy plaintext rows
  // (anything without the enc:v1: prefix), so this is safe to apply blindly.
  if (safe.citizenships) {
    safe.citizenships = safe.citizenships.map((c: any) => ({
      ...c,
      documentNumber: decryptPii(c.documentNumber),
    }));
  }
  if (safe.visas) {
    safe.visas = safe.visas.map((v: any) => ({
      ...v,
      documentNumber: decryptPii(v.documentNumber),
    }));
  }
  return safe;
}

// Attach a list of registration-time visas to the user. Each visa must point at one
// of the user's just-created citizenships via `citizenshipCountryCode` — visas without
// a matching passport are skipped (the signup flow only surfaces them after a country
// is picked, so this is a defensive filter for malformed clients).
async function createVisasForUser(
  userId: string,
  visas: Array<{
    citizenshipCountryCode?: string;
    countryCode: string;
    countryName: string;
    visaType?: string;
    documentNumber?: string;
    validUntil?: string;
  }>,
) {
  const userCitizenships = await db.userCitizenship.findMany({ where: { userId } });
  const byCountry = new Map(userCitizenships.map((c: any) => [c.countryCode, c.id]));
  for (const v of visas) {
    const citizenshipId = v.citizenshipCountryCode ? byCountry.get(v.citizenshipCountryCode) : undefined;
    if (!citizenshipId) continue;
    await db.userVisa.create({
      data: {
        userId,
        citizenshipId,
        countryCode: v.countryCode,
        countryName: v.countryName,
        visaType: v.visaType ?? null,
        documentNumber: encryptPii(v.documentNumber),
        validUntil: v.validUntil ?? null,
      },
    });
  }
}

async function requireAuth(req: any, reply: any) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return reply.status(401).send({ error: { message: 'Not authenticated' } });
  const { verifyUserToken } = await import('../utils/userAuth');
  const payload = verifyUserToken(token);
  if (!payload) return reply.status(401).send({ error: { message: 'Session expired' } });
  req.userId = payload.sub;
}
