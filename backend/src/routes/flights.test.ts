import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';
import cors from '@fastify/cors';

vi.mock('../config', () => ({
  config: {
    KIWI_API_KEY: '',
    RAPIDAPI_KEY: '',
    SERPAPI_API_KEY: '',
    OPENWEATHER_API_KEY: '',
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
import { fetchMockFlights } from '../providers/MockFlightProvider';

const mockFetchMockFlights = fetchMockFlights as unknown as ReturnType<typeof vi.fn>;

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

  // Regression: when the URL pins a destination, dedup-by-destination would
  // collapse all itineraries to a single row (EVN→MAD shipped only 1 result
  // even though Kiwi returned 30+). Dedup must be skipped when destination
  // is locked — every result already lands at the same IATA.
  it('returns all itineraries when destination is locked (does not collapse to 1)', async () => {
    const sameDestThreeOptions = [
      {
        flightId: 'EVN-MAD-via-FCO', originIata: 'EVN', originCity: 'Yerevan',
        destinationIata: 'MAD', destinationCity: 'Madrid', destinationCountry: 'Spain',
        destinationLat: 40.47, destinationLng: -3.56,
        departureDatetime: '2030-06-15T12:45:00', arrivalDatetime: '2030-06-15T19:50:00',
        durationMinutes: 545, airlineName: 'Wizz Air', stops: 1, viaIatas: ['FCO'],
        priceUsd: 141, bookingUrl: 'https://example.com/1',
      },
      {
        flightId: 'EVN-MAD-via-SAW', originIata: 'EVN', originCity: 'Yerevan',
        destinationIata: 'MAD', destinationCity: 'Madrid', destinationCountry: 'Spain',
        destinationLat: 40.47, destinationLng: -3.56,
        departureDatetime: '2030-06-15T06:30:00', arrivalDatetime: '2030-06-15T13:30:00',
        durationMinutes: 540, airlineName: 'Pegasus', stops: 1, viaIatas: ['SAW'],
        priceUsd: 227, bookingUrl: 'https://example.com/2',
      },
      {
        flightId: 'EVN-MAD-via-ATH', originIata: 'EVN', originCity: 'Yerevan',
        destinationIata: 'MAD', destinationCity: 'Madrid', destinationCountry: 'Spain',
        destinationLat: 40.47, destinationLng: -3.56,
        departureDatetime: '2030-06-15T04:25:00', arrivalDatetime: '2030-06-15T12:00:00',
        durationMinutes: 575, airlineName: 'Aegean', stops: 1, viaIatas: ['ATH'],
        priceUsd: 276, bookingUrl: 'https://example.com/3',
      },
    ];
    mockFetchMockFlights.mockResolvedValueOnce(sameDestThreeOptions);

    const res = await app.inject({
      method: 'GET',
      url: '/flights/search?originIata=EVN&date=2030-06-15&destination=MAD&fresh=true',
    });
    expect(res.statusCode).toBe(200);
    const results: Array<{ flightId: string }> = res.json().data.results;
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.flightId).sort()).toEqual([
      'EVN-MAD-via-ATH', 'EVN-MAD-via-FCO', 'EVN-MAD-via-SAW',
    ]);
  });
});

describe('GET /flights/round-trip', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns 400 when originIata is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/flights/round-trip?destinationIata=LIS&outboundDate=2030-04-10&inboundDate=2030-04-17',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_PARAMS');
  });

  it('returns 400 when destinationIata is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/flights/round-trip?originIata=LHR&outboundDate=2030-04-10&inboundDate=2030-04-17',
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for malformed dates', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/flights/round-trip?originIata=LHR&destinationIata=LIS&outboundDate=10-04-2030&inboundDate=2030-04-17',
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when inbound is before outbound', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/flights/round-trip?originIata=LHR&destinationIata=LIS&outboundDate=2030-04-17&inboundDate=2030-04-10',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/inboundDate/);
  });

  it('returns 200 with bundled-pair envelope for valid params', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/flights/round-trip?originIata=LHR&destinationIata=LIS&outboundDate=2030-04-10&inboundDate=2030-04-17',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.origin).toBe('LHR');
    expect(body.data.destination).toBe('LIS');
    expect(body.data.outboundDate).toBe('2030-04-10');
    expect(body.data.inboundDate).toBe('2030-04-17');
    expect(Array.isArray(body.data.pairs)).toBe(true);
    expect(body.data.pairs.length).toBeGreaterThan(0);
  });

  it('every pair carries outbound + inbound + combined price', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/flights/round-trip?originIata=LHR&destinationIata=LIS&outboundDate=2030-04-10&inboundDate=2030-04-17',
    });
    const pairs: Record<string, any>[] = res.json().data.pairs;
    expect(pairs.length).toBeGreaterThan(0);
    for (const p of pairs) {
      expect(p).toHaveProperty('tripId');
      expect(p).toHaveProperty('outbound');
      expect(p).toHaveProperty('inbound');
      expect(p).toHaveProperty('priceUsd');
      expect(p.outbound).toHaveProperty('flightId');
      expect(p.inbound).toHaveProperty('flightId');
      expect(p.outbound.flightId).not.toBe(p.inbound.flightId);
      expect(typeof p.priceUsd).toBe('number');
      expect(p.priceUsd).toBeGreaterThan(0);
    }
  });

  it('respects the limit query param', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/flights/round-trip?originIata=LHR&destinationIata=LIS&outboundDate=2030-04-10&inboundDate=2030-04-17&limit=1',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.pairs.length).toBeLessThanOrEqual(1);
  });

  it('returns 400 when limit > 50', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/flights/round-trip?originIata=LHR&destinationIata=LIS&outboundDate=2030-04-10&inboundDate=2030-04-17&limit=99',
    });
    expect(res.statusCode).toBe(400);
  });

  it('scales price with passengers in mock mode', async () => {
    const [r1, r3] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/flights/round-trip?originIata=LHR&destinationIata=LIS&outboundDate=2030-04-10&inboundDate=2030-04-17&passengers=1',
      }),
      app.inject({
        method: 'GET',
        url: '/flights/round-trip?originIata=LHR&destinationIata=LIS&outboundDate=2030-04-10&inboundDate=2030-04-17&passengers=3',
      }),
    ]);
    const p1 = r1.json().data.pairs[0].priceUsd;
    const p3 = r3.json().data.pairs[0].priceUsd;
    expect(p3).toBeGreaterThan(p1);
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
