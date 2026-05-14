import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import { config } from './config';
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

async function start() {
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

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    app.log.info(`Backend running at http://localhost:${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
