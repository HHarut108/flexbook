import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlightOption } from '@fast-travel/shared';
import { deleteCache } from '../utils/cache';
import { priceKey } from '../utils/flightCache';

vi.mock('../providers/MockFlightProvider', () => ({
  fetchMockFlights: vi.fn(),
}));
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

  it('falls through to a live fetch when all cached price entries are evicted', async () => {
    const flightId = 'EVICTED-PRICE-LIVE-REFETCH';
    const svc = new FlightService();
    mockFetch.mockResolvedValue([makeFlight({ flightId, destinationIata: 'OSL', priceUsd: 180 })]);

    // First search — both caches populated
    await svc.search('LHR', 'London', '2030-10-03');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Simulate price cache expiry (e.g. memory restart, TTL shorter than schedule).
    // The single cached flight now has no price, so the cached path would yield zero
    // results — the service must fall through to a live fetch instead of returning $0.
    deleteCache(priceKey(flightId));

    const { flights, cacheStatus } = await svc.search('LHR', 'London', '2030-10-03');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(cacheStatus).toBe('live');
    expect(flights[0].priceUsd).toBe(180);
    expect(flights[0].priceInfo!.priceStatus).toBe('live');
  });

  it('drops cached flights with missing prices but keeps the rest', async () => {
    const keepId = 'KEEP-PRICED';
    const dropId = 'DROP-MISSING-PRICE';
    const svc = new FlightService();
    mockFetch.mockResolvedValue([
      makeFlight({ flightId: keepId, destinationIata: 'OSL', priceUsd: 180 }),
      makeFlight({ flightId: dropId, destinationIata: 'CPH', priceUsd: 220 }),
    ]);

    await svc.search('LHR', 'London', '2030-10-06');
    deleteCache(priceKey(dropId));

    const { flights, cacheStatus } = await svc.search('LHR', 'London', '2030-10-06');
    expect(cacheStatus).toBe('schedule_cached');
    expect(flights).toHaveLength(1);
    expect(flights[0].flightId).toBe(keepId);
    expect(flights[0].priceUsd).toBe(180);
    // Background refresh should have been triggered to repopulate the missing price.
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('triggers background refresh when a price is missing and repopulates for the next request', async () => {
    const keepId = 'BG-REFRESH-KEEP';
    const evictId = 'BG-REFRESH-EVICT';
    const svc = new FlightService();
    mockFetch.mockResolvedValue([
      makeFlight({ flightId: keepId, destinationIata: 'CPH', priceUsd: 210 }),
      makeFlight({ flightId: evictId, destinationIata: 'OSL', priceUsd: 175 }),
    ]);

    // First search — populates schedule + prices (provider call #1)
    await svc.search('LHR', 'London', '2030-10-04');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Evict one price so the next schedule-cache hit returns the remaining
    // priced flight and fires a background refresh for the missing one.
    deleteCache(priceKey(evictId));

    const partial = await svc.search('LHR', 'London', '2030-10-04');
    expect(partial.cacheStatus).toBe('schedule_cached');
    expect(partial.flights).toHaveLength(1);
    expect(partial.flights[0].flightId).toBe(keepId);

    // Let the background refresh microtask + async provider call complete.
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Third search — price cache is repopulated; should now return both flights as 'cached'
    const freshResult = await svc.search('LHR', 'London', '2030-10-04');
    expect(freshResult.flights).toHaveLength(2);
    expect(freshResult.flights.every((f) => f.priceInfo!.priceStatus === 'cached')).toBe(true);
  });
});
