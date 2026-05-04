import { PriceInfo, PriceStatus } from '@fast-travel/shared';
import { getCache, setCache } from './cache';

// ---------- Types ----------

export interface ScheduleEntry {
  flightId: string;
  originIata: string;
  originCity: string;
  destinationIata: string;
  destinationCity: string;
  destinationCountry: string;
  destinationLat: number;
  destinationLng: number;
  departureDatetime: string;
  arrivalDatetime: string;
  durationMinutes: number;
  airlineName: string;
  airlineCode?: string;
  stops: number;
  viaIatas?: string[];
}

interface PriceCacheEntry {
  amount: number;
  currency: string;
  provider: string;
  deeplink: string;
  priceUpdatedAt: string;
  softTtlSeconds: number;
}

// ---------- Configurable TTL constants (seconds) ----------

export const CACHE_TTL = {
  SCHEDULE_SAME_DAY: 45 * 60,       // 45 min — schedule changes rarely intra-day
  SCHEDULE_FUTURE: 8 * 60 * 60,     // 8 h — stable for non-today departures
  PRICE_SOFT_NEAR: 15 * 60,         // 15 min soft TTL for flights within 72 h
  PRICE_SOFT_FAR: 30 * 60,          // 30 min soft TTL for flights beyond 72 h
  PRICE_NEAR_THRESHOLD_HOURS: 72,   // boundary between near / far price TTLs
} as const;

// ---------- Key builders ----------

export function scheduleKey(originIata: string, date: string, destinationIata?: string): string {
  const dest = destinationIata ? destinationIata.toUpperCase() : 'any';
  return `flights:schedule:${originIata.toUpperCase()}:${date}:${dest}`;
}

export function priceKey(flightId: string): string {
  return `flights:price:${flightId}`;
}

// ---------- TTL calculators ----------

/**
 * Returns TTL in seconds for schedule data.
 * Returns null for past dates — caching past flights has no value.
 */
export function scheduleTtlSeconds(dateStr: string): number | null {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (dateStr < todayStr) return null;
  if (dateStr === todayStr) return CACHE_TTL.SCHEDULE_SAME_DAY;
  return CACHE_TTL.SCHEDULE_FUTURE;
}

/**
 * Returns the soft TTL for price data (when a cached price is considered stale).
 * Hard TTL stored in cache = 2× this value, enabling stale-while-revalidate.
 *
 * Uses noon UTC on the flight date as the anchor to avoid midnight-boundary
 * edge cases. The soft TTL is intentionally approximate.
 */
export function priceSoftTtlSeconds(dateStr: string): number {
  const flightNoonUtcMs = new Date(dateStr + 'T12:00:00Z').getTime();
  const diffHours = (flightNoonUtcMs - Date.now()) / (1000 * 60 * 60);
  return diffHours <= CACHE_TTL.PRICE_NEAR_THRESHOLD_HOURS
    ? CACHE_TTL.PRICE_SOFT_NEAR
    : CACHE_TTL.PRICE_SOFT_FAR;
}

// ---------- Schedule cache ----------

export function getScheduleCache(
  originIata: string,
  date: string,
  destinationIata?: string,
): ScheduleEntry[] | undefined {
  const key = scheduleKey(originIata, date, destinationIata);
  try {
    const result = getCache<ScheduleEntry[]>(key);
    console.log(`[flightCache] schedule ${result ? 'HIT' : 'MISS'} ${key}`);
    return result;
  } catch (err) {
    console.warn(`[flightCache] schedule read failed, treating as MISS ${key}`, err);
    return undefined;
  }
}

export function setScheduleCache(
  originIata: string,
  date: string,
  entries: ScheduleEntry[],
  destinationIata?: string,
): void {
  const key = scheduleKey(originIata, date, destinationIata);
  const ttl = scheduleTtlSeconds(date);
  if (ttl === null) {
    console.log(`[flightCache] schedule SKIP ${key} (past date)`);
    return;
  }
  try {
    console.log(`[flightCache] schedule SET ${key} ttl=${ttl}s entries=${entries.length}`);
    setCache(key, entries, ttl);
  } catch (err) {
    console.warn(`[flightCache] schedule write failed, continuing without cache ${key}`, err);
  }
}

// ---------- Price cache ----------

export function getPriceInfo(flightId: string): PriceInfo | undefined {
  const key = priceKey(flightId);
  try {
    const entry = getCache<PriceCacheEntry>(key);
    if (!entry) {
      console.log(`[flightCache] price MISS ${key}`);
      return undefined;
    }

    const ageSeconds = (Date.now() - new Date(entry.priceUpdatedAt).getTime()) / 1000;
    // Return 'cached' while age < softTtl; return 'stale' while age >= softTtl but < hardTtl (2×).
    // Stale entries remain in cache to support stale-while-revalidate — the caller triggers a
    // background refresh and returns the stale data immediately rather than blocking.
    const status: PriceStatus = ageSeconds > entry.softTtlSeconds ? 'stale' : 'cached';
    console.log(
      `[flightCache] price ${status === 'stale' ? 'STALE' : 'HIT'} ${key}` +
        ` (age=${Math.round(ageSeconds)}s softTtl=${entry.softTtlSeconds}s)`,
    );

    return {
      amount: entry.amount,
      currency: entry.currency,
      provider: entry.provider,
      deeplink: entry.deeplink,
      priceUpdatedAt: entry.priceUpdatedAt,
      priceStatus: status,
    };
  } catch (err) {
    console.warn(`[flightCache] price read failed, treating as MISS ${key}`, err);
    return undefined;
  }
}

export function setPriceInfo(
  flightId: string,
  info: Omit<PriceInfo, 'priceStatus'>,
  date: string,
): void {
  const key = priceKey(flightId);
  const softTtl = priceSoftTtlSeconds(date);
  const hardTtl = softTtl * 2;

  const entry: PriceCacheEntry = {
    amount: info.amount,
    currency: info.currency,
    provider: info.provider,
    deeplink: info.deeplink,
    priceUpdatedAt: info.priceUpdatedAt,
    softTtlSeconds: softTtl,
  };

  try {
    console.log(`[flightCache] price SET ${key} softTtl=${softTtl}s hardTtl=${hardTtl}s`);
    setCache(key, entry, hardTtl);
  } catch (err) {
    console.warn(`[flightCache] price write failed, continuing without cache ${key}`, err);
  }
}
