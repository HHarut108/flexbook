/**
 * Vercel Serverless Entry Point
 *
 * Wraps the Fastify app as a serverless handler. Fastify is initialised
 * once per container (warm re-use) instead of on every request.
 */
import type { IncomingMessage, ServerResponse } from 'http';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { config } from '../src/config';
import { healthRoutes } from '../src/routes/health';
import { airportRoutes } from '../src/routes/airports';
import { flightRoutes } from '../src/routes/flights';
import { weatherRoutes } from '../src/routes/weather';
import { airlineRoutes } from '../src/routes/airlines';

// ── Singleton — built once, reused on warm invocations ─────────────────────
let appInstance: FastifyInstance | null = null;
let buildPromise: Promise<FastifyInstance> | null = null;

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(cors, {
    // Allow the configured frontend URL; fall back to * so cold starts
    // work before FRONTEND_URL is set in the Vercel dashboard.
    origin: config.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  await app.register(healthRoutes);
  await app.register(airportRoutes);
  await app.register(flightRoutes);
  await app.register(weatherRoutes);
  await app.register(airlineRoutes);

  await app.ready();
  return app;
}

async function getApp(): Promise<FastifyInstance> {
  if (appInstance) return appInstance;
  // Prevent concurrent cold-start races
  if (!buildPromise) {
    buildPromise = buildApp().then((app) => {
      appInstance = app;
      return app;
    });
  }
  return buildPromise;
}

// ── Vercel handler ──────────────────────────────────────────────────────────
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const app = await getApp();
  // Feed the raw Node.js request through Fastify's internal HTTP server
  app.server.emit('request', req, res);
}
