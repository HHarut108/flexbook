import { Airport } from './airport';
import { FlightOption } from './flight';

export interface TripLeg extends FlightOption {
  stopIndex: number;        // 1-based
  stayDurationDays: number; // 1–90
  nextDepartureDate: string; // YYYY-MM-DD (arrival + stay days)
  isReturn: boolean;
}

export type ItineraryStatus = 'planning' | 'complete';

export interface Itinerary {
  origin: Airport;
  legs: TripLeg[];
  status: ItineraryStatus;
  createdAt: string;         // ISO 8601
  completedAt?: string;      // ISO 8601
}
