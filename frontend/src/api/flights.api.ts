import { FlightOption } from '@fast-travel/shared';
import { apiClient, getApiMode } from './client';
import { mockFlights } from './mock-data';

export interface FlightSearchOptions {
  destination?: string;
  deduplicate?: boolean;
  limit?: number;
  /** Sort order: 'price' (cheapest), 'duration' (shortest), 'quality' (best overall). Default: 'price' */
  sort?: 'price' | 'duration' | 'quality';
  /** Max stopovers filter. 0 = direct only, 1 = max 1 stop. Omit for any. */
  maxStopovers?: number;
  /** 3-letter ISO currency code. Default: 'USD' */
  currency?: string;
  /** Cabin class. M=Economy, W=Premium Economy, C=Business, F=First */
  cabinClass?: 'M' | 'W' | 'C' | 'F';
}

export async function searchFlights(
  originIata: string,
  date: string,
  options: FlightSearchOptions = {},
): Promise<FlightOption[]> {
  const mode = getApiMode();

  // Real API call - pass mode to backend
  const { destination, deduplicate = true, limit = 10, sort, maxStopovers, currency, cabinClass } = options;
  const { data } = await apiClient.get<FlightOption[]>('/flights/search', {
    params: {
      originIata,
      date,
      deduplicate,
      limit,
      ...(destination && { destination }),
      ...(sort && { sort }),
      ...(maxStopovers !== undefined && { maxStopovers }),
      ...(currency && { currency }),
      ...(cabinClass && { cabinClass }),
      apiMode: mode, // Pass the current API mode
    },
  });
  return data;
}
