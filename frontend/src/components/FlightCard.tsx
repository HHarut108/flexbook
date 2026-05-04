import { FlightOption, WeatherSummary } from '@fast-travel/shared';
import { formatTime, durationLabel } from '../utils/date.utils';
import { formatPrice } from '../utils/price.utils';
import { useTripStore } from '../store/trip.store';
import { Plane } from 'lucide-react';

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
      className="card w-full text-left transition-all duration-150 animate-fade-in active:scale-[0.98] hover:-translate-y-0.5 hover:border-indigo-border hover:shadow-[0_16px_40px_rgba(15,23,42,0.12)]"
      onClick={() => onSelect(flight)}
    >
      {/* Top: airline · badges */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-text-muted text-xs">{flight.airlineName}</span>
        {flight.stops === 0 ? (
          <span className="pill-success">Direct</span>
        ) : (
          <span className="pill-sky">{flight.stops} stop{flight.stops > 1 ? 's' : ''}</span>
        )}
        <span className="pill-brand">{flight.destinationCountry}</span>
      </div>

      {/* Middle: city + price */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="text-2xl font-bold text-text-primary tracking-tight leading-tight">
            {flight.destinationCity}
          </div>
          {flight.stops > 0 && flight.viaIatas && flight.viaIatas.length > 0 ? (
            <div className="flex items-center gap-1 mt-1.5">
              {[flight.originIata, ...flight.viaIatas, flight.destinationIata].map((iata, idx, arr) => (
                <span key={idx} className="flex items-center gap-1">
                  <span className={`font-mono text-xs font-bold ${idx === 0 || idx === arr.length - 1 ? 'text-text-primary' : 'text-indigo-mid'}`}>
                    {iata}
                  </span>
                  {idx < arr.length - 1 && (
                    <span className="text-text-xmuted text-[10px]">—</span>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <div className="font-mono text-sm text-text-muted bg-surface-2 inline-block px-2 py-0.5 rounded-full mt-1">
              {flight.destinationIata}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-mono font-bold text-orange">
            {formatPrice(flight.priceUsd)}
          </div>
          <div className="text-text-xmuted text-xs mt-0.5">
            {passengers > 1 ? `for ${passengers} travelers` : 'one way'}
          </div>
        </div>
      </div>

      {/* Bottom: times + weather */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-mono text-text-secondary">
          <span>{formatTime(flight.departureDatetime)}</span>
          <Plane size={11} className="rotate-90 text-text-xmuted" />
          <span>{formatTime(flight.arrivalDatetime)}</span>
          <span className="text-text-muted text-xs">· {durationLabel(flight.durationMinutes)}</span>
        </div>
        {weather && (
          <div className="flex items-center gap-1 text-xs text-text-muted">
            <span>{WEATHER_ICONS[weather.condition]}</span>
            <span>{weather.temperatureC}°C</span>
            {!weather.isForecast && <span className="text-text-xmuted text-[10px]">(avg)</span>}
          </div>
        )}
      </div>
    </button>
  );
}

export function FlightCardSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="skeleton h-3 w-20 rounded" />
        <div className="skeleton h-5 w-14 rounded-full" />
        <div className="skeleton h-5 w-18 rounded-full" />
      </div>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="space-y-2">
          <div className="skeleton h-7 w-36 rounded" />
          <div className="skeleton h-5 w-10 rounded-full" />
        </div>
        <div className="skeleton h-8 w-16 rounded" />
      </div>
      <div className="skeleton h-4 w-48 rounded" />
    </div>
  );
}
