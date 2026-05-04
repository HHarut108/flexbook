import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';
import cors from '@fastify/cors';

vi.mock('../config', () => ({
  config: {
    KIWI_API_KEY: '',
    OPENWEATHER_API_KEY: '',
    AIRHEX_API_KEY: '',
    PORT: 3000,
    NODE_ENV: 'test',
    FRONTEND_URL: 'http://localhost:5173',
  },
}));

vi.mock('../providers/MockFlightProvider', () => ({
  fetchMockFlights: vi.fn().mockResolvedValue([
    {
      flightId: 'MOCK-LHR-LIS',
      originIata: 'LHR',
      originCity: 'London',
      destinationIata: 'LIS',
      destinationCity: 'Lisbon',
      destinationCountry: 'Portugal',
      destinationLat: 38.77,
      destinationLng: -9.13,
      departureDatetime: '2030-04-10T08:00:00',
      arrivalDatetime: '2030-04-10T10:30:00',
      durationMinutes: 150,
      airlineName: 'TAP',
      stops: 0,
      priceUsd: 85,
      bookingUrl: 'https://example.com/book',
    },
    {
      flightId: 'MOCK-LHR-MAD',
      originIata: 'LHR',
      originCity: 'London',
      destinationIata: 'MAD',
      destinationCity: 'Madrid',
      destinationCountry: 'Spain',
      destinationLat: 40.47,
      destinationLng: -3.56,
      departureDatetime: '2030-04-10T09:00:00',
      arrivalDatetime: '2030-04-10T12:00:00',
      durationMinutes: 180,
      airlineName: 'Iberia',
      stops: 0,
      priceUsd: 110,
      bookingUrl: 'https://example.com/book2',
    },
  ]),
}));

import { flightRoutes } from './flights';
import { airportRoutes } from './airports';
import { healthRoutes } from './health';

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: '*' });
  await app.register(healthRoutes);
  await app.register(airportRoutes);
  await app.register(flightRoutes);
  await app.ready();
  return app;
}

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
    await app.close();
  });
});

describe('GET /flights/search', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns 400 for missing originIata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/flights/search?date=2030-04-10',
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_PARAMS');
  });

  it('returns 400 for invalid date format', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/flights/search?originIata=LHR&date=10-04-2030',
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for originIata longer than 3 chars', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/flights/search?originIata=LHRX&date=2030-04-10',
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 200 with flight search envelope for valid params', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/flights/search?originIata=LHR&date=2030-04-10',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('origin', 'LHR');
    expect(body.data).toHaveProperty('date', '2030-04-10');
    expect(body.data).toHaveProperty('cacheStatus');
    expect(Array.isArray(body.data.results)).toBe(true);
    expect(body.data.results.length).toBeGreaterThan(0);
  });

  it('respects the limit param', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/flights/search?originIata=LHR&date=2030-04-10&limit=1',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.results.length).toBeLessThanOrEqual(1);
  });

  it('returns 400 for limit > 10', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/flights/search?originIata=LHR&date=2030-04-10&limit=99',
    });
    expect(res.statusCode).toBe(400);
  });

  it('accepts valid sort param', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/flights/search?originIata=LHR&date=2030-04-10&sort=quality',
    });
    expect(res.statusCode).toBe(200);
  });

  it('returns 400 for invalid sort value', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/flights/search?originIata=LHR&date=2030-04-10&sort=random',
    });
    expect(res.statusCode).toBe(400);
  });

  it('accepts maxStopovers param', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/flights/search?originIata=LHR&date=2030-04-10&maxStopovers=0',
    });
    expect(res.statusCode).toBe(200);
  });

  it('each result has required FlightOption fields', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/flights/search?originIata=LHR&date=2030-04-10',
    });
    const flights: Record<string, unknown>[] = res.json().data.results;
    for (const f of flights) {
      expect(f).toHaveProperty('flightId');
      expect(f).toHaveProperty('originIata');
      expect(f).toHaveProperty('destinationIata');
      expect(f).toHaveProperty('priceUsd');
      expect(f).toHaveProperty('bookingUrl');
    }
  });

  it('each result has priceInfo with priceStatus', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/flights/search?originIata=LHR&date=2030-04-10',
    });
    const flights: Record<string, unknown>[] = res.json().data.results;
    for (const f of flights) {
      expect(f).toHaveProperty('priceInfo');
      const priceInfo = f.priceInfo as Record<string, unknown>;
      expect(priceInfo).toHaveProperty('amount');
      expect(priceInfo).toHaveProperty('currency');
      expect(priceInfo).toHaveProperty('provider');
      expect(priceInfo).toHaveProperty('priceUpdatedAt');
      expect(['cached', 'live', 'stale']).toContain(priceInfo.priceStatus);
    }
  });
});

describe('GET /airports/search', () => {
  it('returns results for a known city', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/airports/search?q=london',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    await app.close();
  });

  it('returns 400 for missing query', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/airports/search' });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
