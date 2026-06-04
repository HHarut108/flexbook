import { FlightOption, RoundTripOption } from '@fast-travel/shared';
import { formatTime, durationLabel, formatDate } from '../utils/date.utils';
import { formatPrice } from '../utils/price.utils';
import { AlertTriangle, ArrowRight, ChevronRight, Moon, Plane, Users } from 'lucide-react';

interface Props {
  trip: RoundTripOption;
  passengers: number;
  onSelect: (trip: RoundTripOption) => void;
}

/** Whole nights between outbound arrival and inbound departure. Floor — if you
 *  land Mon 22:00 and fly home Wed 06:00 that's 1 night, not 2. */
function stayNights(outboundArrivalIso: string, inboundDepartureIso: string): number {
  const arrive = new Date(outboundArrivalIso);
  const depart = new Date(inboundDepartureIso);
  const ms = depart.getTime() - arrive.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** Same shape as FlightCard's helpers, kept inline so the two cards stay
 *  visually consistent without coupling components. */
function formatCarriers(leg: FlightOption): string {
  const list = leg.carriers ?? (leg.airlineName ? [leg.airlineName] : []);
  if (list.length === 0) return leg.airlineName;
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} + ${list[1]}`;
  return `${list[0]} + ${list[1]} + ${list.length - 2} more`;
}

function formatLayovers(leg: FlightOption): string | null {
  if (!leg.layovers || leg.layovers.length === 0) return null;
  return leg.layovers
    .filter((l) => l.durationMinutes > 0)
    .map((l) => `${durationLabel(l.durationMinutes)} ${l.iata}`)
    .join(' + ');
}

/**
 * Card for a bundled round-trip pair. Outbound on top, return below, single
 * combined price on the right. The price already includes the passenger
 * multiplier (set by the backend), so we render it as the trip total.
 */
export function RoundTripCard({ trip, passengers, onSelect }: Props) {
  const nights = stayNights(trip.outbound.arrivalDatetime, trip.inbound.departureDatetime);
  const stayCity = trip.outbound.destinationCity;

  return (
    <button
      type="button"
      onClick={() => onSelect(trip)}
      className="group w-full text-left bg-surface border border-border rounded-2xl p-3.5 flex items-stretch gap-3 transition-all duration-150 animate-fade-in active:scale-[0.99] hover:border-indigo-border hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
    >
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <LegRow leg={trip.outbound} direction="outbound" />
        <StayDivider nights={nights} city={stayCity} />
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

function StayDivider({ nights, city }: { nights: number; city: string }) {
  if (nights <= 0) {
    return <div className="border-t border-border/60" />;
  }
  return (
    <div className="flex items-center gap-2" aria-label={`${nights} night${nights === 1 ? '' : 's'} in ${city}`}>
      <div className="flex-1 border-t border-border/60" />
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-mid shrink-0">
        <Moon size={9} />
        {nights} night{nights === 1 ? '' : 's'} in {city}
      </span>
      <div className="flex-1 border-t border-border/60" />
    </div>
  );
}

function LegRow({ leg, direction }: { leg: FlightOption; direction: 'outbound' | 'return' }) {
  const directionLabel = direction === 'outbound' ? 'Out' : 'Return';
  const directionColor = direction === 'outbound' ? 'text-indigo' : 'text-orange';
  const carriersLabel = formatCarriers(leg);
  const multiCarrier = (leg.carriers?.length ?? 1) > 1;
  const hasSelfTransfer = leg.layovers?.some((l) => l.selfTransfer) ?? false;
  const layoverLabel = formatLayovers(leg);

  return (
    <div className="flex items-start gap-2 min-w-0">
      <span className={`text-[10px] font-bold uppercase tracking-wider ${directionColor} shrink-0 w-12 mt-0.5`}>
        {directionLabel}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
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
          {multiCarrier && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 shrink-0"
              title="Leg uses multiple airlines"
            >
              <Users size={9} /> Mixed
            </span>
          )}
          {hasSelfTransfer && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-400 shrink-0"
              title="You must collect bags and re-check between flights"
            >
              <AlertTriangle size={9} /> Self-transfer
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-muted min-w-0">
          <span className="truncate max-w-[9rem]">{carriersLabel}</span>
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
        {layoverLabel && (
          <div className="mt-0.5 text-[10px] text-text-xmuted truncate">
            Layover: {layoverLabel}
          </div>
        )}
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
