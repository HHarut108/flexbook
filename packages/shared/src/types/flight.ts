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

/**
 * Layover metadata between two consecutive flight segments. Captured so the
 * card can tell the user "3h FCO + 2h 40m SVQ" instead of the old viaIatas
 * list, and surface self-transfer warnings (the user must collect and
 * re-check bags, separate ticket risk if a flight is delayed).
 */
export interface Layover {
  iata: string;
  durationMinutes: number;
  /** True when the layover is between two different carriers and the
   *  itinerary is sold as separate tickets (no through-checked bags). */
  selfTransfer: boolean;
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
  /** Door-to-door duration: arrivalDatetime − departureDatetime in minutes,
   *  including layovers. This is the number the user actually cares about
   *  ("how long until I'm there?"). For flight-only time, use flightTimeMinutes. */
  durationMinutes: number;
  /** Sum of segment flight times in minutes (excludes layovers). Optional —
   *  callers that only need door-to-door duration don't need to populate this. */
  flightTimeMinutes?: number;
  airlineName: string;
  airlineCode?: string;
  /** All unique carriers operating the itinerary, in order of first appearance.
   *  Single-carrier itineraries have one entry; multi-carrier ones
   *  (e.g. Wizz Air Malta + Ryanair) reveal the mix. */
  carriers?: string[];
  stops: number;             // 0 = direct
  viaIatas?: string[];       // intermediate airport codes, e.g. ['BUD'] for BCN→BUD→EVN
  viaCoords?: Array<{ lat: number; lng: number }>;  // coordinates for each entry in viaIatas
  /** Per-layover metadata (one entry per stop). Aligned 1:1 with viaIatas
   *  when present. Empty/undefined for direct flights. */
  layovers?: Layover[];
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

/**
 * A stitched multi-city itinerary: N legs with different origin/destination
 * pairs, each booked as a separate one-way ticket. Unlike RoundTripOption,
 * the provider does not bundle these — Kiwi has no /multi-city endpoint, so
 * we fetch one-way fares per leg and pair the cheapest combinations on the
 * backend.
 *
 * `priceUsd` is the *sum* of `legs[i].priceUsd` (passenger multiplier already
 * applied per leg by the provider). Booking is per-leg: each leg has its own
 * `bookingUrl`. The frontend should make clear these are separate tickets —
 * no through-baggage, no missed-connection protection.
 */
export interface MultiCityOption {
  /** Stable id for the stitched trip — derived from the leg flightIds. */
  tripId: string;
  /** Legs in user-requested order (leg 1 first). */
  legs: FlightOption[];
  /** Sum of per-leg fares for the requested passenger count. */
  priceUsd: number;
}
