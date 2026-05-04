import { WeatherSummary } from './weather';

export type PriceStatus = 'cached' | 'live' | 'stale';

export interface PriceInfo {
  amount: number;
  currency: string;
  provider: string;
  deeplink: string;
  priceUpdatedAt: string; // ISO 8601
  priceStatus: PriceStatus;
}

export interface FlightOption {
  flightId: string;
  originIata: string;
  originCity: string;
  destinationIata: string;
  destinationCity: string;
  destinationCountry: string;
  destinationLat: number;
  destinationLng: number;
  departureDatetime: string; // ISO 8601
  arrivalDatetime: string;   // ISO 8601
  durationMinutes: number;
  airlineName: string;
  airlineCode?: string;
  stops: number;             // 0 = direct
  viaIatas?: string[];       // intermediate airport codes, e.g. ['BUD'] for BCN→BUD→EVN
  priceUsd: number;
  bookingUrl: string;
  priceInfo?: PriceInfo;     // enriched price metadata populated by the cache layer
  weather?: WeatherSummary;
}
