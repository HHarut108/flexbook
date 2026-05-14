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
