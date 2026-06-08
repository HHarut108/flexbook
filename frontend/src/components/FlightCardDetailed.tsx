import { FlightOption } from '@fast-travel/shared';
import { formatTime, durationLabel } from '../utils/date.utils';
import { formatPrice } from '../utils/price.utils';
import { ArrowRight, Sparkles, ShieldCheck, AlertTriangle, Ticket } from 'lucide-react';

/* ── Single one-way card ─────────────────────────────────────────────────── */

interface FlightCardDetailedProps {
  flight: FlightOption;
  passengers: number;
  isBestValue?: boolean;
  logoUrl?: string;
  onSelect: (flight: FlightOption) => void;
}

export function FlightCardDetailed({
  flight,
  passengers,
  isBestValue,
  logoUrl,
  onSelect,
}: FlightCardDetailedProps) {
  const hasSelfTransfer = flight.layovers?.some((l) => l.selfTransfer) ?? false;
  return (
    <DetailedTripCard
      isBestValue={isBestValue}
      onSelect={() => onSelect(flight)}
      action={
        <ActionColumn
          priceUsd={flight.priceUsd}
          priceLabel="one way · per traveler"
          passengers={passengers}
          hasSelfTransfer={hasSelfTransfer}
        />
      }
    >
      <LegRow leg={flight} logoUrl={logoUrl} isBestValue={isBestValue} />
    </DetailedTripCard>
  );
}

/* ── Reusable container ─────────────────────────────────────────────────── */

interface DetailedTripCardProps {
  isBestValue?: boolean;
  onSelect: () => void;
  action: React.ReactNode;
  children: React.ReactNode;
}

export function DetailedTripCard({
  isBestValue,
  onSelect,
  action,
  children,
}: DetailedTripCardProps) {
  return (
    <div
      className={
        'group relative bg-surface rounded-2xl px-4 py-4 transition-shadow border ' +
        (isBestValue
          ? 'border-indigo-border shadow-[0_10px_28px_rgba(79,70,229,0.12)]'
          : 'border-border hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]')
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 lg:gap-6 items-stretch">
        <div className="flex flex-col gap-3 min-w-0">{children}</div>
        <div className="flex flex-col items-stretch lg:items-end justify-between gap-2 lg:min-w-[180px] lg:border-l lg:border-border/60 lg:pl-5">
          {action}
          <button
            type="button"
            onClick={onSelect}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full bg-indigo-mid text-white text-sm font-bold hover:bg-indigo transition-colors min-h-[40px]"
          >
            Select <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── One leg row: airline column + timeline ─────────────────────────────── */

export interface LegRowProps {
  leg: FlightOption;
  logoUrl?: string;
  /** "Outbound" / "Return" / "Leg 1" — small label above the airline name. */
  legLabel?: string;
  isBestValue?: boolean;
}

export function LegRow({ leg, logoUrl, legLabel, isBestValue }: LegRowProps) {
  const carrierName = leg.airlineName || leg.carriers?.[0] || 'Airline';
  const code = leg.airlineCode?.toUpperCase() || carrierName.slice(0, 1).toUpperCase();
  const isDirect = leg.stops === 0;
  const stopLabel = isDirect ? 'Direct' : `${leg.stops} stop${leg.stops > 1 ? 's' : ''}`;
  const firstLayover = leg.layovers?.find((l) => l.durationMinutes > 0);
  const viaIata = firstLayover?.iata ?? leg.viaIatas?.[0] ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-3 lg:gap-5 items-center">
      <div className="flex items-center gap-3 min-w-0">
        {/* Airline mark — neutral surface lets the brand logo speak. Falls
            back to a 2-letter monogram in the same chrome so the card weight
            stays consistent whether the logo loaded or not. */}
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden bg-surface border border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${carrierName} logo`}
              className="h-7 w-8 object-contain"
              loading="lazy"
            />
          ) : (
            <span className="font-mono font-bold text-[13px] text-text-primary tracking-tight">
              {code.slice(0, 2)}
            </span>
          )}
        </div>
        <div className="min-w-0">
          {legLabel && (
            <p className="text-[9px] uppercase tracking-[0.14em] font-bold text-text-muted mb-0.5">
              {legLabel}
            </p>
          )}
          <p className="text-[15px] font-bold text-text-primary truncate leading-tight">
            {carrierName}
          </p>
          <p className="mt-0.5 text-[11px] text-text-muted">
            <span
              className={
                'inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle ' +
                (isDirect ? 'bg-emerald-500' : 'bg-sky-500')
              }
            />
            {stopLabel}
          </p>
          {isBestValue && (
            <span className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo text-white text-[10px] font-semibold">
              <Sparkles size={10} /> Best value
            </span>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <p className="text-center text-xs text-text-muted mb-1">
          {durationLabel(leg.durationMinutes)}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-start shrink-0">
            <span className="font-mono text-lg font-bold text-text-primary leading-none">
              {formatTime(leg.departureDatetime)}
            </span>
            <span className="text-[10px] font-mono text-text-muted mt-1">
              {leg.originIata}
            </span>
          </div>
          <div className="relative flex-1 h-px bg-border">
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-mid" />
            {leg.stops > 0 && (
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2 border-indigo-mid bg-surface" />
            )}
            <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-mid" />
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className="font-mono text-lg font-bold text-text-primary leading-none">
              {formatTime(leg.arrivalDatetime)}
            </span>
            <span className="text-[10px] font-mono text-text-muted mt-1">
              {leg.destinationIata}
            </span>
          </div>
        </div>
        {leg.stops > 0 && viaIata && (
          <p className="text-center text-[11px] text-text-muted mt-1">
            <span className="font-semibold text-text-secondary">{stopLabel}</span>
            <span className="mx-1 text-text-xmuted">·</span>
            <span className="font-mono">{viaIata}</span>
          </p>
        )}
        {firstLayover && (
          <p className="text-center text-[11px] mt-1">
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {durationLabel(firstLayover.durationMinutes)} in {firstLayover.iata}
              <span className="text-text-xmuted">·</span>
              <span className="text-text-muted">{layoverQuality(firstLayover.durationMinutes)}</span>
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Reusable right column: price + Good to know ────────────────────────── */

export interface ActionColumnProps {
  priceUsd: number;
  /** Short caption under the price, e.g. "one way · per traveler" or "round trip · total". */
  priceLabel: string;
  passengers: number;
  hasSelfTransfer: boolean;
  /** Optional extra "Good to know" line for multi-city (separate tickets). */
  separateTickets?: boolean;
}

export function ActionColumn({
  priceUsd,
  priceLabel,
  passengers,
  hasSelfTransfer,
  separateTickets,
}: ActionColumnProps) {
  return (
    <div className="space-y-3">
      <div className="lg:text-right">
        <div className="text-2xl font-mono font-black text-orange leading-none">
          {formatPrice(priceUsd)}
        </div>
        <div className="text-[11px] text-text-muted mt-1">
          {priceLabel}
          {passengers > 1 && (
            <span className="block text-text-xmuted">
              ≈ {formatPrice(priceUsd * passengers)} for {passengers}
            </span>
          )}
        </div>
      </div>

      <div className="lg:text-right">
        <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Good to know:</p>
        <div className="flex flex-col lg:items-end gap-1">
          {hasSelfTransfer ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-[11px] font-semibold w-fit">
              <AlertTriangle size={11} /> Self-transfer
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold w-fit">
              <ShieldCheck size={11} /> Protected transfer
            </span>
          )}
          {separateTickets && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-[11px] font-semibold w-fit">
              <Ticket size={11} /> Separate tickets
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function layoverQuality(minutes: number): string {
  if (minutes < 60) return 'tight';
  if (minutes <= 240) return 'easy';
  return 'long';
}

