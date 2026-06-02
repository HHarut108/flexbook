import { FlightOption } from '@fast-travel/shared';
import { config } from '../config';
import {
  fetchRapidApiKiwiFlights,
  fetchRapidApiKiwiCalendar,
  KiwiSearchOptions,
  KiwiCalendarDay,
} from '../providers/RapidApiKiwiFlightProvider';
import { fetchSerpApiFlights, fetchSerpApiOpenFlights } from '../providers/SerpApiFlightProvider';
import { fetchMockFlights } from '../providers/MockFlightProvider';
import { airportService } from './AirportService';
import { increment, CallType } from '../utils/apiMetrics';
import { log } from '../utils/logger';
import { db } from '../db';
import {
  ScheduleEntry,
  getScheduleCache,
  setScheduleCache,
  getPriceInfo,
  setPriceInfo,
} from '../utils/flightCache';

export interface FlightSearchResult {
  flights: FlightOption[];
  cacheStatus: 'live' | 'schedule_cached';
}

type Provider = 'rapidapi-kiwi' | 'serpapi' | 'mock';

function deduplicateByDestination(flights: FlightOption[]): FlightOption[] {
  const cheapestByDest = new Map<string, FlightOption>();
  for (const flight of flights) {
    const existing = cheapestByDest.get(flight.destinationIata);
    if (!existing || flight.priceUsd < existing.priceUsd) {
      cheapestByDest.set(flight.destinationIata, flight);
    }
  }
  return Array.from(cheapestByDest.values());
}

function enrichWithAirportData(
  flights: Omit<FlightOption, 'destinationCountry' | 'destinationLat' | 'destinationLng'>[],
): FlightOption[] {
  return flights.map((f) => {
    const destAirport = airportService.getByIata(f.destinationIata);
    const origAirport = airportService.getByIata(f.originIata);
    return {
      ...f,
      originCity: origAirport?.city.name ?? f.originCity,
      destinationCity: destAirport?.city.name ?? f.destinationCity,
      destinationCountry: destAirport?.city.countryName ?? '',
      destinationLat: destAirport?.city.lat ?? 0,
      destinationLng: destAirport?.city.lng ?? 0,
    };
  });
}

function toScheduleEntry(f: FlightOption): ScheduleEntry {
  return {
    flightId: f.flightId,
    originIata: f.originIata,
    originCity: f.originCity,
    destinationIata: f.destinationIata,
    destinationCity: f.destinationCity,
    destinationCountry: f.destinationCountry,
    destinationLat: f.destinationLat,
    destinationLng: f.destinationLng,
    departureDatetime: f.departureDatetime,
    arrivalDatetime: f.arrivalDatetime,
    durationMinutes: f.durationMinutes,
    airlineName: f.airlineName,
    airlineCode: f.airlineCode,
    stops: f.stops,
    viaIatas: f.viaIatas,
  };
}

function storePricesAndAttach(
  flights: FlightOption[],
  providerName: string,
  date: string,
): FlightOption[] {
  const now = new Date().toISOString();
  return flights.map((f) => {
    setPriceInfo(
      f.flightId,
      { amount: f.priceUsd, currency: 'USD', provider: providerName, deeplink: f.bookingUrl, priceUpdatedAt: now },
      date,
    );
    return {
      ...f,
      priceInfo: {
        amount: f.priceUsd,
        currency: 'USD',
        provider: providerName,
        deeplink: f.bookingUrl,
        priceUpdatedAt: now,
        priceStatus: 'live' as const,
      },
    };
  });
}

async function attachCachedPrices(
  entries: ScheduleEntry[],
): Promise<{ flights: FlightOption[]; hasStale: boolean; hasMissing: boolean }> {
  let hasStale = false;
  let hasMissing = false;
  const resolved = await Promise.all(entries.map(async (entry) => {
    const priceInfo = await getPriceInfo(entry.flightId);
    if (!priceInfo) {
      hasMissing = true;
      return null;
    }
    if (priceInfo.priceStatus === 'stale') hasStale = true;
    return {
      ...entry,
      priceUsd: priceInfo.amount,
      bookingUrl: priceInfo.deeplink,
      priceInfo,
    } as FlightOption;
  }));
  const flights = resolved.filter((f): f is FlightOption => f !== null);
  return { flights, hasStale, hasMissing };
}

// ─── Calendar helpers ──────────────────────────────────────────────────────────
// Inline here because they're only used by priceCalendar. If a second consumer
// appears, lift them into utils/calendarRange.ts.

/** Inclusive enumeration of YYYY-MM-DD strings between start and end. */
function enumerateDates(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(start + 'T00:00:00Z');
  const last = new Date(end + 'T00:00:00Z');
  while (cur.getTime() <= last.getTime()) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/**
 * Group missing dates into contiguous runs and split runs longer than
 * `maxChunkDays` into ≤maxChunkDays-day windows. Kiwi truncates to ~25
 * cheapest itineraries per call, so chunking keeps per-day coverage tight.
 */
function chunkMissingDates(missing: string[], maxChunkDays: number): [string, string][] {
  if (missing.length === 0) return [];
  const sorted = [...missing].sort();
  const chunks: [string, string][] = [];

  let chunkStart = sorted[0];
  let prev = sorted[0];

  const flush = (end: string) => {
    // Split into ≤maxChunkDays chunks. Walk by N days from chunkStart.
    let s = chunkStart;
    const lastDate = new Date(end + 'T00:00:00Z');
    // Bound the loop defensively: even a 180-day window divided into 1-day
    // chunks is only 180 iterations — 1000 is far more than we'd ever need.
    for (let safety = 0; safety < 1000; safety++) {
      const startDate = new Date(s + 'T00:00:00Z');
      const tentativeEnd = new Date(startDate);
      tentativeEnd.setUTCDate(tentativeEnd.getUTCDate() + maxChunkDays - 1);
      if (tentativeEnd.getTime() >= lastDate.getTime()) {
        chunks.push([s, lastDate.toISOString().slice(0, 10)]);
        return;
      }
      chunks.push([s, tentativeEnd.toISOString().slice(0, 10)]);
      const nextStart = new Date(tentativeEnd);
      nextStart.setUTCDate(nextStart.getUTCDate() + 1);
      s = nextStart.toISOString().slice(0, 10);
    }
  };

  for (let i = 1; i < sorted.length; i++) {
    const d = new Date(sorted[i] + 'T00:00:00Z');
    const p = new Date(prev + 'T00:00:00Z');
    const gapDays = Math.round((d.getTime() - p.getTime()) / 86400000);
    if (gapDays > 1) {
      flush(prev);
      chunkStart = sorted[i];
    }
    prev = sorted[i];
  }
  flush(prev);

  return chunks;
}

export interface PriceCalendarResult {
  origin: string;
  destination: string;
  start: string;
  end: string;
  /** All days in the requested range that have a price. Sorted by date asc. */
  days: { date: string; priceUsd: number; currency: string; bookingUrl?: string }[];
  /** Cheapest day across the requested range, or null if no flights anywhere. */
  cheapest: { date: string; priceUsd: number; currency: string; bookingUrl?: string } | null;
  cacheStatus: 'hit' | 'fresh' | 'partial';
}

const PRICE_CALENDAR_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PRICE_CALENDAR_CHUNK_DAYS = 14;

function buildCalendarResult(
  origin: string,
  destination: string,
  start: string,
  end: string,
  rows: { date: string; cheapestUsd: number | null; currency: string; bookingUrl: string | null }[],
  cacheStatus: PriceCalendarResult['cacheStatus'],
): PriceCalendarResult {
  const days = rows
    .filter((r): r is typeof r & { cheapestUsd: number } => r.cheapestUsd !== null && r.cheapestUsd > 0)
    .map((r) => ({
      date: r.date,
      priceUsd: r.cheapestUsd,
      currency: r.currency,
      bookingUrl: r.bookingUrl ?? undefined,
    }));

  const cheapest = days.length === 0
    ? null
    : days.reduce((a, b) => (a.priceUsd <= b.priceUsd ? a : b));

  return { origin, destination, start, end, days, cheapest, cacheStatus };
}

export class FlightService {
  async search(
    originIata: string,
    originCity: string,
    date: string,
    destinationIata?: string,
    deduplicate = true,
    options: KiwiSearchOptions = {},
    apiMode?: 'real' | 'mock',
    bypassCache = false,
  ): Promise<FlightSearchResult> {
    const chain = this.providerChain(apiMode);
    const country = options.country;

    const cachedSchedule = bypassCache ? undefined : await getScheduleCache(originIata, date, destinationIata, country);
    if (cachedSchedule) {
      const { flights, hasStale, hasMissing } = await attachCachedPrices(cachedSchedule);
      // Fall through to a live fetch when no flights remain after dropping
      // entries with no cached price — otherwise the user sees an empty list.
      if (flights.length > 0) {
        if (hasStale || hasMissing) {
          this.refreshInBackground({ originIata, originCity, date, destinationIata, chain, options, deduplicate });
        }
        return { flights, cacheStatus: 'schedule_cached' };
      }
    }

    const { raw, usedProvider } = await this.callWithFallback(
      chain, originIata, originCity, date, destinationIata, options,
    );
    const processed = this.processFlights(raw, originIata, deduplicate);

    setScheduleCache(originIata, date, processed.map(toScheduleEntry), destinationIata, country);
    const withPrices = storePricesAndAttach(processed, usedProvider, date);

    return { flights: withPrices, cacheStatus: 'live' };
  }

  /**
   * When To Go feature: return per-day cheapest fares for (origin, destination)
   * across [startDate, endDate], plus the single cheapest day in that window.
   *
   * Cache strategy:
   *   - Lookup PriceCalendarDay rows in the range with ttlUntil > now.
   *   - If every day in the range is present, return 'hit' immediately.
   *   - Otherwise, fetch the missing dates from Kiwi (chunked to ≤14 days each
   *     so the price-asc-truncated response still covers every day), upsert a
   *     row per requested date (NULL price = "checked, no flights"), then
   *     return the merged result.
   *
   * The single-provider chain (Kiwi-only) is intentional for v1 — the spike
   * confirmed Kiwi's range mode is the cheapest viable source, and SerpAPI's
   * `price_insights` payload doesn't expose per-day cheapest fares for an
   * arbitrary window. A SerpAPI fallback could be added in a later phase.
   */
  async priceCalendar(
    originIata: string,
    destinationIata: string,
    startDate: string,
    endDate: string,
  ): Promise<PriceCalendarResult> {
    const allDates = enumerateDates(startDate, endDate);
    const now = new Date();

    const cached = await db.priceCalendarDay.findMany({
      where: {
        origin: originIata,
        destination: destinationIata,
        date: { in: allDates },
        ttlUntil: { gt: now },
      },
      orderBy: { date: 'asc' },
    });

    const cachedDates = new Set(cached.map((r) => r.date));
    const missingDates = allDates.filter((d) => !cachedDates.has(d));

    if (missingDates.length === 0) {
      return buildCalendarResult(originIata, destinationIata, startDate, endDate, cached, 'hit');
    }

    const hadAnyCached = cached.length > 0;
    const chunks = chunkMissingDates(missingDates, PRICE_CALENDAR_CHUNK_DAYS);

    increment('rapidapi-kiwi', 'primary');
    const fetched: KiwiCalendarDay[] = [];
    try {
      for (const [s, e] of chunks) {
        const days = await fetchRapidApiKiwiCalendar(originIata, destinationIata, s, e, 'USD');
        fetched.push(...days);
      }
    } catch (err) {
      log().error(
        { originIata, destinationIata, startDate, endDate, err },
        'FlightService.priceCalendar Kiwi call failed',
      );
      throw err;
    }

    const ttlUntil = new Date(Date.now() + PRICE_CALENDAR_TTL_MS);
    const fetchedByDate = new Map(fetched.map((d) => [d.date, d]));

    // Persist a row for EVERY missing date in the chunks we fetched — including
    // days with no priced itineraries (NULL price). The NULL sentinel keeps us
    // from refetching the same gap day-after-day before the TTL expires.
    const datesToPersist = new Set<string>();
    for (const [s, e] of chunks) {
      for (const d of enumerateDates(s, e)) datesToPersist.add(d);
    }

    await Promise.all(
      [...datesToPersist].map(async (date) => {
        const hit = fetchedByDate.get(date);
        await db.priceCalendarDay.upsert({
          where: {
            origin_destination_date: {
              origin: originIata,
              destination: destinationIata,
              date,
            },
          },
          create: {
            origin: originIata,
            destination: destinationIata,
            date,
            cheapestUsd: hit?.priceUsd ?? null,
            currency: hit?.currency ?? 'USD',
            bookingUrl: hit?.bookingUrl ?? null,
            source: 'kiwi-range',
            ttlUntil,
          },
          update: {
            cheapestUsd: hit?.priceUsd ?? null,
            currency: hit?.currency ?? 'USD',
            bookingUrl: hit?.bookingUrl ?? null,
            source: 'kiwi-range',
            sampledAt: new Date(),
            ttlUntil,
          },
        });
      }),
    );

    const final = await db.priceCalendarDay.findMany({
      where: {
        origin: originIata,
        destination: destinationIata,
        date: { in: allDates },
      },
      orderBy: { date: 'asc' },
    });

    return buildCalendarResult(
      originIata,
      destinationIata,
      startDate,
      endDate,
      final,
      hadAnyCached ? 'partial' : 'fresh',
    );
  }

  /** Ordered list of providers to try, from primary to fallback. */
  private providerChain(apiMode?: 'real' | 'mock'): Provider[] {
    if (apiMode === 'mock') return ['mock'];
    const chain: Provider[] = [];
    if (config.RAPIDAPI_KEY) chain.push('rapidapi-kiwi');
    if (config.SERPAPI_API_KEY) chain.push('serpapi');
    if (chain.length === 0) chain.push('mock');
    return chain;
  }

  /**
   * Iterates through the provider chain until one succeeds.
   * Increments the metric with 'primary' for the first provider and 'fallback' for any retry.
   */
  private async callWithFallback(
    chain: Provider[],
    originIata: string,
    originCity: string,
    date: string,
    destinationIata: string | undefined,
    options: KiwiSearchOptions,
  ): Promise<{ raw: FlightOption[]; usedProvider: string }> {
    let lastError: unknown;
    for (let i = 0; i < chain.length; i++) {
      const provider = chain[i];
      const callType: CallType = i === 0 ? 'primary' : 'fallback';
      increment(provider, callType);
      try {
        const raw = await this.callProvider(provider, originIata, originCity, date, destinationIata, options);
        return { raw, usedProvider: provider };
      } catch (err) {
        lastError = err;
        if (i < chain.length - 1) {
          log().warn(
            { provider, nextProvider: chain[i + 1], err: err instanceof Error ? err.message : err },
            'FlightService provider failed, falling back',
          );
        }
      }
    }
    throw lastError;
  }

  private async callProvider(
    provider: Provider,
    originIata: string,
    originCity: string,
    date: string,
    destinationIata: string | undefined,
    options: KiwiSearchOptions,
  ): Promise<FlightOption[]> {
    const { currency = 'USD', passengers = 1 } = options;
    if (provider === 'rapidapi-kiwi') {
      return fetchRapidApiKiwiFlights(originIata, date, destinationIata, options);
    }
    if (provider === 'serpapi') {
      const partial = destinationIata
        ? await fetchSerpApiFlights(originIata, destinationIata, date, currency, passengers)
        : await fetchSerpApiOpenFlights(originIata, date, currency, passengers);
      return enrichWithAirportData(partial);
    }
    return fetchMockFlights(originIata, originCity, date, destinationIata);
  }

  private processFlights(raw: FlightOption[], originIata: string, deduplicate: boolean): FlightOption[] {
    const filtered = raw.filter((f) => f.destinationIata !== originIata);
    const deduped = deduplicate ? deduplicateByDestination(filtered) : filtered;
    return deduped.sort((a, b) => a.priceUsd - b.priceUsd);
  }

  private refreshInBackground(params: {
    originIata: string;
    originCity: string;
    date: string;
    destinationIata?: string;
    chain: Provider[];
    options: KiwiSearchOptions;
    deduplicate: boolean;
  }): void {
    const { originIata, originCity, date, destinationIata, chain, options, deduplicate } = params;
    void (async () => {
      try {
        const { raw, usedProvider } = await this.callWithFallback(
          chain, originIata, originCity, date, destinationIata, options,
        );
        const processed = this.processFlights(raw, originIata, deduplicate);
        setScheduleCache(originIata, date, processed.map(toScheduleEntry), destinationIata, options.country);
        storePricesAndAttach(processed, usedProvider, date);
      } catch (err) {
        log().warn({ originIata, date, err }, 'flightCache background refresh failed');
      }
    })();
  }
}

export const flightService = new FlightService();
