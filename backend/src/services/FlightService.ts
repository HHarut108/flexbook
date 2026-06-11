import { FlightOption, RoundTripOption, MultiCityOption } from '@fast-travel/shared';
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

export class FlightProviderConfigError extends Error {
  constructor() {
    super('No flight provider configured (set RAPIDAPI_KEY or SERPAPI_API_KEY)');
    this.name = 'FlightProviderConfigError';
  }
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
    flightTimeMinutes: f.flightTimeMinutes,
    airlineName: f.airlineName,
    airlineCode: f.airlineCode,
    carriers: f.carriers,
    stops: f.stops,
    viaIatas: f.viaIatas,
    layovers: f.layovers,
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

/**
 * How many cheapest one-way candidates to keep per leg before enumerating
 * trip combinations. Tuned so K^N stays bounded across the FE's max 6 legs
 * (worst case 4^6 = 4096 combos). Single-leg multi-city is invalid; the
 * service rejects fewer than 2 legs upstream.
 */
function perLegCandidateCount(legCount: number): number {
  if (legCount <= 2) return 10;
  if (legCount === 3) return 8;
  if (legCount === 4) return 6;
  if (legCount === 5) return 5;
  return 4;
}

/**
 * Cartesian product of per-leg candidates, summed by price, sorted ascending,
 * truncated to `limit`. Generates one MultiCityOption per combo with
 * leg-derived tripId so React can stable-key the list.
 */
function enumerateMultiCityTrips(perLeg: FlightOption[][], limit: number): MultiCityOption[] {
  const combos: { legs: FlightOption[]; total: number }[] = [];
  const N = perLeg.length;

  // Iterative index array — avoids recursion blow-up at 6 legs.
  const idx = new Array(N).fill(0);
  while (true) {
    const picked: FlightOption[] = [];
    let total = 0;
    for (let i = 0; i < N; i++) {
      const f = perLeg[i][idx[i]];
      picked.push(f);
      total += f.priceUsd;
    }
    combos.push({ legs: picked, total });

    // Advance the index array as a mixed-radix counter (rightmost wraps first).
    let k = N - 1;
    while (k >= 0) {
      idx[k]++;
      if (idx[k] < perLeg[k].length) break;
      idx[k] = 0;
      k--;
    }
    if (k < 0) break;
  }

  combos.sort((a, b) => a.total - b.total);

  return combos.slice(0, limit).map((c) => ({
    tripId: c.legs.map((l) => l.flightId).join('|'),
    legs: c.legs,
    priceUsd: c.total,
  }));
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
   * Multi-city search: a user-defined ordered list of legs (each with its own
   * origin/destination/date), stitched into bundled-display trip cards.
   *
   * Each leg's origin and destination is a list of IATAs (single airport, OR
   * all airports in a city group when the user picked "Rome (city)" etc).
   * Per leg we fan out across the (origin × destination) cartesian, merge
   * candidates by flightId, take the top-K cheapest, then enumerate trip
   * combinations across legs. K-per-leg keeps the combinatorial enumeration
   * bounded even for the 6-leg max:
   *
   *   2 legs → K=10  → 100 combos
   *   3 legs → K=8   → 512
   *   4 legs → K=6   → 1296
   *   5 legs → K=5   → 3125
   *   6 legs → K=4   → 4096
   *
   * Booking is per-leg (no airline bundling), so each leg keeps its own
   * bookingUrl and we return no trip-level deep link.
   */
  async searchMultiCity(
    legs: { originIatas: string[]; destinationIatas: string[]; date: string }[],
    options: KiwiSearchOptions & { limit?: number } = {},
    apiMode?: 'real' | 'mock',
  ): Promise<{ trips: MultiCityOption[] }> {
    if (legs.length < 2) {
      throw new Error('searchMultiCity requires at least 2 legs');
    }
    const { limit = 30, ...searchOptions } = options;

    const perLegBudget = perLegCandidateCount(legs.length);

    // Fetch all legs in parallel. Cache layer + provider fallback chain run
    // through the existing search() path so multi-city benefits from any
    // schedule cache hits without a separate code path.
    const perLeg = await Promise.all(
      legs.map(async (leg) => {
        const merged = await this.searchOneWayFanOut(
          leg.originIatas,
          leg.date,
          leg.destinationIatas,
          searchOptions,
          apiMode,
          false,
        );
        // searchOneWayFanOut returns price-ascending. Keep only top K for combo enumeration.
        return merged.flights.slice(0, perLegBudget);
      }),
    );

    // If any leg returned zero candidates, there's no trip to build.
    if (perLeg.some((leg) => leg.length === 0)) {
      return { trips: [] };
    }

    const trips = enumerateMultiCityTrips(perLeg, limit);
    return { trips };
  }

  /**
   * Fan-out wrapper around search(): given one or more origin IATAs and zero
   * or more destination IATAs, fire a search per (origin, destination?) pair
   * in parallel and merge results. Used when a user picks "Rome (city)" and
   * we need to surface flights from/to all member airports as one combined
   * list. Single-airport callers pass single-element arrays — same code path,
   * just one task in the Promise.all.
   *
   * Caps & cost: callers are expected to have already capped each side via
   * resolveLocation()'s CITY_AIRPORT_CAP (default 4). Worst-case cartesian is
   * 4×4 = 16 Kiwi requests; single-airport-both-sides is the unchanged 1
   * request.
   *
   * Merge: union flights by flightId (Kiwi IDs are globally unique per
   * itinerary). If the same flight surfaces from two pairs (rare — typically
   * only on through-routing), keep the cheapest price.
   *
   * cacheStatus: 'live' if ANY underlying call was live (so the FE knows
   * fresh data is mixed in); otherwise 'schedule_cached'.
   */
  async searchOneWayFanOut(
    originIatas: string[],
    date: string,
    destinationIatas: string[] | undefined,
    options: KiwiSearchOptions = {},
    apiMode?: 'real' | 'mock',
    bypassCache = false,
  ): Promise<FlightSearchResult> {
    if (originIatas.length === 0) {
      throw new Error('searchOneWayFanOut requires at least 1 origin');
    }
    const dests: (string | undefined)[] =
      destinationIatas && destinationIatas.length > 0 ? destinationIatas : [undefined];

    const tasks: Promise<FlightSearchResult>[] = [];
    for (const origin of originIatas) {
      const originCity = airportService.getByIata(origin)?.city.name ?? origin;
      for (const dest of dests) {
        tasks.push(
          this.search(origin, originCity, date, dest, false, options, apiMode, bypassCache),
        );
      }
    }

    const results = await Promise.all(tasks);
    const byId = new Map<string, FlightOption>();
    let anyLive = false;
    for (const r of results) {
      if (r.cacheStatus === 'live') anyLive = true;
      for (const f of r.flights) {
        const existing = byId.get(f.flightId);
        if (!existing || f.priceUsd < existing.priceUsd) byId.set(f.flightId, f);
      }
    }
    const merged = [...byId.values()].sort((a, b) => a.priceUsd - b.priceUsd);
    return { flights: merged, cacheStatus: anyLive ? 'live' : 'schedule_cached' };
  }

  /**
   * Fan-out wrapper around priceCalendar(): for city-origin or city-destination
   * "When To Go" queries, call priceCalendar once per (origin, destination) pair
   * and merge per-day results keeping the cheapest. Used by /flights/cheapest-day
   * so "Milan (city) → London (city)" surfaces the cheapest day across any
   * member-airport pairing.
   */
  async priceCalendarFanOut(
    originIatas: string[],
    destinationIatas: string[],
    startDate: string,
    endDate: string,
  ): Promise<PriceCalendarResult> {
    if (originIatas.length === 0 || destinationIatas.length === 0) {
      throw new Error('priceCalendarFanOut requires at least 1 origin and 1 destination');
    }
    const tasks: Promise<PriceCalendarResult>[] = [];
    for (const origin of originIatas) {
      for (const dest of destinationIatas) {
        tasks.push(this.priceCalendar(origin, dest, startDate, endDate));
      }
    }
    const results = await Promise.all(tasks);

    // Merge per-day, keep the cheapest across all (origin,dest) calendars.
    const byDay = new Map<string, CalendarDayResult>();
    for (const r of results) {
      for (const day of r.days) {
        const existing = byDay.get(day.date);
        if (!existing || day.priceUsd < existing.priceUsd) byDay.set(day.date, day);
      }
    }
    const days = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
    const cheapest = days.length === 0 ? null : days.reduce((a, b) => (a.priceUsd <= b.priceUsd ? a : b));

    return {
      origin: originIatas.join('|'),
      destination: destinationIatas.join('|'),
      start: startDate,
      end: endDate,
      days,
      cheapest,
      cacheStatus: 'live',
    };
  }

  /**
   * Fan-out wrapper around searchRoundTrip(): for a city-to-city round-trip,
   * issue one Kiwi /round-trip call per (origin, destination) pair, merge
   * pairs by tripId. Worst case is 4×4 = 16 calls with the CITY_AIRPORT_CAP.
   */
  async searchRoundTripFanOut(
    originIatas: string[],
    destinationIatas: string[],
    outboundDate: string,
    inboundDate: string,
    options: KiwiRoundTripOptions = {},
    apiMode?: 'real' | 'mock',
  ): Promise<{ pairs: RoundTripOption[] }> {
    if (originIatas.length === 0 || destinationIatas.length === 0) {
      throw new Error('searchRoundTripFanOut requires at least 1 origin and 1 destination');
    }
    const tasks: Promise<{ pairs: RoundTripOption[] }>[] = [];
    for (const origin of originIatas) {
      for (const dest of destinationIatas) {
        tasks.push(this.searchRoundTrip(origin, dest, outboundDate, inboundDate, options, apiMode));
      }
    }
    const results = await Promise.all(tasks);
    const byId = new Map<string, RoundTripOption>();
    for (const r of results) {
      for (const p of r.pairs) {
        const existing = byId.get(p.tripId);
        if (!existing || p.priceUsd < existing.priceUsd) byId.set(p.tripId, p);
      }
    }
    return { pairs: [...byId.values()].sort((a, b) => a.priceUsd - b.priceUsd) };
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
    if (chain.length === 0) {
      // Never silently fall back to mock in real environments — the user must
      // see a real error rather than fake flights. Tests keep the mock path
      // since they intentionally run with empty keys.
      if (config.NODE_ENV === 'test') return ['mock'];
      throw new FlightProviderConfigError();
    }
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
