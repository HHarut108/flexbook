import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import { config } from './config';
import { db } from './db';
import { setRedisLogger } from './utils/redisClient';
import { setSharedLogger } from './utils/logger';
import { healthRoutes } from './routes/health';
import { airportRoutes } from './routes/airports';
import { flightRoutes } from './routes/flights';
import { weatherRoutes } from './routes/weather';
import { airlineRoutes } from './routes/airlines';
import { tripRoutes } from './routes/trips';
import { placesRoutes } from './routes/places';
import { cityGuideRoutes } from './routes/cityGuide';
import { metricsRoutes } from './routes/metrics';
import { adminAuthRoutes } from './routes/adminAuth';
import { assistanceRequestRoutes } from './routes/assistanceRequests';
import { cronRoutes } from './routes/cron';
import { countryInfoRoutes } from './routes/countryInfo';
import { userAuthRoutes } from './routes/userAuth';
import { adminUsersRoutes } from './routes/adminUsers';

const app = Fastify({
  logger: {
    transport:
      config.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
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
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "UserCitizenship_userId_idx" ON "UserCitizenship"("userId")`,
    `CREATE TABLE IF NOT EXISTS "UserVisa" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "citizenshipId" TEXT NOT NULL,
      "countryCode" TEXT NOT NULL,
      "countryName" TEXT NOT NULL,
      "visaType" TEXT,
      "stickerNumber" TEXT,
      "startDate" TEXT,
      "expirationDate" TEXT,
      "entries" TEXT,
      "issuedByCountryCode" TEXT,
      "issuedByCountryName" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
      FOREIGN KEY ("citizenshipId") REFERENCES "UserCitizenship" ("id") ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "UserVisa_userId_idx" ON "UserVisa"("userId")`,
    `CREATE INDEX IF NOT EXISTS "UserVisa_citizenshipId_idx" ON "UserVisa"("citizenshipId")`,
    `CREATE TABLE IF NOT EXISTS "OTP" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "expiresAt" DATETIME NOT NULL,
      "used" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
    )`,
  ];
  for (const sql of statements) {
    await db.$executeRawUnsafe(sql);
  }

  // Idempotent ALTER TABLE for columns added to existing tables. SQLite has no
  // "ADD COLUMN IF NOT EXISTS", so we swallow the "duplicate column" error.
  const alters = [
    `ALTER TABLE "User" ADD COLUMN "countryOfResidenceCode" TEXT`,
    `ALTER TABLE "User" ADD COLUMN "countryOfResidenceName" TEXT`,
    `ALTER TABLE "UserVisa" ADD COLUMN "stickerNumber" TEXT`,
    `ALTER TABLE "UserVisa" ADD COLUMN "startDate" TEXT`,
    `ALTER TABLE "UserVisa" ADD COLUMN "expirationDate" TEXT`,
    `ALTER TABLE "UserVisa" ADD COLUMN "entries" TEXT`,
    `ALTER TABLE "UserVisa" ADD COLUMN "issuedByCountryCode" TEXT`,
    `ALTER TABLE "UserVisa" ADD COLUMN "issuedByCountryName" TEXT`,
    // SQLite forbids non-constant defaults on ADD COLUMN, so seed with NULL and
    // let the app populate. updatedAt/createdAt are nullable on legacy rows.
    `ALTER TABLE "UserCitizenship" ADD COLUMN "createdAt" DATETIME`,
    `ALTER TABLE "UserCitizenship" ADD COLUMN "updatedAt" DATETIME`,
    `ALTER TABLE "UserVisa" ADD COLUMN "createdAt" DATETIME`,
    `ALTER TABLE "UserVisa" ADD COLUMN "updatedAt" DATETIME`,
  ];
  for (const sql of alters) {
    try {
      await db.$executeRawUnsafe(sql);
    } catch (e: any) {
      if (!/duplicate column/i.test(e?.message ?? '')) throw e;
    }
  }

  // Backfill the newly-added timestamp columns on legacy rows. Prisma types them
  // as NOT NULL, so we cannot leave them blank or reads will throw.
  const backfills = [
    `UPDATE "UserCitizenship" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL`,
    `UPDATE "UserCitizenship" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL`,
    `UPDATE "UserVisa" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL`,
    `UPDATE "UserVisa" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL`,
  ];
  for (const sql of backfills) {
    await db.$executeRawUnsafe(sql);
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
    allowList: (request) => request.url === '/health',
  });

  await app.register(healthRoutes);
  await app.register(airportRoutes);
  await app.register(flightRoutes);
  await app.register(weatherRoutes);
  await app.register(airlineRoutes);
  await app.register(tripRoutes);
  await app.register(placesRoutes);
  await app.register(cityGuideRoutes);
  await app.register(metricsRoutes);
  await app.register(adminAuthRoutes);
  await app.register(assistanceRequestRoutes);
  await app.register(cronRoutes);
  await app.register(countryInfoRoutes);
  await app.register(userAuthRoutes);
  await app.register(adminUsersRoutes);

  app.setErrorHandler((err, req, reply) => {
    app.log.error({ err, url: req.url, method: req.method }, 'Unhandled route error');
    reply.status(err.statusCode ?? 500).send({
      error: { message: err.message || 'Internal server error' },
    });
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
