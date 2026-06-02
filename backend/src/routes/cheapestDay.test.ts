import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import cors from '@fastify/cors';

// Mock the service surface used by the route. We don't exercise Kiwi or the
// DB here — that's covered separately. This file just locks the HTTP contract
// (params validation, response envelope, error mapping).
const priceCalendarMock = vi.fn();
vi.mock('../services/FlightService', () => ({
  flightService: {
    priceCalendar: (...args: unknown[]) => priceCalendarMock(...args),
  },
}));

import { cheapestDayRoutes } from './cheapestDay';
import {
  RapidApiRateLimitError,
  RapidApiAuthError,
  RapidApiUnavailableError,
} from '../providers/RapidApiKiwiFlightProvider';

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: '*' });
  await app.register(cheapestDayRoutes);
  await app.ready();
  return app;
}

describe('GET /flights/cheapest-day', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    priceCalendarMock.mockReset();
    app = await buildApp();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('returns 400 when origin is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/flights/cheapest-day?destination=CDG&start=2026-08-01&end=2026-08-31',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_PARAMS');
  });

  it('returns 400 when origin === destination', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/flights/cheapest-day?origin=EVN&destination=EVN&start=2026-08-01&end=2026-08-31',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/differ/i);
  });

  it('returns 400 when start > end', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/flights/cheapest-day?origin=EVN&destination=CDG&start=2026-08-31&end=2026-08-01',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/start must be <= end/i);
  });

  it('returns 400 when window exceeds 180 days', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/flights/cheapest-day?origin=EVN&destination=CDG&start=2026-01-01&end=2026-12-31',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/180 days/i);
  });

  it('returns 400 for malformed date', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/flights/cheapest-day?origin=EVN&destination=CDG&start=Aug-1&end=2026-08-31',
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 200 with the calendar envelope on the happy path', async () => {
    priceCalendarMock.mockResolvedValueOnce({
      origin: 'EVN',
      destination: 'CDG',
      start: '2026-08-01',
      end: '2026-08-31',
      days: [
        { date: '2026-08-03', priceUsd: 138, currency: 'USD', bookingUrl: 'https://kiwi.com/x' },
        { date: '2026-08-10', priceUsd: 225, currency: 'USD' },
      ],
      cheapest: { date: '2026-08-03', priceUsd: 138, currency: 'USD', bookingUrl: 'https://kiwi.com/x' },
      cacheStatus: 'fresh',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/flights/cheapest-day?origin=EVN&destination=CDG&start=2026-08-01&end=2026-08-31',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.origin).toBe('EVN');
    expect(body.data.destination).toBe('CDG');
    expect(body.data.cheapest).toEqual({
      date: '2026-08-03',
      priceUsd: 138,
      currency: 'USD',
      bookingUrl: 'https://kiwi.com/x',
    });
    expect(Array.isArray(body.data.days)).toBe(true);
    expect(body.data.days.length).toBe(2);
    expect(body.data.cacheStatus).toBe('fresh');

    expect(priceCalendarMock).toHaveBeenCalledWith('EVN', 'CDG', '2026-08-01', '2026-08-31');
  });

  it('lowercases nothing — IATA codes are uppercased before reaching the service', async () => {
    priceCalendarMock.mockResolvedValueOnce({
      origin: 'EVN',
      destination: 'CDG',
      start: '2026-08-01',
      end: '2026-08-07',
      days: [],
      cheapest: null,
      cacheStatus: 'fresh',
    });

    await app.inject({
      method: 'GET',
      url: '/flights/cheapest-day?origin=evn&destination=cdg&start=2026-08-01&end=2026-08-07',
    });

    expect(priceCalendarMock).toHaveBeenCalledWith('EVN', 'CDG', '2026-08-01', '2026-08-07');
  });

  it('maps RapidApiRateLimitError to 429 with Retry-After', async () => {
    priceCalendarMock.mockRejectedValueOnce(new RapidApiRateLimitError());
    const res = await app.inject({
      method: 'GET',
      url: '/flights/cheapest-day?origin=EVN&destination=CDG&start=2026-08-01&end=2026-08-31',
    });
    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBe('60');
    expect(res.json().error.code).toBe('RATE_LIMITED');
  });

  it('maps RapidApiAuthError to 503', async () => {
    priceCalendarMock.mockRejectedValueOnce(new RapidApiAuthError());
    const res = await app.inject({
      method: 'GET',
      url: '/flights/cheapest-day?origin=EVN&destination=CDG&start=2026-08-01&end=2026-08-31',
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('FLIGHT_API_AUTH_ERROR');
  });

  it('maps RapidApiUnavailableError to 503', async () => {
    priceCalendarMock.mockRejectedValueOnce(new RapidApiUnavailableError(503));
    const res = await app.inject({
      method: 'GET',
      url: '/flights/cheapest-day?origin=EVN&destination=CDG&start=2026-08-01&end=2026-08-31',
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('FLIGHT_API_UNAVAILABLE');
  });

  it('maps unknown errors to 502', async () => {
    priceCalendarMock.mockRejectedValueOnce(new Error('boom'));
    const res = await app.inject({
      method: 'GET',
      url: '/flights/cheapest-day?origin=EVN&destination=CDG&start=2026-08-01&end=2026-08-31',
    });
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe('FLIGHT_API_UNAVAILABLE');
  });
});
