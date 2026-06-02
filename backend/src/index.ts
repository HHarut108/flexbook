import Fastify, { FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import { config } from './config';
import { db } from './db';
import { setRedisLogger } from './utils/redisClient';
import { setSharedLogger } from './utils/logger';
import { verifyToken as verifyAdminToken } from './utils/adminAuth';
import { fail } from './utils/response';
import { healthRoutes } from './routes/health';
import { airportRoutes } from './routes/airports';
import { flightRoutes } from './routes/flights';
import { cheapestDayRoutes } from './routes/cheapestDay';
import { weatherRoutes } from './routes/weather';
import { airlineRoutes } from './routes/airlines';
import { tripRoutes } from './routes/trips';
import { budgetPlanRoutes } from './routes/budgetPlan';
import { placesRoutes } from './routes/places';
import { cityGuideRoutes } from './routes/cityGuide';
import { metricsRoutes } from './routes/metrics';
import { adminAuthRoutes } from './routes/adminAuth';
import { assistanceRequestRoutes } from './routes/assistanceRequests';
import { cronRoutes } from './routes/cron';
import { countryInfoRoutes } from './routes/countryInfo';
import { userAuthRoutes } from './routes/userAuth';
import { adminUsersRoutes } from './routes/adminUsers';
import { visaRoutes } from './routes/visa';

const app = Fastify({
  logger: {
    transport:
      config.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
  // We always sit behind a proxy in deployed envs (Render's load balancer, and
  // Vercel's edge for /api/* in production). Without this, req.ip is the proxy's
  // address and all users share a single rate-limit bucket — one bad actor (or
  // an automated probe) locks out everyone. With trustProxy on, Fastify reads
  // X-Forwarded-For and reports the real client IP.
  trustProxy: true,
});

setRedisLogger(app.log);
setSharedLogger(app.log);

async function runMigrations() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "firstName" TEXT NOT NULL,
      "lastName" TEXT NOT NULL,
      "birthday" TEXT,
      "countryOfResidenceCode" TEXT,
      "countryOfResidenceName" TEXT,
      "emailVerified" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
    `CREATE TABLE IF NOT EXISTS "UserCitizenship" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "countryCode" TEXT NOT NULL,
      "countryName" TEXT NOT NULL,
      "documentNumber" TEXT,
      "isPrimary" BOOLEAN NOT NULL DEFAULT false,
      FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "UserVisa" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "citizenshipId" TEXT NOT NULL,
      "countryCode" TEXT NOT NULL,
      "countryName" TEXT NOT NULL,
      "visaType" TEXT,
      "documentNumber" TEXT,
      "validUntil" TEXT,
      FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
      FOREIGN KEY ("citizenshipId") REFERENCES "UserCitizenship" ("id") ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "OTP" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "expiresAt" DATETIME NOT NULL,
      "used" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
    )`,
    // When To Go price calendar cache. Mirrored from the numbered migration
    // 20260602050000_add_price_calendar_day so cold starts always have the
    // table even if `migrate.ts` hasn't run yet (production safety net).
    `CREATE TABLE IF NOT EXISTS "PriceCalendarDay" (
      "origin" TEXT NOT NULL,
      "destination" TEXT NOT NULL,
      "date" TEXT NOT NULL,
      "cheapestUsd" REAL,
      "currency" TEXT NOT NULL DEFAULT 'USD',
      "bookingUrl" TEXT,
      "source" TEXT NOT NULL,
      "sampledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "ttlUntil" DATETIME NOT NULL,
      PRIMARY KEY ("origin", "destination", "date")
    )`,
    `CREATE INDEX IF NOT EXISTS "PriceCalendarDay_origin_destination_idx"
      ON "PriceCalendarDay"("origin", "destination")`,
  ];
  for (const sql of statements) {
    await db.$executeRawUnsafe(sql);
  }

  // Idempotent ALTER TABLE for columns added to existing tables. SQLite has no
  // "ADD COLUMN IF NOT EXISTS", so we swallow the "duplicate column" error.
  const alters = [
    `ALTER TABLE "User" ADD COLUMN "countryOfResidenceCode" TEXT`,
    `ALTER TABLE "User" ADD COLUMN "countryOfResidenceName" TEXT`,
    `ALTER TABLE "User" ADD COLUMN "lastLoginAt" DATETIME`,
  ];
  for (const sql of alters) {
    try {
      await db.$executeRawUnsafe(sql);
    } catch (e: any) {
      if (!/duplicate column/i.test(e?.message ?? '')) throw e;
    }
  }
}

async function start() {
  await runMigrations();

  const wwwVariant = config.FRONTEND_URL.replace('https://', 'https://www.').replace('https://www.www.', 'https://www.');
  const noWwwVariant = config.FRONTEND_URL.replace('https://www.', 'https://');
  const corsOrigins = [wwwVariant, noWwwVariant, 'https://flexbook-admin.vercel.app'];
  if (config.NODE_ENV !== 'production') {
    corsOrigins.push('http://localhost:5173', 'http://localhost:5176');
  }
  await app.register(cors, {
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  });

  await app.register(cookie);

  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: '1 minute',
    allowList: (request: FastifyRequest) => {
      if (request.url === '/health') return true;
      // Bypass the per-IP global limit for authenticated admin-panel traffic.
      // The admin dashboard loads several metric endpoints in parallel on every
      // page switch and was hitting 120/min on its own when an end-user was
      // browsing from the same NAT'd IP at the same time.
      const auth = request.headers.authorization;
      if (auth?.startsWith('Bearer ') && verifyAdminToken(auth.slice(7))) return true;
      return false;
    },
  });

  await app.register(healthRoutes);
  await app.register(airportRoutes);
  await app.register(flightRoutes);
  await app.register(cheapestDayRoutes);
  await app.register(weatherRoutes);
  await app.register(airlineRoutes);
  await app.register(tripRoutes);
  await app.register(budgetPlanRoutes);
  await app.register(placesRoutes);
  await app.register(cityGuideRoutes);
  await app.register(metricsRoutes);
  await app.register(adminAuthRoutes);
  await app.register(assistanceRequestRoutes);
  await app.register(cronRoutes);
  await app.register(countryInfoRoutes);
  await app.register(userAuthRoutes);
  await app.register(adminUsersRoutes);
  await app.register(visaRoutes);

  // C5 INTERNAL_ERROR — app-wide handler with request-id for support reference.
  // Always returns our standard { success, error: { code, message, retryable } } envelope
  // so the frontend doesn't have to special-case Fastify's default shape.
  app.setErrorHandler((err, req, reply) => {
    const reqId = req.id;
    app.log.error(
      { err, url: req.url, method: req.method, reqId },
      'Unhandled route error',
    );
    const status = err.statusCode ?? 500;
    if (status >= 500) {
      reply.status(500).send(fail(
        'INTERNAL_ERROR',
        `Something went wrong on our end. Please try again. Reference: ${reqId}`,
        true,
      ));
    } else {
      // 4xx surfaced by fastify itself (rate limit 429, body-too-large 413, etc.)
      reply.status(status).send(fail(
        'REQUEST_ERROR',
        err.message || 'Request error',
        false,
      ));
    }
  });

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    app.log.info(`Backend running at http://localhost:${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
