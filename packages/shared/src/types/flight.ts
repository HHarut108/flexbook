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
  viaCoords?: Array<{ lat: number; lng: number }>;  // coordinates for each entry in viaIatas
  priceUsd: number;
  bookingUrl: string;
  priceInfo?: PriceInfo;     // enriched price metadata populated by the cache layer
  weather?: WeatherSummary;
}

/**
 * A bundled round-trip itinerary — outbound + return paired by the provider
 * at a single combined price. Airlines often bundle these cheaper than two
 * separately-purchased one-ways, so we keep the pair intact rather than
 * splitting the response back into independent legs.
 *
 * `priceUsd` is the *combined* total. `outbound.priceUsd` and
 * `inbound.priceUsd` echo it for compatibility with code that consumes a
 * single FlightOption — they should not be summed.
 */
export interface RoundTripOption {
  /** Stable id for the bundled pair. */
  tripId: string;
  outbound: FlightOption;
  inbound: FlightOption;
  /** Combined total fare (already includes passenger multiplier when provided). */
  priceUsd: number;
  /** Single deep link that books the whole pair. */
  bookingUrl: string;
}
