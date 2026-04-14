import { FlightOption } from '@fast-travel/shared';
import { formatTime, durationLabel } from '../utils/date.utils';
import { formatPrice } from '../utils/price.utils';

interface Props {
  flight: FlightOption;
  onSelect: (flight: FlightOption) => void;
}

export function ReturnFlightCard({ flight, onSelect }: Props) {
  const isDirect = flight.stops === 0;
  const via = flight.viaIatas ?? [];
  const iataStops = [flight.originIata, ...via, flight.destinationIata];

  return (
    <button
      className="card w-full text-left transition-all duration-150 animate-fade-in active:scale-[0.98] hover:-translate-y-0.5 hover:border-indigo-border hover:shadow-[0_16px_40px_rgba(15,23,42,0.12)]"
      onClick={() => onSelect(flight)}
    >
      {/* Top: airline · badge · price */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-text-muted text-xs truncate">{flight.airlineName}</span>
          {isDirect ? (
            <span className="pill-success">Non-stop</span>
          ) : (
            <span className="pill-sky">{flight.stops} stop{flight.stops > 1 ? 's' : ''}</span>
          )}
        </div>
        <span className="font-mono text-orange font-bold text-xl shrink-0">
          {formatPrice(flight.priceUsd)}
        </span>
      </div>

      {/* Route visualisation */}
      <div className="flex items-center gap-2 mb-4">
        {iataStops.map((iata, idx) => (
          <div key={idx} className="flex items-center gap-2 min-w-0 flex-1">
            <span className={`font-mono text-sm font-bold shrink-0 ${idx === 0 || idx === iataStops.length - 1 ? 'text-text-primary' : 'text-text-muted'}`}>
              {iata}
            </span>
            {idx < iataStops.length - 1 && (
              <div className="flex items-center gap-0 flex-1 min-w-[20px]">
                <div className="flex-1 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, #3730A3, #0EA5E9)' }} />
                <div className="w-2 h-2 rounded-full bg-white border-2 border-indigo-mid shrink-0" />
                <div className="flex-1 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, #3730A3, #0EA5E9)' }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Times + duration */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-3 font-mono text-text-secondary">
          <span className="font-semibold">{formatTime(flight.departureDatetime)}</span>
          <span className="text-text-xmuted text-xs">→</span>
          <span className="font-semibold">{formatTime(flight.arrivalDatetime)}</span>
        </div>
        <span className="text-text-muted text-xs font-medium">{durationLabel(flight.durationMinutes)}</span>
      </div>
    </button>
  );
}

export function ReturnFlightCardSkeleton() {
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-5 w-16 rounded-full" />
        </div>
        <div className="skeleton h-7 w-14 rounded" />
      </div>
      <div className="flex items-center gap-2">
        <div className="skeleton h-4 w-10 rounded" />
        <div className="skeleton h-0.5 flex-1 rounded-full" />
        <div className="skeleton h-4 w-10 rounded" />
      </div>
      <div className="flex items-center justify-between">
        <div className="skeleton h-4 w-28 rounded" />
        <div className="skeleton h-3 w-12 rounded" />
      </div>
    </div>
  );
}
