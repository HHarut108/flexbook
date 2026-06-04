import { FlightOption, WeatherSummary } from '@fast-travel/shared';
import { formatTime, durationLabel } from '../utils/date.utils';
import { formatPrice } from '../utils/price.utils';
import { useTripStore } from '../store/trip.store';
import { AlertTriangle, ChevronRight, Plane, Users } from 'lucide-react';

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
  const carriersLabel = formatCarriers(flight);
  const multiCarrier = (flight.carriers?.length ?? 1) > 1;
  const hasSelfTransfer = flight.layovers?.some((l) => l.selfTransfer) ?? false;
  const layoverLabel = formatLayovers(flight);

  return (
    <button
      type="button"
      onClick={() => onSelect(flight)}
      className="group w-full text-left bg-surface border border-border rounded-2xl px-3.5 py-3 flex items-center gap-3 transition-all duration-150 animate-fade-in active:scale-[0.99] hover:border-indigo-border hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
    >
      {/* Main content — compact stack: city/stops, optional risk chips, meta, optional layover */}
      <div className="flex-1 min-w-0">
        {/* Line 1: city + IATA + stops/route. Risk chips live below so they
            don't squeeze long city names into "L…". */}
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

        {/* Optional risk-chip row — Mixed carriers and/or Self-transfer.
            Only renders when at least one applies, so single-carrier
            non-transfer flights stay just as compact as before. */}
        {(multiCarrier || hasSelfTransfer) && (
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {multiCarrier && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded shrink-0"
                title="Itinerary uses multiple airlines"
              >
                <Users size={10} /> Mixed carriers
              </span>
            )}
            {hasSelfTransfer && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-1.5 py-0.5 rounded shrink-0"
                title="You must collect bags and re-check between flights"
              >
                <AlertTriangle size={10} /> Self-transfer
              </span>
            )}
          </div>
        )}

        {/* Line 2: carriers · times · total trip duration · weather */}
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-muted min-w-0">
          <span className="truncate max-w-[10rem]">{carriersLabel}</span>
          <span className="text-text-xmuted">·</span>
          <span className="font-mono text-text-secondary inline-flex items-center gap-1 shrink-0">
            <span>{formatTime(flight.departureDatetime)}</span>
            <Plane size={9} className="rotate-90 text-text-xmuted" />
            <span>{formatTime(flight.arrivalDatetime)}</span>
          </span>
          <span className="text-text-xmuted">·</span>
          <span className="text-text-muted shrink-0">{durationLabel(flight.durationMinutes)}</span>
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

        {/* Line 3 (optional): layover breakdown — "3h FCO + 2h 40m SVQ" */}
        {layoverLabel && (
          <div className="mt-1 text-[10px] text-text-xmuted truncate">
            Layover: {layoverLabel}
          </div>
        )}
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

/** "Wizz Air Malta", "Wizz Air Malta + Ryanair", "Wizz + Ryanair + 1 more". */
function formatCarriers(flight: FlightOption): string {
  const list = flight.carriers ?? (flight.airlineName ? [flight.airlineName] : []);
  if (list.length === 0) return flight.airlineName;
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} + ${list[1]}`;
  return `${list[0]} + ${list[1]} + ${list.length - 2} more`;
}

/** "3h FCO + 2h 40m SVQ" — compact layover summary. */
function formatLayovers(flight: FlightOption): string | null {
  if (!flight.layovers || flight.layovers.length === 0) return null;
  return flight.layovers
    .filter((l) => l.durationMinutes > 0)
    .map((l) => `${durationLabel(l.durationMinutes)} ${l.iata}`)
    .join(' + ');
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
