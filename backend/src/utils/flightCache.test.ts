import { describe, it, expect, beforeEach } from 'vitest';
import {
  scheduleKey,
  priceKey,
  scheduleTtlSeconds,
  priceSoftTtlSeconds,
  getScheduleCache,
  setScheduleCache,
  getPriceInfo,
  setPriceInfo,
  CACHE_TTL,
  ScheduleEntry,
} from './flightCache';
import { deleteCache } from './cache';

// ---------- Key builders ----------

describe('scheduleKey', () => {
  it('formats without destination as "any"', () => {
    expect(scheduleKey('EVN', '2026-05-05')).toBe('flights:schedule:EVN:2026-05-05:any');
  });

  it('formats with destination uppercased', () => {
    expect(scheduleKey('evn', '2026-05-05', 'bud')).toBe('flights:schedule:EVN:2026-05-05:BUD');
  });
});

describe('priceKey', () => {
  it('formats as flights:price:<id>', () => {
    expect(priceKey('MOCK-EVN-BUD-2026-05-05')).toBe('flights:price:MOCK-EVN-BUD-2026-05-05');
  });
});

// ---------- TTL calculators ----------

describe('scheduleTtlSeconds', () => {
  it('returns null for a past date', () => {
    expect(scheduleTtlSeconds('2020-01-01')).toBeNull();
  });

  it('returns 45 minutes for today', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(scheduleTtlSeconds(today)).toBe(CACHE_TTL.SCHEDULE_SAME_DAY);
  });

  it('returns 8 hours for a future date', () => {
    expect(scheduleTtlSeconds('2030-12-31')).toBe(CACHE_TTL.SCHEDULE_FUTURE);
  });
});

describe('priceSoftTtlSeconds', () => {
  it('returns the near TTL for a date within 72 hours', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    expect(priceSoftTtlSeconds(tomorrow)).toBe(CACHE_TTL.PRICE_SOFT_NEAR);
  });

  it('returns the far TTL for a date more than 72 hours away', () => {
    expect(priceSoftTtlSeconds('2030-12-31')).toBe(CACHE_TTL.PRICE_SOFT_FAR);
  });
});

// ---------- Schedule cache round-trip ----------

const makeEntry = (overrides: Partial<ScheduleEntry> = {}): ScheduleEntry => ({
  flightId: 'TEST-LHR-CDG',
  originIata: 'LHR',
  originCity: 'London',
  destinationIata: 'CDG',
  destinationCity: 'Paris',
  destinationCountry: 'France',
  destinationLat: 49.01,
  destinationLng: 2.55,
  departureDatetime: '2030-06-01T08:00:00Z',
  arrivalDatetime: '2030-06-01T10:15:00Z',
  durationMinutes: 135,
  airlineName: 'Air France',
  stops: 0,
  ...overrides,
});

describe('schedule cache', () => {
  const origin = 'FC1';
  const date = '2030-06-01';

  beforeEach(() => {
    deleteCache(scheduleKey(origin, date));
    deleteCache(scheduleKey(origin, date, 'CDG'));
  });

  it('returns undefined on miss', () => {
    expect(getScheduleCache(origin, date)).toBeUndefined();
  });

  it('returns cached entries after set', () => {
    const entries = [makeEntry({ originIata: origin })];
    setScheduleCache(origin, date, entries);
    const result = getScheduleCache(origin, date);
    expect(result).toHaveLength(1);
    expect(result![0].flightId).toBe('TEST-LHR-CDG');
  });

  it('does not cache past dates', () => {
    setScheduleCache(origin, '2020-01-01', [makeEntry({ originIata: origin })]);
    expect(getScheduleCache(origin, '2020-01-01')).toBeUndefined();
  });

  it('distinguishes keys with and without destination', () => {
    const withDest = [makeEntry({ originIata: origin, flightId: 'WITH-DEST' })];
    const withoutDest = [makeEntry({ originIata: origin, flightId: 'NO-DEST' })];
    setScheduleCache(origin, date, withDest, 'CDG');
    setScheduleCache(origin, date, withoutDest);
    expect(getScheduleCache(origin, date, 'CDG')![0].flightId).toBe('WITH-DEST');
    expect(getScheduleCache(origin, date)![0].flightId).toBe('NO-DEST');
  });
});

// ---------- Price cache round-trip ----------

describe('price cache', () => {
  const flightId = 'PRICE-TEST-001';

  beforeEach(() => {
    deleteCache(priceKey(flightId));
  });

  it('returns undefined on miss', () => {
    expect(getPriceInfo(flightId)).toBeUndefined();
  });

  it('returns cached price with status "cached" when fresh', () => {
    setPriceInfo(
      flightId,
      {
        amount: 129,
        currency: 'EUR',
        provider: 'kiwi',
        deeplink: 'https://example.com/book',
        priceUpdatedAt: new Date().toISOString(),
      },
      '2030-06-01',
    );
    const result = getPriceInfo(flightId);
    expect(result).not.toBeUndefined();
    expect(result!.amount).toBe(129);
    expect(result!.currency).toBe('EUR');
    expect(result!.provider).toBe('kiwi');
    expect(result!.priceStatus).toBe('cached');
  });

  it('returns priceStatus "stale" when price was updated beyond the soft TTL', () => {
    // Simulate a price updated 2 hours ago — beyond the 15-min soft TTL for near-term dates
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    setPriceInfo(
      flightId,
      {
        amount: 200,
        currency: 'USD',
        provider: 'serpapi',
        deeplink: 'https://example.com',
        priceUpdatedAt: twoHoursAgo,
      },
      tomorrow,
    );

    const result = getPriceInfo(flightId);
    expect(result).not.toBeUndefined();
    expect(result!.priceStatus).toBe('stale');
  });
});
