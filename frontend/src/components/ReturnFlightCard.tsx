import { FlightOption } from '@fast-travel/shared';
import { formatTime, durationLabel, formatDate } from '../utils/date.utils';
import { formatPrice } from '../utils/price.utils';

interface Props {
  flight: FlightOption;
  onSelect: (flight: FlightOption) => void;
  /** IATA of the airport the traveller arrived at for the current stop.
   *  When the return flight departs from a metro peer airport (e.g. CDG
   *  when arrival was BVA), an inline chip surfaces the mismatch. */
  arrivalIata?: string;
}

export function ReturnFlightCard({ flight, onSelect, arrivalIata }: Props) {
  const isDirect = flight.stops === 0;
  const via = flight.viaIatas ?? [];
  const iataStops = [flight.originIata, ...via, flight.destinationIata];
  const departDate = flight.departureDatetime?.slice(0, 10);
  const airportMismatch = !!arrivalIata && flight.originIata !== arrivalIata;

  return (
    <button
      className={`card w-full text-left transition-all duration-150 animate-fade-in active:scale-[0.98] hover:-translate-y-0.5 ${
        isDirect
          ? 'hover:border-emerald-400 hover:shadow-[0_16px_40px_rgba(16,185,129,0.12)]'
          : 'hover:border-indigo-border hover:shadow-[0_16px_40px_rgba(15,23,42,0.12)]'
      }`}
      onClick={() => onSelect(flight)}
    >
      {/* Top: date · airline · price */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {departDate && (
            <span className="text-text-primary text-xs font-semibold shrink-0">{formatDate(departDate)}</span>
          )}
          <span className="text-text-muted text-xs truncate">· {flight.airlineName}</span>
        </div>
        <span className="font-mono text-orange font-bold text-xl shrink-0">
          {formatPrice(flight.priceUsd)}
        </span>
      </div>

      {airportMismatch && (
        <div className="mb-3">
          <span
            className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5"
            title={`This flight departs ${flight.originIata}. You arrived at ${arrivalIata} — you'll need to transfer between airports.`}
          >
            Departs {flight.originIata} · arrived {arrivalIata}
          </span>
        </div>
      )}

      {/* Direct / stopover indicator */}
      {isDirect ? (
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-1.5 mb-3">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Direct flight</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-1.5 mb-3">
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
            {flight.stops} stop{flight.stops > 1 ? 's' : ''}
            {via.length > 0 && (
              <> · via <span className="font-mono font-bold">{via.join(', ')}</span></>
            )}
          </span>
        </div>
      )}

      {/* Route visualisation */}
      <div className="flex items-center gap-2 mb-3">
        {iataStops.map((iata, idx) => (
          <div key={idx} className="flex items-center gap-2 min-w-0 flex-1">
            <div className="flex flex-col items-center shrink-0">
              <span className={`font-mono text-sm font-bold ${idx === 0 || idx === iataStops.length - 1 ? 'text-text-primary' : 'text-amber-600 dark:text-amber-400'}`}>
                {iata}
              </span>
              {idx > 0 && idx < iataStops.length - 1 && (
                <span className="text-[9px] text-amber-500 font-medium leading-none mt-0.5">stop</span>
              )}
            </div>
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
