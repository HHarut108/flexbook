import Fastify from 'fastify';
import cors from '@fastify/cors';
import cron from 'node-cron';
import { config } from './config';
import { sendDailyReport } from './services/EmailReportService';
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

const app = Fastify({
  logger: {
    transport:
      config.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
});

async function start() {
  const wwwVariant = config.FRONTEND_URL.replace('https://', 'https://www.').replace('https://www.www.', 'https://www.');
  const noWwwVariant = config.FRONTEND_URL.replace('https://www.', 'https://');
  await app.register(cors, {
    origin: [wwwVariant, noWwwVariant, 'http://localhost:5173', 'http://localhost:5176', 'https://flexbook-admin.vercel.app'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
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

  // Daily API usage report — every day at 08:00 Yerevan time
  cron.schedule('0 8 * * *', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const result = await sendDailyReport(yesterday);
    if (result.sent) {
      app.log.info(`Daily API report sent for ${yesterday}`);
    } else {
      app.log.warn(`Daily API report failed: ${result.error}`);
    }
  }, { timezone: 'Asia/Yerevan' });

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    app.log.info(`Backend running at http://localhost:${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
