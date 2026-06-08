import { FlightOption } from '@fast-travel/shared';
import { formatTime, durationLabel } from '../utils/date.utils';
import { formatPrice } from '../utils/price.utils';
import { ArrowRight, Sparkles, ShieldCheck, AlertTriangle, Ticket, Users } from 'lucide-react';

/* ── Single one-way card ─────────────────────────────────────────────────── */

interface FlightCardDetailedProps {
  flight: FlightOption;
  passengers: number;
  isBestValue?: boolean;
  logoUrl?: string;
  /** All known carrier logos (LH, W6, …) so multi-operator flights can show
   *  a stack instead of just the primary mark. */
  carrierLogos?: Record<string, string>;
  onSelect: (flight: FlightOption) => void;
}

export function FlightCardDetailed({
  flight,
  passengers,
  isBestValue,
  logoUrl,
  carrierLogos,
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
      <LegRow
        leg={flight}
        logoUrl={logoUrl}
        isBestValue={isBestValue}
        carrierLogos={carrierLogos}
      />
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
  /** Logo URLs for every carrier on this itinerary, keyed by airline code.
   *  When the itinerary spans 2+ operators, LegRow renders stacked
   *  airline marks instead of a single logo so the user can see at a
   *  glance that the ticket mixes carriers. */
  carrierLogos?: Record<string, string>;
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
/** Stop dots — one indigo node per stopover, evenly spaced along the line.
 *  Tooltips on each give the airport code so a user can see WHERE the
 *  layovers happen without expanding the card. */
function StopDots({ viaIatas }: { viaIatas: string[] }) {
  if (viaIatas.length === 0) return null;
  // Evenly distribute N stops over the segment between the start and end
  // pins. `(i + 1) / (N + 1)` keeps the dots strictly between 0% and 100%.
  return (
    <>
      {viaIatas.map((iata, i) => {
        const pct = ((i + 1) / (viaIatas.length + 1)) * 100;
        return (
          <span
            key={`${iata}-${i}`}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2 border-indigo-mid bg-surface"
            style={{ left: `${pct}%` }}
            title={iata}
            aria-label={`Stopover at ${iata}`}
          />
        );
      })}
    </>
  );
}

/** Stacked carrier marks. Up to 2 logos overlap with a slight x-offset; if
 *  the itinerary has 3+ carriers, the second slot becomes a "+N" badge. The
 *  whole stack stays the same footprint as a single mark so the leg row's
 *  airline column doesn't get wider just because the ticket mixes carriers. */
function CarrierStack({
  codes,
  carrierLogos,
  primaryCode,
  primaryLogoUrl,
  carrierName,
}: {
  codes: string[];
  carrierLogos?: Record<string, string>;
  primaryCode: string;
  primaryLogoUrl?: string;
  carrierName: string;
}) {
  const distinct = Array.from(new Set(codes.filter(Boolean)));
  const hasMixed = distinct.length > 1;
  const second = hasMixed ? distinct.find((c) => c !== primaryCode) : null;
  const overflow = Math.max(0, distinct.length - 2);

  return (
    <div className="flex shrink-0 -space-x-2">
      <BadgeMark
        code={primaryCode}
        logoUrl={primaryLogoUrl}
        alt={`${carrierName} logo`}
      />
      {hasMixed && (
        overflow > 0 ? (
          <span
            className="relative z-10 w-9 h-9 lg:w-11 lg:h-11 rounded-xl lg:rounded-2xl bg-indigo-soft border border-indigo-border shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex items-center justify-center"
            title={`Mixed: ${distinct.join(' + ')}`}
          >
            <span className="font-mono font-bold text-[11px] lg:text-[12px] text-indigo">
              +{overflow + 1}
            </span>
          </span>
        ) : second ? (
          <BadgeMark
            code={second}
            logoUrl={carrierLogos?.[second.toUpperCase()]}
            alt={`${second} logo`}
            stacked
          />
        ) : null
      )}
    </div>
  );
}

function BadgeMark({
  code,
  logoUrl,
  alt,
  stacked,
}: {
  code: string;
  logoUrl?: string;
  alt: string;
  stacked?: boolean;
}) {
  return (
    <span
      className={
        'relative w-9 h-9 lg:w-11 lg:h-11 rounded-xl lg:rounded-2xl flex items-center justify-center shrink-0 overflow-hidden bg-surface border border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ' +
        (stacked ? 'z-10' : '')
      }
      title={code}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={alt}
          className="h-5 w-7 lg:h-6 lg:w-8 object-contain"
          loading="lazy"
        />
      ) : (
        <span className="font-mono font-bold text-[11px] lg:text-[13px] text-text-primary tracking-tight">
          {code.slice(0, 2).toUpperCase()}
        </span>
      )}
    </span>
  );
}

/** Format the carrier name for the leg row. Solo: "Wizz Air Malta". Two:
 *  "Wizz Air Malta + Ryanair". 3+: "Wizz Air Malta + 2 others". Keeps the
 *  text honest about how many operators the user is buying from. */
function formatCarrierLine(leg: FlightOption): string {
  const list = leg.carriers && leg.carriers.length > 0 ? leg.carriers : [leg.airlineName];
  const filtered = list.filter(Boolean);
  if (filtered.length <= 1) return filtered[0] ?? 'Airline';
  if (filtered.length === 2) return `${filtered[0]} + ${filtered[1]}`;
  return `${filtered[0]} + ${filtered.length - 1} others`;
}

export function LegRow({
  leg,
  logoUrl,
  legLabel,
  isBestValue,
  carrierLogos,
}: LegRowProps) {
  const carrierName = formatCarrierLine(leg);
  const primaryCode = (leg.airlineCode || leg.carriers?.[0] || carrierName.slice(0, 1)).toUpperCase();
  const isDirect = leg.stops === 0;
  const viaIatas = (leg.viaIatas ?? leg.layovers?.map((l) => l.iata) ?? []).filter(Boolean);
  const layovers = (leg.layovers ?? []).filter((l) => l.durationMinutes > 0);
  const layoverCarrierCodes = leg.carriers && leg.carriers.length > 0
    ? leg.carriers.map((c) => {
        // Carriers come as airline names; the LegRow only has the primary
        // airlineCode. For the secondary stack mark we fall back to a
        // 2-letter code derived from the name when the user hasn't passed
        // explicit codes. (Backend Filights API gives us names, not codes,
        // for the multi-carrier case.)
        return c.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
      })
    : [primaryCode];
  // The stable code for the second slot in the stack — prefers a real
  // distinct code over the derived 2-letter monogram.
  const stackCodes = [primaryCode, ...layoverCarrierCodes.filter((c) => c !== primaryCode)];
  const isMixed = (leg.carriers?.length ?? 1) > 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] xl:grid-cols-[200px_1fr] gap-2 lg:gap-4 items-center">
      {/* Airline cluster. Mobile keeps it as a full-width row above the
          timeline so long carrier names (Austrian Airlines, Wizz Air Malta)
          never push the arrival time off-screen. Desktop puts it on the
          left in its own grid column. */}
      <div className="flex items-center gap-2.5 min-w-0">
        <CarrierStack
          codes={stackCodes}
          carrierLogos={carrierLogos}
          primaryCode={primaryCode}
          primaryLogoUrl={logoUrl}
          carrierName={carrierName}
        />
        <div className="min-w-0 flex-1">
          {legLabel && (
            <p className="text-[9px] uppercase tracking-[0.14em] font-bold text-text-muted leading-none mb-0.5">
              {legLabel}
            </p>
          )}
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
              {isDirect ? 'Direct' : `${leg.stops} stop${leg.stops > 1 ? 's' : ''}`}
            </p>
          </div>
          {isMixed && (
            <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-[10px] font-semibold leading-none">
              <Users size={10} /> Mixed carriers
            </span>
          )}
          {isBestValue && (
            <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo text-white text-[10px] font-semibold leading-none">
              <Sparkles size={9} /> Best value
            </span>
          )}
        </div>
      </div>

      {/* Timeline. Now plots one dot per stopover so the user can see all the
          intermediate airports at a glance, with the iatas labelled below. */}
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
              <StopDots viaIatas={viaIatas} />
              <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-mid" />
            </div>
            {/* Label each stop dot below the line with its IATA. Hidden when
                there are no stops to label. */}
            {viaIatas.length > 0 && (
              <div className="relative mt-1 h-3">
                {viaIatas.map((iata, i) => {
                  const pct = ((i + 1) / (viaIatas.length + 1)) * 100;
                  return (
                    <span
                      key={`label-${iata}-${i}`}
                      className="absolute text-[9px] lg:text-[10px] font-mono text-text-muted -translate-x-1/2"
                      style={{ left: `${pct}%` }}
                    >
                      {iata}
                    </span>
                  );
                })}
              </div>
            )}
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

        {/* Per-layover breakdown — one chip per stopover. Already-labelled
            dots show *where*; this row shows *how long* and *self-transfer
            risk*. Suppressed when the timeline dots alone tell the whole
            story (no layovers in the response). */}
        {layovers.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-[10px] lg:text-[11px] leading-tight">
            {layovers.map((lo, i) => (
              <span
                key={`${lo.iata}-${i}`}
                className={
                  'inline-flex items-center gap-1 font-medium ' +
                  (lo.selfTransfer
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400')
                }
              >
                <span
                  className={
                    'w-1 h-1 rounded-full ' +
                    (lo.selfTransfer ? 'bg-amber-500' : 'bg-emerald-500')
                  }
                />
                {durationLabel(lo.durationMinutes)} in {lo.iata}
                <span className="text-text-xmuted">·</span>
                <span className="text-text-muted">{layoverQuality(lo.durationMinutes)}</span>
                {lo.selfTransfer && (
                  <span className="text-text-xmuted">· self-transfer</span>
                )}
                {i < layovers.length - 1 && <span className="text-text-xmuted">·</span>}
              </span>
            ))}
          </div>
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
