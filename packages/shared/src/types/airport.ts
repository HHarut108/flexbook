import { City } from './city';

export interface Airport {
  iata: string;
  name: string;
  city: City;
  timezone: string;
  distanceKm?: number;
}

/** Discriminated union returned by /airports/search. A query can yield
 *  either a single airport row or a "City" row that fans out to all
 *  member airports when the user picks it (e.g. "Rome (city)" → FCO+CIA).
 *  Cities only appear for metropolitan areas with ≥2 commercial airports. */
export type AirportSearchEntry =
  | { kind: 'airport'; airport: Airport }
  | { kind: 'city'; city: City & { airports: string[] } };

/**
 * Response shape for /airports/search. `fallback` is set when the user's
 * query didn't match any commercial airport but resolved to a known place
 * via the wider gazetteer — in that case `results` holds the nearest
 * commercial airports within `fallback.radiusKm`, sorted by distance.
 */
export interface AirportSearchResponse {
  results: AirportSearchEntry[];
  fallback?: {
    matchedPlace: string;
    countryCode: string;
    radiusKm: number;
  };
}
