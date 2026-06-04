import { FlightOption, RoundTripOption } from '@fast-travel/shared';
import { config } from '../config';
import {
  fetchRapidApiKiwiFlights,
  fetchRapidApiKiwiCalendar,
  fetchRapidApiKiwiRoundTrip,
  KiwiSearchOptions,
  KiwiCalendarDay,
  KiwiRoundTripOptions,
} from '../providers/RapidApiKiwiFlightProvider';
import { fetchSerpApiFlights, fetchSerpApiOpenFlights } from '../providers/SerpApiFlightProvider';
import { fetchMockFlights } from '../providers/MockFlightProvider';
import { airportService } from './AirportService';
import { increment, CallType } from '../utils/apiMetrics';
import { log } from '../utils/logger';
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

/** A single day's cheapest itinerary in the price calendar response. */
export interface CalendarDayResult {
  date: string;
  priceUsd: number;
  currency: string;
  bookingUrl?: string;
  /** Full itinerary metadata (airline, times, stops…) — shape mirrors
   *  KiwiCalendarItinerary so the frontend can render a flight card + map. */
  itinerary?: {
    originIata: string;
    originCity: string;
    originLat: number;
    originLng: number;
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
    viaCoords?: { lat: number; lng: number }[];
  };
}

export interface PriceCalendarResult {
  origin: string;
  destination: string;
  start: string;
  end: string;
  /** All days in the requested range that have at least one priced itinerary. */
  days: CalendarDayResult[];
  /** Cheapest day across the requested range, or null if no flights anywhere. */
  cheapest: CalendarDayResult | null;
  /** Always 'live' for now — the persistent cache layer was removed so prices
   *  could not get stale on the user; kept on the envelope for future
   *  stale-while-revalidate work. */
  cacheStatus: 'live';
}

const PRICE_CALENDAR_CHUNK_DAYS = 14;

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

    // Dedup is "one cheapest flight per destination IATA" — only meaningful
    // for "anywhere" searches (no destinationIata) where the user expects a
    // single row per city. When destinationIata is set every result already
    // has the same destinationIata, so dedup collapses the entire list to one
    // result. Force it off in that case regardless of the caller's request.
    const effectiveDedup = deduplicate && !destinationIata;

    const cachedSchedule = bypassCache ? undefined : await getScheduleCache(originIata, date, destinationIata, country);
    if (cachedSchedule) {
      const { flights, hasStale, hasMissing } = await attachCachedPrices(cachedSchedule);
      // Fall through to a live fetch when no flights remain after dropping
      // entries with no cached price — otherwise the user sees an empty list.
      if (flights.length > 0) {
        if (hasStale || hasMissing) {
          this.refreshInBackground({ originIata, originCity, date, destinationIata, chain, options, deduplicate: effectiveDedup });
        }
        return { flights, cacheStatus: 'schedule_cached' };
      }
    }

    const { raw, usedProvider } = await this.callWithFallback(
      chain, originIata, originCity, date, destinationIata, options,
    );
    const processed = this.processFlights(raw, originIata, effectiveDedup);

    setScheduleCache(originIata, date, processed.map(toScheduleEntry), destinationIata, country);
    const withPrices = storePricesAndAttach(processed, usedProvider, date);

    return { flights: withPrices, cacheStatus: 'live' };
  }

  /**
   * When To Go feature: return per-day cheapest fares for (origin, destination)
   * across [startDate, endDate], plus the single cheapest day in that window.
   *
   * No persistent cache. Each call hits Kiwi fresh — flight prices move too
   * much for a 7-day cache to be trustworthy, and the user-visible answer is
   * literally "the cheapest day," which has to be live. The PriceCalendarDay
   * table remains in the schema as forward-investment for a future
   * stale-while-revalidate layer, but is unused on the read/write path today.
   *
   * Single-provider (Kiwi-only) is intentional: Kiwi's range mode is the only
   * source we've validated that returns per-day cheapest in one HTTP call
   * (see scripts/spike-calendar.ts). Long windows are chunked to ≤14 days so
   * the price-asc-truncated response still covers every day.
   */
  async priceCalendar(
    originIata: string,
    destinationIata: string,
    startDate: string,
    endDate: string,
  ): Promise<PriceCalendarResult> {
    const allDates = enumerateDates(startDate, endDate);
    // Chunk the *entire* window — we always refetch since there's no cache.
    const chunks = chunkMissingDates(allDates, PRICE_CALENDAR_CHUNK_DAYS);

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

    // De-dupe across chunk boundaries by taking the lowest price per day.
    const byDay = new Map<string, KiwiCalendarDay>();
    for (const day of fetched) {
      const existing = byDay.get(day.date);
      if (!existing || day.priceUsd < existing.priceUsd) byDay.set(day.date, day);
    }

    const days: CalendarDayResult[] = [...byDay.values()]
      .filter((d) => d.date >= startDate && d.date <= endDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        date: d.date,
        priceUsd: d.priceUsd,
        currency: d.currency,
        bookingUrl: d.bookingUrl,
        itinerary: d.itinerary,
      }));

    const cheapest = days.length === 0
      ? null
      : days.reduce((a, b) => (a.priceUsd <= b.priceUsd ? a : b));

    return {
      origin: originIata,
      destination: destinationIata,
      start: startDate,
      end: endDate,
      days,
      cheapest,
      cacheStatus: 'live',
    };
  }

  /**
   * Bundled round-trip search via Kiwi's /round-trip endpoint. Returns pairs of
   * (outbound, inbound) sold together at a single fare — typically cheaper than
   * two independently-purchased one-ways.
   *
   * No cache: pair prices move per-airline-bundle and we have no per-pair cache
   * layer. Kiwi-only: SerpAPI has a different round-trip surface that would
   * need its own mapper; if Kiwi fails, we currently error out rather than
   * silently fall back to two one-way searches (which would defeat the point).
   */
  async searchRoundTrip(
    originIata: string,
    destinationIata: string,
    outboundDate: string,
    inboundDate: string,
    options: KiwiRoundTripOptions = {},
    apiMode?: 'real' | 'mock',
  ): Promise<{ pairs: RoundTripOption[] }> {
    if (apiMode === 'mock' || !config.RAPIDAPI_KEY) {
      const pairs = await this.buildMockRoundTrips(originIata, destinationIata, outboundDate, inboundDate, options);
      return { pairs };
    }

    increment('rapidapi-kiwi', 'primary');
    const pairs = await fetchRapidApiKiwiRoundTrip(
      originIata,
      destinationIata,
      outboundDate,
      inboundDate,
      options,
    );
    return { pairs };
  }

  /**
   * Mock-mode round-trip: pair the cheapest mock outbound with the cheapest
   * mock inbound and synthesize a pretend bundled fare. Used in dev/tests so
   * the frontend integration can run without a RapidAPI key.
   */
  private async buildMockRoundTrips(
    originIata: string,
    destinationIata: string,
    outboundDate: string,
    inboundDate: string,
    options: KiwiRoundTripOptions,
  ): Promise<RoundTripOption[]> {
    const originCity = airportService.getByIata(originIata)?.city.name ?? originIata;
    const destCity = airportService.getByIata(destinationIata)?.city.name ?? destinationIata;
    const passengers = options.passengers ?? 1;
    const limit = options.limit ?? 15;

    const outboundLegs = (await fetchMockFlights(originIata, originCity, outboundDate, destinationIata)).slice(0, limit);
    const inboundLegs = (await fetchMockFlights(destinationIata, destCity, inboundDate, originIata)).slice(0, limit);
    const pairs: RoundTripOption[] = [];
    const pairCount = Math.min(outboundLegs.length, inboundLegs.length, limit);
    for (let i = 0; i < pairCount; i++) {
      const out = outboundLegs[i];
      const ret = inboundLegs[i];
      // Mock bundled fare = 90% of the sum, so the round-trip discount is visible.
      const bundledTotal = Math.round((out.priceUsd + ret.priceUsd) * 0.9 * passengers);
      const tripId = `mock-rt:${out.flightId}:${ret.flightId}`;
      const outbound: FlightOption = { ...out, flightId: `${tripId}:out`, priceUsd: bundledTotal };
      const inbound: FlightOption = { ...ret, flightId: `${tripId}:in`, priceUsd: bundledTotal };
      pairs.push({
        tripId,
        outbound,
        inbound,
        priceUsd: bundledTotal,
        bookingUrl: out.bookingUrl || ret.bookingUrl || '',
      });
    }
    return pairs;
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
