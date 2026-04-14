import { WeatherSummary } from './weather';

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
  weather?: WeatherSummary;
}
