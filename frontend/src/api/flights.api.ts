import { FlightOption, RoundTripOption, MultiCityOption } from '@fast-travel/shared';
import { apiClient, getApiMode } from './client';

export interface FlightSearchOptions {
  destination?: string;
  deduplicate?: boolean;
  /** Sort order: 'price' (cheapest), 'duration' (shortest), 'quality' (best overall). Default: 'price' */
  sort?: 'price' | 'duration' | 'quality';
  /** Max stopovers filter. 0 = direct only, 1 = max 1 stop. Omit for any. */
  maxStopovers?: number;
  /** 3-letter ISO currency code. Default: 'USD' */
  currency?: string;
  /** Cabin class. M=Economy, W=Premium Economy, C=Business, F=First */
  cabinClass?: 'M' | 'W' | 'C' | 'F';
  /** Number of adult passengers (1–9). Default: 1 */
  passengers?: number;
  /** Bypass the backend schedule cache and force a live provider call. Debug-only. */
  fresh?: boolean;
  /** 2-letter ISO country code. Tells the backend to query `destination=Country:XX`
   *  instead of the "anywhere" endpoint — surfaces routes that the unfiltered
   *  search misses (e.g. Wizz LCC routes). Debug-only. */
  country?: string;
}

export async function searchFlights(
  originIata: string,
  date: string,
  options: FlightSearchOptions = {},
): Promise<FlightOption[]> {
  const mode = getApiMode();

  // Real API call - pass mode to backend
  const { destination, deduplicate = true, sort, maxStopovers, currency, cabinClass, passengers, fresh, country } = options;
  // Debug opt-in: `?fresh=1` anywhere in the app's URL forces a live provider call,
  // bypassing the backend schedule cache. Useful when comparing against Kiwi.com.
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const urlFresh = urlParams?.get('fresh') === '1';
  const bypassCache = fresh || urlFresh;
  // Debug opt-in: `?country=DE` (ISO 3166 alpha-2) tells the backend to use
  // Kiwi's `destination=Country:XX` endpoint — surfaces routes the anywhere
  // search misses (e.g. Wizz EVN→FMM).
  const urlCountry = urlParams?.get('country')?.toUpperCase();
  const effectiveCountry = country?.toUpperCase() || (urlCountry && urlCountry.length === 2 ? urlCountry : undefined);
  const { data } = await apiClient.get<{ origin: string; date: string; cacheStatus: 'live' | 'schedule_cached'; results: FlightOption[] }>(
    '/flights/search',
    {
      params: {
        originIata,
        date,
        deduplicate,
        ...(destination && { destination }),
        ...(sort && { sort }),
        ...(maxStopovers !== undefined && { maxStopovers }),
        ...(currency && { currency }),
        ...(cabinClass && { cabinClass }),
        ...(passengers !== undefined && { passengers }),
        ...(bypassCache && { fresh: true }),
        ...(effectiveCountry && { country: effectiveCountry }),
        apiMode: mode,
      },
    },
  );
  return data.results;
}

export interface RoundTripSearchOptions {
  passengers?: number;
  currency?: string;
  cabinClass?: 'M' | 'W' | 'C' | 'F';
  /** Max stopovers per leg. 0 = direct only. */
  maxStopovers?: number;
  /** Cap on bundled pairs returned by the provider. Default backend cap: 15. */
  limit?: number;
}

/**
 * Bundled round-trip search. Each result is an outbound + inbound pair sold
 * together at one combined fare (often cheaper than two separate one-ways).
 */
export async function searchRoundTrip(
  originIata: string,
  destinationIata: string,
  outboundDate: string,
  inboundDate: string,
  options: RoundTripSearchOptions = {},
): Promise<RoundTripOption[]> {
  const mode = getApiMode();
  const { passengers, currency, cabinClass, maxStopovers, limit } = options;
  const { data } = await apiClient.get<{
    origin: string;
    destination: string;
    outboundDate: string;
    inboundDate: string;
    pairs: RoundTripOption[];
  }>('/flights/round-trip', {
    params: {
      originIata,
      destinationIata,
      outboundDate,
      inboundDate,
      ...(passengers !== undefined && { passengers }),
      ...(currency && { currency }),
      ...(cabinClass && { cabinClass }),
      ...(maxStopovers !== undefined && { maxStopovers }),
      ...(limit !== undefined && { limit }),
      apiMode: mode,
    },
  });
  return data.pairs;
}

export interface MultiCitySearchOptions {
  passengers?: number;
  currency?: string;
  cabinClass?: 'M' | 'W' | 'C' | 'F';
  maxStopovers?: number;
  /** Cap on bundled trips returned. Default backend cap: 30. */
  limit?: number;
}

/**
 * Stitched multi-city search. The backend fires one /one-way call per leg in
 * parallel, then enumerates trip combinations (top-K candidates per leg) and
 * returns the cheapest N trips. Each trip's `priceUsd` is the sum of its
 * legs' fares — Kiwi has no bundled multi-city endpoint, so legs are booked
 * as separate one-way tickets.
 */
export async function searchMultiCity(
  legs: { origin: string; destination: string; date: string }[],
  options: MultiCitySearchOptions = {},
): Promise<MultiCityOption[]> {
  const mode = getApiMode();
  const { passengers, currency, cabinClass, maxStopovers, limit } = options;
  // Preserve "@<cityId>" markers verbatim — they're lowercase. Plain IATA
  // values are uppercased; mixed origins/destinations work either way.
  const normalize = (v: string) => (v.startsWith('@') ? v : v.toUpperCase());
  const encodedLegs = legs
    .map((leg) => `${normalize(leg.origin)},${normalize(leg.destination)},${leg.date}`)
    .join('|');
  const { data } = await apiClient.get<{
    legs: { originIata: string; destinationIata: string; date: string }[];
    trips: MultiCityOption[];
  }>('/flights/multi-city', {
    params: {
      legs: encodedLegs,
      ...(passengers !== undefined && { passengers }),
      ...(currency && { currency }),
      ...(cabinClass && { cabinClass }),
      ...(maxStopovers !== undefined && { maxStopovers }),
      ...(limit !== undefined && { limit }),
      apiMode: mode,
    },
  });
  return data.trips;
}
