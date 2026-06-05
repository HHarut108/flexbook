import { Airport } from './airport';
import { City } from './city';

/** A user's chosen origin or destination — either a single airport or a
 *  multi-airport city (e.g. "Rome (all airports)"). All planners (Home,
 *  Hop, Budget, When To Go) hold their origin/destination as this union
 *  so a city pick fans out across member airports when the search runs. */
export type LocationSelection =
  | { kind: 'airport'; airport: Airport }
  | { kind: 'city'; city: City & { airports: string[] } };

/** Serialize a selection for backend params and URL state. Airports become
 *  their 3-letter IATA (e.g. "FCO"); cities become "@<id>" (e.g. "@rome_it").
 *  The "@" prefix is unambiguous because IATA codes are [A-Z]{3}. */
export function selectionToMarker(sel: LocationSelection): string {
  return sel.kind === 'airport' ? sel.airport.iata : `@${sel.city.id}`;
}

/** True when a string marker references a city group (vs a single airport). */
export function isCityMarker(marker: string): boolean {
  return marker.startsWith('@');
}

/** Human-readable label for a selection, used in inputs and chips.
 *  Airport → "Rome (FCO)"; city → "Rome (all airports)". */
export function selectionLabel(sel: LocationSelection): string {
  if (sel.kind === 'airport') {
    return `${sel.airport.city.name} (${sel.airport.iata})`;
  }
  return `${sel.city.name} (all airports)`;
}

/** City/place name regardless of kind — for headers and breadcrumbs. */
export function selectionName(sel: LocationSelection): string {
  return sel.kind === 'airport' ? sel.airport.city.name : sel.city.name;
}

/** ISO-2 country code regardless of kind. */
export function selectionCountryCode(sel: LocationSelection): string {
  return sel.kind === 'airport' ? sel.airport.city.countryCode : sel.city.countryCode;
}

/** Geographic anchor for maps — airport coords for airport kind, city
 *  centroid for city kind. */
export function selectionCoords(sel: LocationSelection): { lat: number; lng: number } {
  if (sel.kind === 'airport') {
    return { lat: sel.airport.city.lat, lng: sel.airport.city.lng };
  }
  return { lat: sel.city.lat, lng: sel.city.lng };
}

/** Stable id for React keys and dedup. */
export function selectionId(sel: LocationSelection): string {
  return sel.kind === 'airport' ? `airport:${sel.airport.iata}` : `city:${sel.city.id}`;
}
