import { FlightOption, WeatherSummary } from '@fast-travel/shared';
import { formatTime, durationLabel } from '../utils/date.utils';
import { formatPrice } from '../utils/price.utils';
import { useTripStore } from '../store/trip.store';
import { ChevronRight, Plane } from 'lucide-react';

const WEATHER_ICONS: Record<string, string> = {
  clear: '☀️', cloudy: '☁️', rain: '🌧️', snow: '❄️', storm: '⛈️', unknown: '',
};

interface Props {
  flight: FlightOption;
  weather?: WeatherSummary;
  onSelect: (flight: FlightOption) => void;
}

export function FlightCard({ flight, weather, onSelect }: Props) {
  const passengers = useTripStore((s) => s.passengers);

  return (
    <button
      type="button"
      onClick={() => onSelect(flight)}
      className="group w-full text-left bg-surface border border-border rounded-2xl px-3.5 py-3 flex items-center gap-3 transition-all duration-150 animate-fade-in active:scale-[0.99] hover:border-indigo-border hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
    >
      {/* Main content — two compact lines */}
      <div className="flex-1 min-w-0">
        {/* Line 1: city + IATA + stops/route */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base font-bold text-text-primary truncate leading-tight">
            {flight.destinationCity}
          </span>
          <span className="font-mono text-[10px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded-md shrink-0">
            {flight.destinationIata}
          </span>
          {flight.stops === 0 ? (
            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
              Direct
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-sky-700 dark:text-sky-400 shrink-0">
              {flight.stops} stop{flight.stops > 1 ? 's' : ''}
              {flight.viaIatas && flight.viaIatas.length > 0 && (
                <span className="text-text-xmuted font-normal"> via {flight.viaIatas.join(', ')}</span>
              )}
            </span>
          )}
        </div>

        {/* Line 2: airline · times · duration · weather */}
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-muted min-w-0">
          <span className="truncate max-w-[8rem]">{flight.airlineName}</span>
          <span className="text-text-xmuted">·</span>
          <span className="font-mono text-text-secondary inline-flex items-center gap-1 shrink-0">
            <span>{formatTime(flight.departureDatetime)}</span>
            <Plane size={9} className="rotate-90 text-text-xmuted" />
            <span>{formatTime(flight.arrivalDatetime)}</span>
          </span>
          <span className="text-text-xmuted hidden sm:inline">·</span>
          <span className="hidden sm:inline text-text-muted shrink-0">{durationLabel(flight.durationMinutes)}</span>
          {weather && (
            <>
              <span className="text-text-xmuted hidden md:inline">·</span>
              <span className="hidden md:inline-flex items-center gap-0.5 shrink-0">
                <span>{WEATHER_ICONS[weather.condition]}</span>
                <span>{weather.temperatureC}°C</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Price + chevron */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <div className="text-lg font-mono font-bold text-orange leading-none">
            {formatPrice(flight.priceUsd)}
          </div>
          <div className="text-text-xmuted text-[10px] mt-0.5">
            {passengers > 1 ? `for ${passengers}` : 'one way'}
          </div>
        </div>
        <ChevronRight size={16} className="text-text-xmuted group-hover:text-indigo transition-colors" />
      </div>
    </button>
  );
}

export function FlightCardSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-2xl px-3.5 py-3 flex items-center gap-3 animate-pulse">
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <div className="skeleton h-4 w-28 rounded" />
          <div className="skeleton h-3 w-8 rounded" />
        </div>
        <div className="skeleton h-3 w-48 rounded" />
      </div>
      <div className="skeleton h-7 w-14 rounded shrink-0" />
    </div>
  );
}
