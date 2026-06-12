import { apiClient } from './client';

/**
 * When to Go — typed client for GET /flights/cheapest-day.
 * Mirrors backend/src/routes/cheapestDay.ts. Keep in sync.
 */

/** Per-day cheapest itinerary metadata that powers the rich card + map. */
export interface CalendarDayItinerary {
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
}

export interface CalendarDay {
  /** YYYY-MM-DD */
  date: string;
  priceUsd: number;
  currency: string;
  /** Deep link to the cheapest itinerary for this day (Kiwi). */
  bookingUrl?: string;
  /** Full itinerary metadata for the cheapest itinerary on this day. */
  itinerary?: CalendarDayItinerary;
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
  /** Always 'live' — see backend FlightService.priceCalendar. */
  cacheStatus: 'live';
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
