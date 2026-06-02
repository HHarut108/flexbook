import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify from 'fastify';

// In-process stand-in for tripCache so we don't need Redis or a real cache.
const setMock = vi.fn();
const getMock = vi.fn();
vi.mock('../utils/tripCache', () => ({
  tripCache: {
    set: (...args: unknown[]) => setMock(...args),
    get: (...args: unknown[]) => getMock(...args),
  },
  generateTripSlug: () => 'slug-123',
}));

import { tripRoutes } from './trips';

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(tripRoutes);
  await app.ready();
  return app;
}

const validItinerary = {
  origin: {
    iata: 'LHR',
    name: 'London Heathrow',
    city: {
      id: 'LHR',
      name: 'London',
      countryCode: 'GB',
      countryName: 'United Kingdom',
      lat: 51.4775,
      lng: -0.4614,
    },
    timezone: 'Europe/London',
  },
  legs: [
    {
      flightId: 'FL001',
      originIata: 'LHR',
      originCity: 'London',
      destinationIata: 'LIS',
      destinationCity: 'Lisbon',
      destinationCountry: 'Portugal',
      destinationLat: 38.77,
      destinationLng: -9.13,
      departureDatetime: '2026-04-10T08:00:00',
      arrivalDatetime: '2026-04-10T10:30:00',
      durationMinutes: 150,
      airlineName: 'TAP',
      stops: 0,
      priceUsd: 85,
      bookingUrl: 'https://example.com/book',
      stopIndex: 1,
      stayDurationDays: 5,
      nextDepartureDate: '2026-04-15',
      isReturn: false,
    },
  ],
  status: 'planning',
  createdAt: '2026-04-06T12:00:00.000Z',
  passengers: 1,
};

describe('POST /trips — input validation', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    setMock.mockReset();
    getMock.mockReset();
    app = await buildApp();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('accepts a well-formed itinerary and returns the generated slug', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/trips',
      payload: validItinerary,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: 'slug-123' });
    expect(setMock).toHaveBeenCalledOnce();
  });

  it('rejects an itinerary with missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/trips',
      payload: { origin: validItinerary.origin },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toBe('Invalid itinerary');
    expect(setMock).not.toHaveBeenCalled();
  });

  it('rejects an itinerary whose passengers count is out of range', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/trips',
      payload: { ...validItinerary, passengers: 99 },
    });
    expect(res.statusCode).toBe(400);
    expect(setMock).not.toHaveBeenCalled();
  });

  it('rejects an itinerary whose status is not one of the allowed values', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/trips',
      payload: { ...validItinerary, status: 'totally-bogus' },
    });
    expect(res.statusCode).toBe(400);
    expect(setMock).not.toHaveBeenCalled();
  });

  it('rejects a body that exceeds the 32 KB cap', async () => {
    // Pad with a large junk field. Fastify rejects with FST_ERR_CTP_BODY_TOO_LARGE.
    const huge = {
      ...validItinerary,
      _padding: 'x'.repeat(40 * 1024),
    };
    const res = await app.inject({
      method: 'POST',
      url: '/trips',
      payload: huge,
    });
    expect(res.statusCode).toBe(413);
    expect(setMock).not.toHaveBeenCalled();
  });
});
