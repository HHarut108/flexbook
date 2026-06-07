import { MapPin } from 'lucide-react';
import { Airport } from '@fast-travel/shared';

interface Props {
  airport: Airport;
  onSelect: () => void;
}

/**
 * Full-width airport row used in V2 tool pages for the "Nearby airports"
 * quick-pick section. Matches the V1 production AirportCard pattern
 * (HopPlannerScreen.tsx:108-137) — big indigo icon tile that fills on
 * hover, full airport name, IATA in mono indigo, and a sub-line that's
 * either "12 km away" (when the API returned a distanceKm) or the
 * city / country pair as a fallback.
 *
 * Shared by HopPlannerScreenV2 and TripPlannerScreenV2 so they stay
 * visually identical and so nearby-airport styling lives in one place.
 */
export function NearbyAirportRow({ airport, onSelect }: Props) {
  return (
    <button
      type="button"
      className="list-row group active:scale-[0.98] transition-all duration-150"
      onClick={onSelect}
      aria-label={`Depart from ${airport.city.name} (${airport.iata})`}
    >
      <div className="flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-2xl bg-indigo-soft border border-indigo-border text-indigo flex items-center justify-center shrink-0 group-hover:bg-indigo group-hover:text-white group-hover:border-indigo transition-colors duration-200">
          <MapPin size={17} />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[15px] font-semibold text-text-primary truncate">{airport.name}</p>
          <p className="text-xs text-text-muted mt-0.5">
            <span className="font-mono font-semibold text-indigo-mid">{airport.iata}</span>
            {airport.distanceKm
              ? ` · ${airport.distanceKm} km away`
              : ` · ${airport.city.name}, ${airport.city.countryName}`}
          </p>
        </div>
      </div>
    </button>
  );
}
