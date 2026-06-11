import { airportService } from '../services/AirportService';

/** Maximum airports per city to fan out across in a single flight search.
 *  Caps API spend on large metros (London=6, Moscow=4); members are pre-ranked
 *  by direct-route popularity in AirportService.buildCityIndex(), so the
 *  truncation keeps the busiest hubs. Worst-case cartesian for a city→city
 *  multi-city leg is 4×4 = 16 Kiwi requests instead of 6×6 = 36. */
export const CITY_AIRPORT_CAP = 4;

/** Expand a location marker into one or more IATA codes.
 *  - Plain IATA (e.g. "FCO") → ["FCO"]
 *  - City marker (e.g. "@rome_it") → ordered list of member airports
 *    (capped to CITY_AIRPORT_CAP)
 *
 *  Returns an empty array when a "@<id>" marker references an unknown city.
 *  Route handlers should treat that as an invalid params error. */
export function resolveLocation(marker: string): string[] {
  if (!marker) return [];
  if (marker.startsWith('@')) {
    const city = airportService.cityById(marker.slice(1));
    if (!city) return [];
    return city.airports.slice(0, CITY_AIRPORT_CAP);
  }
  return [marker.toUpperCase()];
}

/** True when the marker references a city group rather than a single airport.
 *  Cheap string check, used to decide whether to fan out before calling the
 *  flight provider. */
export function isCityMarker(marker: string): boolean {
  return marker.startsWith('@');
}
