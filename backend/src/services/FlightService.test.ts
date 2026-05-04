import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlightOption } from '@fast-travel/shared';
import { deleteCache } from '../utils/cache';
import { priceKey } from '../utils/flightCache';

vi.mock('../providers/KiwiFlightProvider', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../providers/KiwiFlightProvider')>();
  return { ...orig, fetchKiwiFlights: vi.fn() };
});
vi.mock('../providers/MockFlightProvider', () => ({
  fetchMockFlights: vi.fn(),
}));
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

    const { flights } = await svc.search('LHR', 'London', '2030-06-01');
    const cdg = flights.filter((f) => f.destinationIata === 'CDG');
    expect(cdg).toHaveLength(1);
    expect(cdg[0].priceUsd).toBe(120);
  });

  it('skips deduplication when deduplicate=false', async () => {
    const svc = new FlightService();
    mockFetch.mockResolvedValue([
      makeFlight({ destinationIata: 'CDG', priceUsd: 200 }),
      makeFlight({ destinationIata: 'CDG', priceUsd: 120 }),
    ]);

    const { flights } = await svc.search('LHR', 'London', '2030-06-02', undefined, false);
    expect(flights.filter((f) => f.destinationIata === 'CDG')).toHaveLength(2);
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

    const { flights } = await svc.search('LHR', 'London', '2030-06-03');
    for (let i = 1; i < flights.length; i++) {
      expect(flights[i].priceUsd).toBeGreaterThanOrEqual(flights[i - 1].priceUsd);
    }
  });
});

describe('FlightService.search — limit', () => {
  it('caps results at the requested limit', async () => {
    const svc = new FlightService();
    const flightList = Array.from({ length: 12 }, (_, i) =>
      makeFlight({ destinationIata: `D${String(i).padStart(2, '0')}`, priceUsd: i * 10 + 50 }),
    );
    mockFetch.mockResolvedValue(flightList);

    const { flights } = await svc.search('LHR', 'London', '2030-06-04', undefined, true, 3);
    expect(flights).toHaveLength(3);
  });

  it('returns at most 10 results even without explicit limit', async () => {
    const svc = new FlightService();
    const flightList = Array.from({ length: 15 }, (_, i) =>
      makeFlight({ destinationIata: `E${String(i).padStart(2, '0')}`, priceUsd: i * 10 + 50 }),
    );
    mockFetch.mockResolvedValue(flightList);

    const { flights } = await svc.search('LHR', 'London', '2030-06-05');
    expect(flights.length).toBeLessThanOrEqual(10);
  });
});

describe('FlightService.search — caching', () => {
  it('calls the provider only once for the same cache key', async () => {
    const svc = new FlightService();
    mockFetch.mockResolvedValue([
      makeFlight({ destinationIata: 'LIS', priceUsd: 99 }),
    ]);

    await svc.search('LHR', 'London', '2030-07-01');
    await svc.search('LHR', 'London', '2030-07-01');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('calls the provider again for a different date', async () => {
    const svc = new FlightService();
    mockFetch.mockResolvedValue([makeFlight({ priceUsd: 99 })]);

    await svc.search('LHR', 'London', '2030-08-01');
    await svc.search('LHR', 'London', '2030-08-02');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('returns cacheStatus "live" on first fetch', async () => {
    const svc = new FlightService();
    mockFetch.mockResolvedValue([makeFlight({ destinationIata: 'OSL', priceUsd: 150 })]);

    const result = await svc.search('LHR', 'London', '2030-09-01');
    expect(result.cacheStatus).toBe('live');
  });

  it('returns cacheStatus "schedule_cached" on second fetch', async () => {
    const svc = new FlightService();
    mockFetch.mockResolvedValue([makeFlight({ destinationIata: 'HEL', priceUsd: 170 })]);

    await svc.search('LHR', 'London', '2030-09-02');
    const result = await svc.search('LHR', 'London', '2030-09-02');
    expect(result.cacheStatus).toBe('schedule_cached');
  });
});

describe('FlightService.search — priceInfo', () => {
  it('attaches priceInfo with priceStatus "live" on first fetch', async () => {
    const svc = new FlightService();
    mockFetch.mockResolvedValue([makeFlight({ destinationIata: 'TXL', priceUsd: 99 })]);

    const { flights } = await svc.search('LHR', 'London', '2030-10-01');
    expect(flights[0].priceInfo).toBeDefined();
    expect(flights[0].priceInfo!.priceStatus).toBe('live');
    expect(flights[0].priceInfo!.amount).toBe(99);
  });

  it('attaches priceInfo with priceStatus "cached" on schedule cache hit', async () => {
    const svc = new FlightService();
    mockFetch.mockResolvedValue([makeFlight({ destinationIata: 'WAW', priceUsd: 88 })]);

    await svc.search('LHR', 'London', '2030-10-02');
    const { flights } = await svc.search('LHR', 'London', '2030-10-02');
    expect(flights[0].priceInfo!.priceStatus).toBe('cached');
  });

  it('returns stale priceInfo with zero-price fallback when price entry is evicted from cache', async () => {
    const flightId = 'STALE-PRICE-FALLBACK';
    const svc = new FlightService();
    mockFetch.mockResolvedValue([makeFlight({ flightId, destinationIata: 'OSL', priceUsd: 180 })]);

    // First search — both caches populated
    await svc.search('LHR', 'London', '2030-10-03');

    // Simulate price cache expiry (e.g. memory restart, TTL shorter than schedule)
    deleteCache(priceKey(flightId));

    // Second search — schedule hits, price misses → returns stale sentinel values
    const { flights, cacheStatus } = await svc.search('LHR', 'London', '2030-10-03');
    expect(cacheStatus).toBe('schedule_cached');
    expect(flights[0].priceInfo!.priceStatus).toBe('stale');
    expect(flights[0].priceUsd).toBe(0);       // sentinel: price unknown
    expect(flights[0].bookingUrl).toBe('');    // sentinel: booking link unknown
  });

  it('triggers background refresh when prices are stale and repopulates for the next request', async () => {
    const flightId = 'BACKGROUND-REFRESH';
    const svc = new FlightService();
    mockFetch.mockResolvedValue([makeFlight({ flightId, destinationIata: 'CPH', priceUsd: 210 })]);

    // First search — populates schedule + price (provider call #1)
    await svc.search('LHR', 'London', '2030-10-04');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Evict price so the next schedule-cache hit triggers a background refresh
    deleteCache(priceKey(flightId));

    // Second search — returns stale data but fires refresh in background (provider call #2)
    const staleResult = await svc.search('LHR', 'London', '2030-10-04');
    expect(staleResult.flights[0].priceInfo!.priceStatus).toBe('stale');

    // Let the background refresh microtask + async provider call complete.
    // The refresh is scheduled via Promise.resolve().then(), so a single setTimeout(0)
    // pushes past all queued microtasks and lets the mock provider resolve.
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Third search — price cache is repopulated; should now return 'cached'
    const freshResult = await svc.search('LHR', 'London', '2030-10-04');
    expect(freshResult.flights[0].priceInfo!.priceStatus).toBe('cached');
    expect(freshResult.flights[0].priceUsd).toBe(210);
  });
});
