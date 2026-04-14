import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlightOption } from '@fast-travel/shared';

// Mock both providers before importing FlightService
vi.mock('../providers/KiwiFlightProvider', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../providers/KiwiFlightProvider')>();
  return { ...orig, fetchKiwiFlights: vi.fn() };
});
vi.mock('../providers/MockFlightProvider', () => ({
  fetchMockFlights: vi.fn(),
}));
// Keep config.KIWI_API_KEY empty so FlightService uses the mock provider
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

import { FlightService } from './FlightService';
import { fetchMockFlights } from '../providers/MockFlightProvider';

const mockFetch = fetchMockFlights as ReturnType<typeof vi.fn>;

function makeFlight(overrides: Partial<FlightOption> = {}): FlightOption {
  return {
    flightId: `id-${Math.random()}`,
    originIata: 'LHR',
    originCity: 'London',
    destinationIata: 'CDG',
    destinationCity: 'Paris',
    destinationCountry: 'France',
    destinationLat: 49.01,
    destinationLng: 2.55,
    departureDatetime: '2026-04-10T08:00:00',
    arrivalDatetime: '2026-04-10T10:15:00',
    durationMinutes: 135,
    airlineName: 'Air France',
    stops: 0,
    priceUsd: 100,
    bookingUrl: 'https://example.com/book',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FlightService.search — deduplication', () => {
  it('keeps only the cheapest flight per destination', async () => {
    const svc = new FlightService();
    mockFetch.mockResolvedValue([
      makeFlight({ destinationIata: 'CDG', priceUsd: 200 }),
      makeFlight({ destinationIata: 'CDG', priceUsd: 120 }),
      makeFlight({ destinationIata: 'CDG', priceUsd: 180 }),
      makeFlight({ destinationIata: 'MAD', priceUsd: 90 }),
    ]);

    const results = await svc.search('LHR', 'London', '2026-06-01');
    const cdg = results.filter((f) => f.destinationIata === 'CDG');
    expect(cdg).toHaveLength(1);
    expect(cdg[0].priceUsd).toBe(120);
  });

  it('skips deduplication when deduplicate=false', async () => {
    const svc = new FlightService();
    mockFetch.mockResolvedValue([
      makeFlight({ destinationIata: 'CDG', priceUsd: 200 }),
      makeFlight({ destinationIata: 'CDG', priceUsd: 120 }),
    ]);

    const results = await svc.search('LHR', 'London', '2026-06-02', undefined, false);
    expect(results.filter((f) => f.destinationIata === 'CDG')).toHaveLength(2);
  });
});

describe('FlightService.search — sorting', () => {
  it('returns results sorted by price ascending', async () => {
    const svc = new FlightService();
    mockFetch.mockResolvedValue([
      makeFlight({ destinationIata: 'FCO', priceUsd: 300 }),
      makeFlight({ destinationIata: 'AMS', priceUsd: 80 }),
      makeFlight({ destinationIata: 'VIE', priceUsd: 150 }),
    ]);

    const results = await svc.search('LHR', 'London', '2026-06-03');
    for (let i = 1; i < results.length; i++) {
      expect(results[i].priceUsd).toBeGreaterThanOrEqual(results[i - 1].priceUsd);
    }
  });
});

describe('FlightService.search — limit', () => {
  it('caps results at the requested limit', async () => {
    const svc = new FlightService();
    const flights = Array.from({ length: 12 }, (_, i) =>
      makeFlight({ destinationIata: `D${String(i).padStart(2, '0')}`, priceUsd: i * 10 + 50 }),
    );
    mockFetch.mockResolvedValue(flights);

    const results = await svc.search('LHR', 'London', '2026-06-04', undefined, true, 3);
    expect(results).toHaveLength(3);
  });

  it('returns at most 10 results even without explicit limit', async () => {
    const svc = new FlightService();
    const flights = Array.from({ length: 15 }, (_, i) =>
      makeFlight({ destinationIata: `E${String(i).padStart(2, '0')}`, priceUsd: i * 10 + 50 }),
    );
    mockFetch.mockResolvedValue(flights);

    const results = await svc.search('LHR', 'London', '2026-06-05');
    expect(results.length).toBeLessThanOrEqual(10);
  });
});

describe('FlightService.search — caching', () => {
  it('calls the provider only once for the same cache key', async () => {
    const svc = new FlightService();
    mockFetch.mockResolvedValue([
      makeFlight({ destinationIata: 'LIS', priceUsd: 99 }),
    ]);

    await svc.search('LHR', 'London', '2026-07-01');
    await svc.search('LHR', 'London', '2026-07-01');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('calls the provider again for a different date', async () => {
    const svc = new FlightService();
    mockFetch.mockResolvedValue([makeFlight({ priceUsd: 99 })]);

    await svc.search('LHR', 'London', '2026-08-01');
    await svc.search('LHR', 'London', '2026-08-02');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
