import type { FlightOption } from '@fast-travel/shared';
import { countryDisplayName } from '../utils/country.utils';

/**
 * Pure data-shaping helpers for the FlightFan map. Lives in its own module
 * (without importing leaflet/react-leaflet) so screens that only need the
 * derived list — e.g. FlightResultsScreen's "destinations" panel — can use
 * it without dragging Leaflet (~150 KB) into the main bundle.
 *
 * The map component itself lazy-imports leaflet, so the heavy renderer only
 * lands when a user actually scrolls to / opens the map.
 */

export interface DirectDestination {
  iata: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  minPriceUsd: number;
  flightCount: number;
}

export function buildDirectDestinations(flights: FlightOption[]): DirectDestination[] {
  const byIata = new Map<string, DirectDestination>();
  for (const f of flights) {
    if (f.stops !== 0) continue;
    if (!Number.isFinite(f.destinationLat) || !Number.isFinite(f.destinationLng)) continue;
    if (f.destinationLat === 0 && f.destinationLng === 0) continue;
    const prev = byIata.get(f.destinationIata);
    if (!prev) {
      byIata.set(f.destinationIata, {
        iata: f.destinationIata,
        city: f.destinationCity,
        country: countryDisplayName(f.destinationCountry) || 'Other',
        lat: f.destinationLat,
        lng: f.destinationLng,
        minPriceUsd: f.priceUsd,
        flightCount: 1,
      });
    } else {
      prev.flightCount += 1;
      if (f.priceUsd < prev.minPriceUsd) prev.minPriceUsd = f.priceUsd;
    }
  }
  return [...byIata.values()];
}
