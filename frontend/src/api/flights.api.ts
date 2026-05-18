import { FlightOption } from '@fast-travel/shared';
import { apiClient, getApiMode } from './client';
import { mockFlights } from './mock-data';

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
}

export async function searchFlights(
  originIata: string,
  date: string,
  options: FlightSearchOptions = {},
): Promise<FlightOption[]> {
  const mode = getApiMode();

  // Real API call - pass mode to backend
  const { destination, deduplicate = true, sort, maxStopovers, currency, cabinClass, passengers, fresh } = options;
  // Debug opt-in: `?fresh=1` anywhere in the app's URL forces a live provider call,
  // bypassing the backend schedule cache. Useful when comparing against Kiwi.com.
  const urlFresh = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('fresh') === '1';
  const bypassCache = fresh || urlFresh;
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
        apiMode: mode,
      },
    },
  );
  return data.results;
}
