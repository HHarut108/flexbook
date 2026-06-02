import { apiClient } from './client';

/**
 * When To Go — typed client for GET /flights/cheapest-day.
 * Mirrors backend/src/routes/cheapestDay.ts. Keep in sync.
 */

export interface CalendarDay {
  /** YYYY-MM-DD */
  date: string;
  priceUsd: number;
  currency: string;
  /** Deep link to the cheapest itinerary for this day (Kiwi). */
  bookingUrl?: string;
}

export interface CheapestDayResponse {
  origin: string;
  destination: string;
  start: string;
  end: string;
  /** Days with at least one priced itinerary, sorted ascending by date. */
  days: CalendarDay[];
  /** The single cheapest day across the requested window. */
  cheapest: CalendarDay | null;
  cacheStatus: 'hit' | 'fresh' | 'partial';
}

export async function fetchCheapestDay(
  origin: string,
  destination: string,
  start: string,
  end: string,
  signal?: AbortSignal,
): Promise<CheapestDayResponse> {
  const { data } = await apiClient.get<CheapestDayResponse>('/flights/cheapest-day', {
    params: { origin, destination, start, end },
    signal,
  });
  return data;
}
