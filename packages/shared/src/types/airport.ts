import { City } from './city';

export interface Airport {
  iata: string;
  name: string;
  city: City;
  timezone: string;
  distanceKm?: number;
}

/**
 * Response shape for /airports/search. `fallback` is set when the user's
 * query didn't match any commercial airport but resolved to a known place
 * via the wider gazetteer — in that case `results` holds the nearest
 * commercial airports within `fallback.radiusKm`, sorted by distance.
 */
export interface AirportSearchResponse {
  results: Airport[];
  fallback?: {
    matchedPlace: string;
    countryCode: string;
    radiusKm: number;
  };
}
