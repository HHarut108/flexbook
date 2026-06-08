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

/**
 * Two-region card: leg block(s) on the left/top, ActionColumn on the right/bottom.
 *
 * Mobile (<lg): single column. ActionColumn renders inline (no divider) and the
 * Select button is full-width below it — keeps the price/CTA tappable without
 * doubling the card height.
 *
 * Desktop (lg+): [leg | action] grid with a hairline divider between them.
 * ActionColumn aligns right; Select sits at the bottom of that column.
 */
export function DetailedTripCard({
  isBestValue,
  onSelect,
  action,
  children,
}: DetailedTripCardProps) {
  return (
    <div
      className={
        'group relative bg-surface rounded-2xl px-3 py-3 lg:px-4 lg:py-4 transition-shadow border ' +
        (isBestValue
          ? 'border-indigo-border shadow-[0_10px_28px_rgba(79,70,229,0.12)]'
          : 'border-border hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]')
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 lg:gap-5 items-stretch">
        <div className="flex flex-col gap-2.5 min-w-0">{children}</div>
        <div className="flex flex-col items-stretch lg:items-end justify-between gap-2 lg:min-w-[170px] lg:border-l lg:border-border/60 lg:pl-4">
          {action}
          <button
            type="button"
            onClick={onSelect}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-indigo-mid text-white text-sm font-bold hover:bg-indigo transition-colors min-h-[38px] w-full lg:w-auto"
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

/**
 * Compact two-zone leg row that stays useful on phones:
 *
 * Mobile (<sm):
 *   ┌────────────────────────────────────────┐
 *   │ [logo]  Airline · ● Direct             │
 *   │                                        │
 *   │ 12:00  ──────[stop]──────  14:30       │
 *   │  EVN          2h 30m         MAD       │
 *   │                ● 1h 40m in FRA · easy  │
 *   └────────────────────────────────────────┘
 *
 * Desktop (lg+):
 *   [logo+airline]  |  timeline (centred)
 */
export function LegRow({ leg, logoUrl, legLabel, isBestValue }: LegRowProps) {
  const carrierName = leg.airlineName || leg.carriers?.[0] || 'Airline';
  const code = leg.airlineCode?.toUpperCase() || carrierName.slice(0, 1).toUpperCase();
  const isDirect = leg.stops === 0;
  const stopLabel = isDirect ? 'Direct' : `${leg.stops} stop${leg.stops > 1 ? 's' : ''}`;
  const firstLayover = leg.layovers?.find((l) => l.durationMinutes > 0);
  const viaIata = firstLayover?.iata ?? leg.viaIatas?.[0] ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] xl:grid-cols-[200px_1fr] gap-2 lg:gap-4 items-center">
      {/* Airline cluster. Mobile keeps it as a full-width row above the
          timeline so long carrier names (Austrian Airlines, Wizz Air Malta)
          never push the arrival time off-screen. Desktop puts it on the
          left in its own grid column. */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 lg:w-11 lg:h-11 rounded-xl lg:rounded-2xl flex items-center justify-center shrink-0 overflow-hidden bg-surface border border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${carrierName} logo`}
              className="h-5 w-7 lg:h-6 lg:w-8 object-contain"
              loading="lazy"
            />
          ) : (
            <span className="font-mono font-bold text-[11px] lg:text-[13px] text-text-primary tracking-tight">
              {code.slice(0, 2)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          {legLabel && (
            <p className="text-[9px] uppercase tracking-[0.14em] font-bold text-text-muted leading-none mb-0.5">
              {legLabel}
            </p>
          )}
          {/* Mobile: name + dot-stop inline. Desktop: name on its own line, stop
              on the line below — gives long carrier names room to breathe. */}
          <div className="flex items-baseline gap-2 min-w-0 lg:block">
            <p
              className="text-[13px] lg:text-[14px] font-bold text-text-primary truncate leading-tight"
              title={carrierName}
            >
              {carrierName}
            </p>
            <p className="text-[11px] text-text-muted shrink-0 leading-tight lg:mt-0.5">
              <span
                className={
                  'inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle ' +
                  (isDirect ? 'bg-emerald-500' : 'bg-sky-500')
                }
              />
              {stopLabel}
            </p>
          </div>
          {isBestValue && (
            <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo text-white text-[10px] font-semibold leading-none">
              <Sparkles size={9} /> Best value
            </span>
          )}
        </div>
      </div>

      {/* Timeline. Tighter on mobile (smaller times, only one info line below). */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 lg:gap-3">
          <div className="flex flex-col items-start shrink-0">
            <span className="font-mono text-base lg:text-lg font-bold text-text-primary leading-none">
              {formatTime(leg.departureDatetime)}
            </span>
            <span className="text-[9px] lg:text-[10px] font-mono text-text-muted mt-0.5">
              {leg.originIata}
            </span>
          </div>
          <div className="relative flex-1 min-w-[40px]">
            <p className="text-[10px] lg:text-xs text-text-muted text-center leading-none mb-1">
              {durationLabel(leg.durationMinutes)}
            </p>
            <div className="relative h-px bg-border">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-mid" />
              {leg.stops > 0 && (
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2 border-indigo-mid bg-surface" />
              )}
              <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-mid" />
            </div>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className="font-mono text-base lg:text-lg font-bold text-text-primary leading-none">
              {formatTime(leg.arrivalDatetime)}
            </span>
            <span className="text-[9px] lg:text-[10px] font-mono text-text-muted mt-0.5">
              {leg.destinationIata}
            </span>
          </div>
        </div>
        {/* Combine "1 stop · VIE · 1h 40m · easy" into a single line so it
            doesn't take two rows on mobile. */}
        {firstLayover ? (
          <p className="text-center text-[10px] lg:text-[11px] mt-1 leading-tight">
            <span className="inline-flex flex-wrap justify-center items-center gap-x-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-1 h-1 rounded-full bg-emerald-500" />
              {durationLabel(firstLayover.durationMinutes)} in {firstLayover.iata}
              <span className="text-text-xmuted">·</span>
              <span className="text-text-muted">{layoverQuality(firstLayover.durationMinutes)}</span>
            </span>
          </p>
        ) : (
          leg.stops > 0 &&
          viaIata && (
            <p className="text-center text-[10px] lg:text-[11px] text-text-muted mt-1 leading-tight">
              <span className="font-semibold text-text-secondary">{stopLabel}</span>
              <span className="mx-1 text-text-xmuted">·</span>
              <span className="font-mono">{viaIata}</span>
            </p>
          )
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

/**
 * Mobile: price on the left, pill(s) on the right — one row instead of two
 * stacked blocks. Desktop keeps the vertical stack with right-aligned pills.
 * No "Good to know:" label — the pill speaks for itself.
 */
export function ActionColumn({
  priceUsd,
  priceLabel,
  passengers,
  hasSelfTransfer,
  separateTickets,
}: ActionColumnProps) {
  return (
    <div className="flex items-center justify-between gap-3 lg:block lg:space-y-2">
      <div className="lg:text-right min-w-0">
        <div className="text-xl lg:text-2xl font-mono font-black text-orange leading-none">
          {formatPrice(priceUsd)}
        </div>
        <div className="text-[10px] lg:text-[11px] text-text-muted mt-0.5 lg:mt-1 leading-tight">
          {priceLabel}
          {passengers > 1 && (
            <span className="block text-text-xmuted">
              ≈ {formatPrice(priceUsd * passengers)} for {passengers}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-row lg:flex-col lg:items-end gap-1 shrink-0">
        {hasSelfTransfer ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 lg:px-2 lg:py-1 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-[10px] lg:text-[11px] font-semibold whitespace-nowrap">
            <AlertTriangle size={10} className="lg:hidden" />
            <AlertTriangle size={11} className="hidden lg:inline" />
            Self-transfer
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 lg:px-2 lg:py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-[10px] lg:text-[11px] font-semibold whitespace-nowrap">
            <ShieldCheck size={10} className="lg:hidden" />
            <ShieldCheck size={11} className="hidden lg:inline" />
            Protected
          </span>
        )}
        {separateTickets && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 lg:px-2 lg:py-1 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-[10px] lg:text-[11px] font-semibold whitespace-nowrap">
            <Ticket size={10} className="lg:hidden" />
            <Ticket size={11} className="hidden lg:inline" />
            Separate tickets
          </span>
        )}
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
