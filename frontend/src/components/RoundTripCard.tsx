import { FlightOption, RoundTripOption } from '@fast-travel/shared';
import { formatTime, durationLabel, formatDate } from '../utils/date.utils';
import { formatPrice } from '../utils/price.utils';
import { ArrowRight, ChevronRight, Plane } from 'lucide-react';

interface Props {
  trip: RoundTripOption;
  passengers: number;
  onSelect: (trip: RoundTripOption) => void;
}

/**
 * Card for a bundled round-trip pair. Outbound on top, return below, single
 * combined price on the right. The price already includes the passenger
 * multiplier (set by the backend), so we render it as the trip total.
 */
export function RoundTripCard({ trip, passengers, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(trip)}
      className="group w-full text-left bg-surface border border-border rounded-2xl p-3.5 flex items-stretch gap-3 transition-all duration-150 animate-fade-in active:scale-[0.99] hover:border-indigo-border hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
    >
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <LegRow leg={trip.outbound} direction="outbound" />
        <div className="border-t border-border/60" />
        <LegRow leg={trip.inbound} direction="return" />
      </div>

      <div className="flex flex-col items-end justify-between shrink-0 pl-2 border-l border-border/60">
        <div className="text-right">
          <div className="text-lg font-mono font-bold text-orange leading-none">
            {formatPrice(trip.priceUsd)}
          </div>
          <div className="text-text-xmuted text-[10px] mt-0.5">
            {passengers > 1 ? `for ${passengers}` : 'round trip'}
          </div>
        </div>
        <ChevronRight size={16} className="text-text-xmuted group-hover:text-indigo transition-colors" />
      </div>
    </button>
  );
}

function LegRow({ leg, direction }: { leg: FlightOption; direction: 'outbound' | 'return' }) {
  const directionLabel = direction === 'outbound' ? 'Out' : 'Return';
  const directionColor = direction === 'outbound' ? 'text-indigo' : 'text-orange';
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className={`text-[10px] font-bold uppercase tracking-wider ${directionColor} shrink-0 w-12`}>
        {directionLabel}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[11px] font-bold text-text-primary shrink-0">{leg.originIata}</span>
          <ArrowRight size={11} className="text-text-xmuted shrink-0" />
          <span className="font-mono text-[11px] font-bold text-text-primary shrink-0">{leg.destinationIata}</span>
          {leg.stops === 0 ? (
            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
              Direct
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-sky-700 dark:text-sky-400 shrink-0">
              {leg.stops} stop{leg.stops > 1 ? 's' : ''}
              {leg.viaIatas && leg.viaIatas.length > 0 && (
                <span className="text-text-xmuted font-normal"> via {leg.viaIatas.join(', ')}</span>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-muted min-w-0">
          <span className="truncate max-w-[7rem]">{leg.airlineName}</span>
          <span className="text-text-xmuted">·</span>
          <span className="text-text-muted shrink-0">{formatDate(leg.departureDatetime)}</span>
          <span className="text-text-xmuted hidden sm:inline">·</span>
          <span className="font-mono text-text-secondary hidden sm:inline-flex items-center gap-1 shrink-0">
            <span>{formatTime(leg.departureDatetime)}</span>
            <Plane size={9} className="rotate-90 text-text-xmuted" />
            <span>{formatTime(leg.arrivalDatetime)}</span>
          </span>
          <span className="text-text-xmuted hidden md:inline">·</span>
          <span className="hidden md:inline text-text-muted shrink-0">{durationLabel(leg.durationMinutes)}</span>
        </div>
      </div>
    </div>
  );
}

export function RoundTripCardSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-2xl p-3.5 flex items-stretch gap-3 animate-pulse">
      <div className="flex-1 min-w-0 space-y-3">
        <div className="space-y-1.5">
          <div className="skeleton h-3 w-32 rounded" />
          <div className="skeleton h-2.5 w-44 rounded" />
        </div>
        <div className="border-t border-border/60" />
        <div className="space-y-1.5">
          <div className="skeleton h-3 w-32 rounded" />
          <div className="skeleton h-2.5 w-44 rounded" />
        </div>
      </div>
      <div className="skeleton h-7 w-14 rounded shrink-0 self-start" />
    </div>
  );
}
