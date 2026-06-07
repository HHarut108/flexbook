import { Airport } from './airport';
import { FlightOption } from './flight';

export interface TripLeg extends FlightOption {
  stopIndex: number;        // 1-based
  stayDurationDays: number; // 1–90
  nextDepartureDate: string; // YYYY-MM-DD (arrival + stay days)
  isReturn: boolean;
}

export type ItineraryStatus = 'planning' | 'complete';

export type PickKind = 'stay' | 'do' | 'eat';

/** A user-tagged Stay/Do/Eat item from the destination guide. The item is
 *  identified by (city, kind, name) — names are unique within a kind+city
 *  in the /city-guide payload, so this is enough to round-trip across
 *  reloads without storing the full place blob. */
export interface Pick {
  city: string;
  kind: PickKind;
  name: string;
}

export interface Itinerary {
  origin: Airport;
  /** Set when the user picked a multi-airport city (e.g. "Rome (all airports)")
   *  rather than a specific airport. `origin` then holds the city's busiest
   *  member airport (used for the map and labels), while `originCityId`
   *  preserves the city pick so flight searches still fan out across all
   *  member airports. Absent for plain-airport picks. */
  originCityId?: string;
  legs: TripLeg[];
  status: ItineraryStatus;
  createdAt: string;         // ISO 8601
  completedAt?: string;      // ISO 8601
  passengers: number;        // 1–9 adults
  picks?: Pick[];
}
