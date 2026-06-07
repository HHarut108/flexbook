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

  // Regression: until 2026-06-04 the route-search results screen always
  // collapsed to a single result for any specific (origin, destination)
  // search because dedup was applied even when destinationIata was set —
  // every itinerary shares the same destinationIata so the map kept only
  // the cheapest. With a destination specified the user wants variety
  // across airlines, times, and stops, so dedup must auto-disable.
  it('returns every itinerary when destinationIata is specified, regardless of deduplicate flag', async () => {
    const svc = new FlightService();
    mockFetch.mockResolvedValue([
      makeFlight({ flightId: 'f1', destinationIata: 'BCN', priceUsd: 103, airlineName: 'Wizz Air', stops: 1 }),
      makeFlight({ flightId: 'f2', destinationIata: 'BCN', priceUsd: 145, airlineName: 'Vueling', stops: 0 }),
      makeFlight({ flightId: 'f3', destinationIata: 'BCN', priceUsd: 180, airlineName: 'KLM', stops: 1 }),
    ]);

    const { flights } = await svc.search('EVN', 'Yerevan', '2030-06-11', 'BCN', true);
    expect(flights).toHaveLength(3);
    expect(flights.map((f) => f.flightId).sort()).toEqual(['f1', 'f2', 'f3']);
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

  it('bypasses the schedule cache when bypassCache=true', async () => {
    const svc = new FlightService();
    mockFetch.mockResolvedValue([makeFlight({ destinationIata: 'BRU', priceUsd: 140 })]);

    await svc.search('LHR', 'London', '2030-09-03');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Without bypass, the second call would hit cache. With bypass=true it must re-fetch.
    const result = await svc.search('LHR', 'London', '2030-09-03', undefined, true, {}, undefined, true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.cacheStatus).toBe('live');
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

  it('searchOneWayFanOut merges results from each origin × destination pair', async () => {
    const svc = new FlightService();
    // Simulate two Rome airports → two London airports. Each (origin,dest)
    // pair returns one cheap flight with a unique id so the merge keeps all.
    mockFetch.mockImplementation(async (origin: string, _city: string, _date: string, dest?: string) => {
      return [makeFlight({
        flightId: `${origin}-${dest}-X`,
        originIata: origin,
        destinationIata: dest ?? 'XXX',
        priceUsd: origin === 'FCO' ? 150 : 200,
      })];
    });

    const result = await svc.searchOneWayFanOut(
      ['FCO', 'CIA'],
      '2030-11-01',
      ['LHR', 'LGW'],
    );

    // 2 origins × 2 destinations = 4 underlying provider calls.
    expect(mockFetch).toHaveBeenCalledTimes(4);
    // All 4 flightIds are distinct → merge keeps them all.
    expect(result.flights).toHaveLength(4);
    // Price-ascending sort.
    for (let i = 1; i < result.flights.length; i++) {
      expect(result.flights[i].priceUsd).toBeGreaterThanOrEqual(result.flights[i - 1].priceUsd);
    }
  });

  it('searchOneWayFanOut: same flightId across pairs keeps the cheapest price', async () => {
    const svc = new FlightService();
    // Both origin airports surface the same flight id (rare — would require
    // the provider to dedupe by itinerary). The merge keeps the cheapest.
    mockFetch.mockImplementation(async (origin: string) => {
      return [makeFlight({
        flightId: 'DUPLICATE-ID',
        originIata: origin,
        destinationIata: 'CDG',
        priceUsd: origin === 'JFK' ? 500 : 450,
      })];
    });

    const result = await svc.searchOneWayFanOut(['JFK', 'LGA'], '2030-11-02', ['CDG']);
    expect(result.flights).toHaveLength(1);
    expect(result.flights[0].priceUsd).toBe(450);
  });

  it('searchOneWayFanOut with single origin and single destination = single call', async () => {
    const svc = new FlightService();
    mockFetch.mockResolvedValue([makeFlight({ destinationIata: 'CDG', priceUsd: 100 })]);

    await svc.searchOneWayFanOut(['LHR'], '2030-11-03', ['CDG']);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('searchOneWayFanOut throws when no origin airports provided', async () => {
    const svc = new FlightService();
    await expect(svc.searchOneWayFanOut([], '2030-11-04', ['CDG'])).rejects.toThrow();
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
