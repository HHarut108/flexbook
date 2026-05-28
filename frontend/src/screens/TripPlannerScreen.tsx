import { useState, useRef, useMemo, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { format } from 'date-fns';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  List as ListIcon,
  Loader2,
  Map as MapIcon,
  MapPin,
  PlaneLanding,
  PlaneTakeoff,
  RefreshCw,
  Users,
  Wallet,
  CalendarDays,
} from 'lucide-react';
import { Airport, TripLeg } from '@fast-travel/shared';
import { useAirportSearch } from '../hooks/useAirportSearch';
import { useTripStore } from '../store/trip.store';
import { useSessionStore } from '../store/session.store';
import { clearSessionHint } from '../utils/sessionHint';
import { planBudgetTrip, BudgetPlanResult, BudgetPlanLeg } from '../api/budgetTrip.api';
import { nearbyAirportsByCoords } from '../api/airports.api';
import { resolveUserCoords, readCachedCoords, readCachedNearby, cacheNearby } from '../utils/geolocation.utils';

const TripMap = lazy(() => import('../components/TripMap').then((m) => ({ default: m.TripMap })));

const POPULAR_AIRPORTS: Pick<Airport, 'iata' | 'name' | 'city'>[] = [
  { iata: 'IST', name: 'Istanbul Airport', city: { id: 'ist', name: 'Istanbul', countryCode: 'TR', countryName: 'Turkey', lat: 41.01, lng: 28.98 } },
  { iata: 'LHR', name: 'Heathrow Airport', city: { id: 'lon', name: 'London', countryCode: 'GB', countryName: 'United Kingdom', lat: 51.47, lng: -0.46 } },
  { iata: 'CDG', name: 'Charles de Gaulle', city: { id: 'par', name: 'Paris', countryCode: 'FR', countryName: 'France', lat: 49.01, lng: 2.55 } },
];

/* ── types ── */

type DestCount = number | 'max'; // number = 1-15; 'max' = let algorithm decide
type TripStyle = 'value' | 'offpath' | 'sunny' | 'short';

/* ── helpers ── */

function fmt(dateStr: string) {
  return format(new Date(dateStr.slice(0, 10) + 'T12:00:00'), 'EEE, MMM d');
}

function fmtDisplay(dateStr: string) {
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00');
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function nightsBetween(from: string, to: string): number {
  if (!from || !to) return 0;
  const diff = Math.floor(
    (new Date(to + 'T12:00:00').getTime() - new Date(from + 'T12:00:00').getTime()) /
      (1000 * 60 * 60 * 24),
  );
  return Math.max(1, diff);
}

/** Returns per-stop night counts dividing totalNights into numDests parts.
 *  Remainder nights are distributed one-each to the first stops. */
function defaultNightsArr(numDests: number, totalNights: number): number[] {
  if (numDests <= 0 || totalNights <= 0) return [];
  const base = Math.floor(totalNights / numDests);
  const rem = totalNights % numDests;
  return Array.from({ length: numDests }, (_, i) => base + (i < rem ? 1 : 0));
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/* ── DateRangePicker — compact 5-row week-view, today centred in row 2 ── */

function makeSundayOf(d: Date): Date {
  const s = new Date(d);
  s.setDate(s.getDate() - s.getDay());
  return s;
}

function dateStrOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function DateRangePicker({
  dateFrom,
  dateTo,
  today,
  onChangeFrom,
  onChangeTo,
}: {
  dateFrom: string;
  dateTo: string;
  today: string;
  onChangeFrom: (v: string) => void;
  onChangeTo: (v: string) => void;
}) {
  const todayObj = new Date(today + 'T12:00:00');
  const [phase, setPhase] = useState<'from' | 'to'>(dateFrom && !dateTo ? 'to' : 'from');

  // Window start = Sunday of the week 1 week before today → today lands in row 2
  const minWindowStart = makeSundayOf(todayObj); // earliest allowed (Sunday of today's week)
  const initStart = makeSundayOf(new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate() - 7));
  const [windowStart, setWindowStart] = useState(initStart < minWindowStart ? minWindowStart : initStart);

  const canGoPrev = windowStart > minWindowStart;

  function prevWeek() {
    if (!canGoPrev) return;
    setWindowStart(ws => {
      const n = new Date(ws);
      n.setDate(n.getDate() - 7);
      return n < minWindowStart ? minWindowStart : n;
    });
  }
  function nextWeek() {
    setWindowStart(ws => {
      const n = new Date(ws);
      n.setDate(n.getDate() + 7);
      return n;
    });
  }

  // 5 rows × 7 cols = 35 cells
  const cells = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(windowStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Month label for the header
  const firstCell = cells[0];
  const lastCell = cells[34];
  const headerLabel =
    firstCell.getMonth() === lastCell.getMonth() && firstCell.getFullYear() === lastCell.getFullYear()
      ? `${MONTH_NAMES[firstCell.getMonth()]} ${firstCell.getFullYear()}`
      : firstCell.getFullYear() === lastCell.getFullYear()
        ? `${MONTH_NAMES[firstCell.getMonth()]} – ${MONTH_NAMES[lastCell.getMonth()]} ${lastCell.getFullYear()}`
        : `${MONTH_NAMES[firstCell.getMonth()]} ${firstCell.getFullYear()} – ${MONTH_NAMES[lastCell.getMonth()]} ${lastCell.getFullYear()}`;

  function handleDayClick(dateStr: string) {
    if (dateStr < today) return;
    if (phase === 'from' || (dateFrom && dateTo)) {
      onChangeFrom(dateStr);
      onChangeTo('');
      setPhase('to');
    } else if (dateStr <= dateFrom) {
      onChangeFrom(dateStr);
      onChangeTo('');
    } else {
      onChangeTo(dateStr);
      setPhase('from');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-text-muted px-1">Travel window</span>

      {/* Departure / Return chips — only highlight whichever date is actively being picked */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setPhase('from')}
          className={`flex flex-col p-3 rounded-2xl border transition-all text-left ${
            phase === 'from' && !(dateFrom && dateTo) ? 'border-indigo bg-indigo-soft' : 'border-border bg-surface-2'
          }`}
        >
          <span className="text-[10px] uppercase tracking-wide font-semibold text-text-xmuted">Departure</span>
          <span className={`text-sm font-semibold mt-0.5 ${dateFrom ? 'text-text-primary' : 'text-text-xmuted'}`}>
            {dateFrom ? fmtDisplay(dateFrom) : 'dd.mm.yyyy'}
          </span>
        </button>
        <button
          type="button"
          onClick={() => { if (dateFrom) setPhase('to'); }}
          disabled={!dateFrom}
          className={`flex flex-col p-3 rounded-2xl border transition-all text-left ${
            phase === 'to' && !(dateFrom && dateTo) ? 'border-indigo bg-indigo-soft' : 'border-border bg-surface-2'
          } ${!dateFrom ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          <span className="text-[10px] uppercase tracking-wide font-semibold text-text-xmuted">Return</span>
          <span className={`text-sm font-semibold mt-0.5 ${dateTo ? 'text-text-primary' : 'text-text-xmuted'}`}>
            {dateTo ? fmtDisplay(dateTo) : 'dd.mm.yyyy'}
          </span>
        </button>
      </div>

      {/* Compact week-view calendar */}
      <div className="bg-surface border border-border rounded-2xl p-3">
        {/* Nav */}
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={prevWeek}
            disabled={!canGoPrev}
            className="p-1 rounded-lg hover:bg-surface-2 transition-colors text-text-muted disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous week"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-semibold text-text-primary">{headerLabel}</span>
          <button
            type="button"
            onClick={nextWeek}
            className="p-1 rounded-lg hover:bg-surface-2 transition-colors text-text-muted"
            aria-label="Next week"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Day-name row */}
        <div className="grid grid-cols-7 mb-0.5">
          {DAY_NAMES.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-text-xmuted py-0.5">{d}</div>
          ))}
        </div>

        {/* 5 × 7 day grid */}
        <div className="grid grid-cols-7">
          {cells.map((dayObj, i) => {
            const dateStr = dateStrOf(dayObj);
            const isPast = dateStr < today;
            const isFrom = dateStr === dateFrom;
            const isTo = dateStr === dateTo;
            const inRange = !!(dateFrom && dateTo && dateStr > dateFrom && dateStr < dateTo);
            const isToday = dateStr === today;

            // Dim days that belong to a different month than the majority visible
            const midMonth = cells[17].getMonth();
            const isOffMonth = dayObj.getMonth() !== midMonth;

            let cls = 'relative flex items-center justify-center h-8 w-full text-[13px] transition-colors select-none rounded-lg ';
            if (isPast) {
              cls += 'opacity-25 cursor-not-allowed ';
            } else if (isFrom || isTo) {
              cls += 'bg-indigo text-white font-bold cursor-pointer ';
            } else if (inRange) {
              cls += 'bg-indigo/10 text-indigo cursor-pointer ';
            } else {
              cls += `hover:bg-surface-2 cursor-pointer ${isOffMonth ? 'text-text-xmuted' : 'text-text-primary'} `;
            }

            return (
              <button
                key={i}
                type="button"
                disabled={isPast}
                onClick={() => handleDayClick(dateStr)}
                className={cls}
                aria-label={dateStr}
                aria-pressed={isFrom || isTo}
              >
                {dayObj.getDate()}
                {isToday && !isFrom && !isTo && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-text-xmuted px-1">
        {phase === 'from' ? 'Tap a departure date' : 'Now tap your return date'}
      </p>
    </div>
  );
}

/* ── NightsSlider — multi-handle range ── */

const SEG_TEXT = ['text-indigo', 'text-violet-500', 'text-sky-500'] as const;
const SEG_SOFT = [
  'bg-indigo-soft border-indigo-border',
  'bg-violet-500/10 border-violet-500/20',
  'bg-sky-500/10 border-sky-500/20',
] as const;

/* ── NightsPerStopEditor — per-stop +/− steppers, adjacent absorption ── */

function NightsPerStopEditor({
  nights,
  totalNights,
  onChange,
}: {
  nights: number[];
  totalNights: number;
  onChange: (nights: number[]) => void;
}) {
  function changeStop(idx: number, delta: number) {
    const next = [...nights];
    const proposed = next[idx] + delta;
    if (proposed < 1) return;
    // Absorb from the next stop; fall back to previous for the last stop
    const absorbIdx = idx < nights.length - 1 ? idx + 1 : idx - 1;
    if (absorbIdx < 0) return;
    const absorbNew = next[absorbIdx] - delta;
    if (absorbNew < 1) return;
    next[idx] = proposed;
    next[absorbIdx] = absorbNew;
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2">
      {nights.map((n, i) => {
        const segIdx = i % SEG_TEXT.length;
        const absorbIdx = i < nights.length - 1 ? i + 1 : i - 1;
        const canInc = absorbIdx >= 0 && nights[absorbIdx] > 1;
        const canDec = n > 1;
        return (
          <div key={i} className={`flex items-center justify-between rounded-2xl border px-4 py-2.5 ${SEG_SOFT[segIdx]}`}>
            <span className={`text-sm font-semibold ${SEG_TEXT[segIdx]}`}>Stop {i + 1}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changeStop(i, -1)}
                disabled={!canDec}
                className="w-8 h-8 rounded-xl bg-surface border border-border flex items-center justify-center text-text-primary font-semibold text-lg transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed hover:border-indigo-border"
              >
                &minus;
              </button>
              <span className="text-sm font-semibold text-text-primary w-20 text-center">
                {n} night{n !== 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={() => changeStop(i, 1)}
                disabled={!canInc}
                className="w-8 h-8 rounded-xl bg-surface border border-border flex items-center justify-center text-text-primary font-semibold text-lg transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed hover:border-indigo-border"
              >
                +
              </button>
            </div>
          </div>
        );
      })}
      <p className="text-[11px] text-text-xmuted px-1">
        {totalNights} nights total · changing one stop shifts the adjacent
      </p>
    </div>
  );
}

/* ── PassengerStepper ── */

function PassengerStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div
      className="input-field flex items-center justify-between gap-1 px-2 rounded-2xl"
      style={{ height: '48px' }}
      role="group"
      aria-label={`${value} passenger${value > 1 ? 's' : ''}`}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        className="w-8 h-8 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-primary font-semibold text-lg transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed hover:border-indigo-border shrink-0"
        aria-label="Remove passenger"
      >
        &minus;
      </button>
      <span className="text-text-primary font-medium text-base text-center flex-1">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= 9}
        className="w-8 h-8 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-primary font-semibold text-lg transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed hover:border-indigo-border shrink-0"
        aria-label="Add passenger"
      >
        +
      </button>
    </div>
  );
}

/* ── Budget legs → TripLeg adapter (for TripMap) ── */

function budgetLegsToTripLegs(legs: BudgetPlanLeg[]): TripLeg[] {
  return legs.map((leg, i) => ({
    ...leg,
    isReturn: leg.isReturn ?? false,
    stopIndex: i + 1,
    stayDurationDays: 0,
    nextDepartureDate: leg.departureDatetime.slice(0, 10),
  }));
}

/* ── LegRow ── */

function LegRow({
  leg,
  showSwapButton,
  isSwapWarning,
  onSwapRequest,
  onSwapConfirm,
  onSwapCancel,
}: {
  leg: BudgetPlanLeg;
  showSwapButton: boolean;
  isSwapWarning: boolean;
  onSwapRequest: () => void;
  onSwapConfirm: () => void;
  onSwapCancel: () => void;
}) {
  const isReturn = leg.isReturn;
  const departureDate = fmt(leg.departureDatetime);

  return (
    <div className="py-3 border-b border-border/40 last:border-0">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${isReturn ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700' : 'bg-indigo-soft border border-indigo-border'}`}>
          {isReturn
            ? <PlaneLanding size={14} className="text-emerald-600 dark:text-emerald-400" />
            : <PlaneTakeoff size={14} className="text-indigo" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[15px] font-semibold text-text-primary">
              {leg.originCity} → {leg.destinationCity}
            </span>
            {isReturn && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 px-1.5 py-0.5 rounded-full">
                Return
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            {leg.airlineName} · {departureDate} · {leg.stops === 0 ? 'Direct' : `${leg.stops} stop${leg.stops > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[15px] font-bold text-text-primary">${leg.priceUsd}</span>
          {showSwapButton && (
            /* Desktop: icon + label pill; Mobile: icon-only circle */
            <button
              type="button"
              onClick={onSwapRequest}
              title="Try a different destination"
              className={`
                flex items-center gap-1.5 transition-all active:scale-95
                ${isSwapWarning
                  ? 'bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                  : 'bg-surface-2 border border-border text-text-muted hover:text-indigo hover:border-indigo-border hover:bg-indigo-soft'
                }
                rounded-full
                w-7 h-7 justify-center
                md:w-auto md:h-auto md:px-2.5 md:py-1 md:rounded-lg
              `}
            >
              <RefreshCw size={12} className="shrink-0" />
              <span className="hidden md:inline text-[11px] font-medium">Try different</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline swap warning */}
      {isSwapWarning && (
        <div className="mt-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-snug">
            {leg.destinationCity} and all stops after it will be replaced.
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onSwapConfirm}
              className="text-xs font-semibold text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-800/50 hover:bg-amber-200 dark:hover:bg-amber-700/50 px-2.5 py-1 rounded-lg transition-colors"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={onSwapCancel}
              className="text-xs text-amber-600 dark:text-amber-400 px-1.5 py-1 hover:underline"
            >
              Keep
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── PlanResult ── */

function PlanResult({
  result,
  passengers,
  tripStyle,
  onRetry,
  onSwap,
  swapLoading,
}: {
  result: BudgetPlanResult;
  passengers: number;
  tripStyle: TripStyle;
  onRetry: () => void;
  onSwap: (excludedIata: string) => void;
  swapLoading: boolean;
}) {
  const [swapWarningIndex, setSwapWarningIndex] = useState<number | null>(null);

  const usedPct = Math.min(100, Math.round((result.totalCostPerPerson / result.budgetPerPerson) * 100));
  const totalForGroup = result.totalCostPerPerson * passengers;
  const outboundLegs = result.legs.filter((l) => !l.isReturn);
  const firstLeg = result.legs[0];
  const lastLeg = outboundLegs[outboundLegs.length - 1];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-primary">Your trip plan</h2>
        <button onClick={onRetry} className="text-sm text-indigo font-medium hover:underline">
          {tripStyle === 'value' ? 'Re-check prices' : 'Try another'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-surface-2 border border-border text-text-muted px-3 py-1.5 rounded-full">
          <MapPin size={11} />
          {outboundLegs.length} destination{outboundLegs.length > 1 ? 's' : ''}
        </span>
        {firstLeg && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-surface-2 border border-border text-text-muted px-3 py-1.5 rounded-full">
            <CalendarDays size={11} />
            {fmt(firstLeg.departureDatetime)}
            {lastLeg && lastLeg !== firstLeg && ` – ${fmt(lastLeg.arrivalDatetime)}`}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-surface-2 border border-border text-text-muted px-3 py-1.5 rounded-full">
          <Users size={11} />
          {passengers} passenger{passengers > 1 ? 's' : ''}
        </span>
      </div>

      <div className={`bg-surface border border-border rounded-3xl px-4 py-1 transition-opacity ${swapLoading ? 'opacity-50 pointer-events-none' : ''}`}>
        {result.legs.map((leg, i) => (
          <LegRow
            key={`${leg.flightId}-${i}`}
            leg={leg}
            showSwapButton={!leg.isReturn && !swapLoading}
            isSwapWarning={swapWarningIndex === i}
            onSwapRequest={() => setSwapWarningIndex(i)}
            onSwapConfirm={() => {
              setSwapWarningIndex(null);
              onSwap(leg.destinationIata);
            }}
            onSwapCancel={() => setSwapWarningIndex(null)}
          />
        ))}
        {swapLoading && (
          <div className="flex items-center gap-2 py-3">
            <Loader2 size={14} className="animate-spin text-indigo shrink-0" />
            <span className="text-xs text-text-muted">Finding a different route…</span>
          </div>
        )}
      </div>

      <div className="bg-surface border border-border rounded-3xl p-4 space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-sm font-medium text-text-muted">Per person</span>
          <span className="text-xl font-bold text-text-primary">${result.totalCostPerPerson}</span>
        </div>
        {passengers > 1 && (
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-medium text-text-muted">{passengers} passengers total</span>
            <span className="text-base font-semibold text-text-primary">${totalForGroup}</span>
          </div>
        )}
        <div>
          <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo rounded-full transition-all duration-700"
              style={{ width: `${usedPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-text-muted">{usedPct}% of ${result.budgetPerPerson} budget</span>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">${result.budgetPerPerson - result.totalCostPerPerson} saved</span>
          </div>
        </div>
      </div>

    </div>
  );
}

/* ── Constants ── */


const STYLE_OPTIONS: { value: TripStyle; label: string; sub: string }[] = [
  { value: 'value',  label: 'Best value',      sub: 'Cheapest direct flight at every stop — stretch your budget as far as possible.' },
  { value: 'offpath', label: 'Furthest',        sub: 'Longest direct hop at each stop — budget spread evenly so later stops never run dry. May go slightly over budget on the return.' },
  { value: 'sunny',  label: 'Sun chaser',       sub: 'Picks the warmest, clearest destination available at each hop — best for winter escapes.' },
  { value: 'short',  label: 'Shortest flights', sub: 'Quickest direct hop at each stop — spend less time in the air and more time on the ground.' },
];

/* ── Main screen ── */

export function TripPlannerScreen() {
  const navigate = useNavigate();
  const { setOrigin, setPassengers, reset: resetTrip, addLeg, finalize } = useTripStore();
  const { reset: resetSession } = useSessionStore();

  // Form state
  const [originQuery, setOriginQuery] = useState('');
  const [originAirport, setOriginAirport] = useState<Airport | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [budget, setBudget] = useState('');
  const [passengers, setPassengersLocal] = useState(1);
  const [destCount, setDestCount] = useState<DestCount | null>(null);
  const [nightsPerStopArr, setNightsPerStopArr] = useState<number[]>([]);
  const [tripStyle, setTripStyle] = useState<TripStyle>('value');
  const [nearby, setNearby] = useState<Airport[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [mobileResultTab, setMobileResultTab] = useState<'list' | 'map'>('list');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const originRef = useRef<HTMLInputElement>(null);

  // Search state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BudgetPlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [excludedDestinations, setExcludedDestinations] = useState<string[]>([]);
  const [swapLoading, setSwapLoading] = useState(false);

  const { results: airportResults, loading: airportLoading } = useAirportSearch(
    dropdownOpen ? originQuery : '',
  );

  const today = todayStr();
  const tripNights = useMemo(() => nightsBetween(dateFrom, dateTo), [dateFrom, dateTo]);

  // Max destinations = floor(tripNights / 2), soft-min 2 nights per stop, cap 15
  const maxDestinations = useMemo(
    () => tripNights < 2 ? 1 : Math.min(15, Math.floor(tripNights / 2)),
    [tripNights],
  );

  // Auto-initialise destCount to 2 when the section first appears
  // (use passengersVisible directly — destCountVisible is declared further down)
  const passengersVisible = Number(budget) >= 100;
  useEffect(() => {
    if (passengersVisible && destCount === null) {
      setDestCount(Math.min(2, maxDestinations));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passengersVisible]);

  // Clamp destCount when maxDestinations shrinks (user narrows the date window)
  useEffect(() => {
    if (typeof destCount === 'number' && destCount > maxDestinations) {
      setDestCount(maxDestinations);
    }
  }, [maxDestinations, destCount]);

  // Recompute per-stop nights whenever destination count or total nights change
  useEffect(() => {
    const n = typeof destCount === 'number' ? destCount : 0;
    if (n < 1 || tripNights < n) { setNightsPerStopArr([]); return; }
    setNightsPerStopArr(defaultNightsArr(n, tripNights));
  }, [destCount, tripNights]);

  // Geolocation — serve nearby airports for the origin picker
  useEffect(() => {
    let cancelled = false;
    const cachedCoords = readCachedCoords();
    if (cachedCoords) {
      const cached = readCachedNearby<Airport>(cachedCoords.lat, cachedCoords.lng);
      if (cached) { setNearby(cached.slice(0, 3)); return; }
    }
    setGeoLoading(true);
    (async () => {
      try {
        const coords = await resolveUserCoords();
        if (cancelled) return;
        const airports = await nearbyAirportsByCoords(coords.lat, coords.lng);
        if (cancelled) return;
        cacheNearby(coords.lat, coords.lng, airports);
        setNearby(airports.slice(0, 3));
      } catch {
        // geolocation unavailable — POPULAR_AIRPORTS shown as fallback
      } finally {
        if (!cancelled) setGeoLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Progressive section visibility
  const datesVisible = !!originAirport;
  const budgetVisible = !!(dateFrom && dateTo);
  const destCountVisible = passengersVisible;
  const numericDests = typeof destCount === 'number' ? destCount : 0;
  const showNightsSection = destCount !== null && tripNights > 0;
  const tripStyleVisible = destCount !== null;

  // Per-stop nights come directly from state (managed by NightsPerStopEditor or auto-init)
  const nightsPerDestArray = nightsPerStopArr;

  // Auto mode: spread tripNights evenly across maxDestinations hops
  const { maxModeNumHops, maxModeNightsArray } = useMemo(() => {
    if (destCount !== 'max' || tripNights <= 0) return { maxModeNumHops: 0, maxModeNightsArray: [] as number[] };
    const numHops = Math.max(1, maxDestinations);
    const base = Math.floor(tripNights / numHops);
    const rem = tripNights % numHops;
    const arr = Array.from({ length: numHops }, (_, i) => base + (i < rem ? 1 : 0));
    return { maxModeNumHops: numHops, maxModeNightsArray: arr };
  }, [destCount, tripNights, maxDestinations]);

  const effectiveNightsForApi = useMemo(() => {
    if (destCount === 'max') return Math.floor(tripNights / Math.max(1, maxModeNumHops));
    if (numericDests === 1) return tripNights;
    if (numericDests >= 2 && tripNights > 0) return Math.round(tripNights / numericDests);
    return 4;
  }, [destCount, numericDests, tripNights, maxModeNumHops]);

  const canSearch =
    originAirport !== null &&
    dateFrom !== '' &&
    dateTo !== '' &&
    Number(budget) >= 100 &&
    destCount !== null;

  async function handleSearch() {
    if (!canSearch || !originAirport || destCount === null) return;
    setLoading(true);
    setError(null);
    setErrorStatus(null);
    setResult(null);
    setExcludedDestinations([]);
    setMobileResultTab('list');
    try {
      const apiMaxStops = destCount === 'max'
        ? Math.max(1, maxModeNumHops)
        : (typeof destCount === 'number' ? destCount : 1);
      const data = await planBudgetTrip({
        originIata: originAirport.iata,
        departureDateFrom: dateFrom,
        departureDateTo: dateTo,
        budgetPerPerson: Math.round(Number(budget)),
        passengers,
        maxStops: apiMaxStops,
        nightsPerStop: effectiveNightsForApi,
        nightsPerStopArray: destCount === 'max'
          ? (maxModeNightsArray.length > 0 ? maxModeNightsArray : undefined)
          : (nightsPerDestArray.length > 0 ? nightsPerDestArray : undefined),
        tripStyle,
        excludedDestinations: excludedDestinations.length > 0 ? excludedDestinations : undefined,
      });
      setResult(data);
    } catch (err: any) {
      const status = err?.status;
      const raw = err?.message ?? 'Something went wrong. Please try again.';
      const msg = status === 401 ? 'Your session has expired. Please log in again.' : raw;
      if (status === 401) clearSessionHint();
      setError(msg);
      setErrorStatus(status ?? null);
    } finally {
      setLoading(false);
    }
  }

  function handleStartTrip() {
    if (!result || !originAirport) return;

    // Wipe any previous trip and session state so we start clean.
    resetTrip();
    resetSession();

    // Re-hydrate stores with the Budget Planner's computed plan.
    setOrigin(originAirport);
    setPassengers(passengers);

    const outbound = result.legs.filter((l) => !l.isReturn);
    const returnLeg = result.legs.find((l) => l.isReturn);
    const allLegsOrdered = [...outbound, ...(returnLeg ? [returnLeg] : [])];

    allLegsOrdered.forEach((leg, i) => {
      // nextDepartureDate = when the NEXT flight departs (= this stop's check-out day).
      // For the last leg (return), it equals its own departure date.
      const nextDepDatetime = allLegsOrdered[i + 1]?.departureDatetime ?? leg.departureDatetime;
      const nextDepartureDate = nextDepDatetime.slice(0, 10);

      // stayDurationDays = nights between arriving at this stop and flying out again.
      const arrivalMs = new Date(leg.arrivalDatetime).getTime();
      const nextDepMs  = new Date(nextDepDatetime).getTime();
      const stayDurationDays = leg.isReturn
        ? 0
        : Math.max(1, Math.round((nextDepMs - arrivalMs) / 86_400_000));

      addLeg({
        ...leg,
        stopIndex: i + 1,
        stayDurationDays,
        nextDepartureDate,
        isReturn: leg.isReturn ?? false,
      });
    });

    // Mark trip complete so ItineraryScreen shows the full summary.
    finalize();
    navigate('/itinerary');
  }

  function handleRetry() {
    setResult(null);
    setError(null);
    setErrorStatus(null);
    setExcludedDestinations([]);
    setMobileResultTab('list');
  }

  async function handleSwap(excludedIata: string) {
    if (!originAirport || destCount === null) return;
    const nextExcluded = [...excludedDestinations, excludedIata];
    setExcludedDestinations(nextExcluded);
    setSwapLoading(true);
    setError(null);
    try {
      const apiMaxStops = destCount === 'max'
        ? Math.max(1, maxModeNumHops)
        : (typeof destCount === 'number' ? destCount : 1);
      const data = await planBudgetTrip({
        originIata: originAirport.iata,
        departureDateFrom: dateFrom,
        departureDateTo: dateTo,
        budgetPerPerson: Math.round(Number(budget)),
        passengers,
        maxStops: apiMaxStops,
        nightsPerStop: effectiveNightsForApi,
        nightsPerStopArray: destCount === 'max'
          ? (maxModeNightsArray.length > 0 ? maxModeNightsArray : undefined)
          : (nightsPerDestArray.length > 0 ? nightsPerDestArray : undefined),
        tripStyle,
        excludedDestinations: nextExcluded,
      });
      setResult(data);
    } catch (err: any) {
      const status = err?.status;
      const raw = err?.message ?? 'No alternative found. Try adjusting your budget or dates.';
      setError(status === 401 ? 'Your session has expired. Please log in again.' : raw);
      setErrorStatus(status ?? null);
      if (status === 401) clearSessionHint();
    } finally {
      setSwapLoading(false);
    }
  }

  function renderResults() {
    if (result) {
      return (
        <div className="space-y-3">
          {/* Swap error — shown above the still-visible result so user keeps their plan */}
          {error && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3">
              <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-xs text-amber-600 dark:text-amber-400 hover:underline mt-1"
              >
                Dismiss
              </button>
            </div>
          )}
          <PlanResult
            result={result}
            passengers={passengers}
            tripStyle={tripStyle}
            onRetry={handleRetry}
            onSwap={handleSwap}
            swapLoading={swapLoading}
          />
        </div>
      );
    }
    if (error) {
      return (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-4 py-3">
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
          {errorStatus === 401 ? (
            <button
              onClick={() => navigate('/login?from=/trip-planner')}
              className="text-xs text-red-500 dark:text-red-400 hover:underline mt-1 font-semibold"
            >
              Go to login →
            </button>
          ) : (
            <button onClick={handleRetry} className="text-xs text-red-500 dark:text-red-400 hover:underline mt-1">
              Try different inputs
            </button>
          )}
        </div>
      );
    }
    if (loading) {
      return (
        <div className="hidden md:flex flex-col items-center gap-3 py-16 text-center">
          <Loader2 size={32} className="animate-spin text-indigo" />
          <p className="text-sm text-text-muted">Planning your adventure…</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-soft border border-indigo-border flex items-center justify-center">
          <Wallet size={24} className="text-indigo" />
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">Set your budget, we'll do the rest</p>
          <p className="text-xs text-text-muted mt-1">
            We'll find the cheapest multi-stop adventure that fits your budget per person.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <Helmet>
        <title>Budget Planner · Fast Travel</title>
      </Helmet>

      {/* Header */}
      <header className="flex items-center gap-3 px-4 md:px-8 py-4 border-b border-border sticky top-0 bg-bg z-10">
        <button
          onClick={() => navigate(-1)}
          className="p-1 -ml-1 text-text-muted hover:text-text-primary transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-text-primary">Budget Planner</h1>
          <p className="text-xs text-text-muted">Find a multi-stop adventure within your budget</p>
        </div>
        {result && (
          <button
            onClick={handleStartTrip}
            className="flex flex-col items-end text-right group shrink-0 min-w-0"
          >
            <span className="flex items-center gap-1 text-sm font-semibold text-indigo group-hover:underline leading-tight">
              Plan this trip
              <PlaneTakeoff size={13} className="shrink-0" />
            </span>
            <span className="text-xs text-text-muted leading-tight">Start booking your adventure</span>
          </button>
        )}
      </header>

      {/* Content — single column on mobile, two columns on desktop */}
      <div className="max-w-screen-lg mx-auto px-4 md:px-8 py-6 md:grid md:grid-cols-[400px_1fr] md:gap-10 md:items-start">

        {/* ── Form column ── */}
        <div className="space-y-5">

          {/* 1. Origin — always visible */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-muted px-1">Flying from</span>
            <div className="relative">
              <label className="input-field flex items-center gap-2 px-3 rounded-2xl" style={{ height: '48px' }}>
                <MapPin size={16} className="text-text-xmuted shrink-0" />
                <input
                  ref={originRef}
                  type="text"
                  placeholder="City or airport"
                  value={originAirport ? `${originAirport.city.name} (${originAirport.iata})` : originQuery}
                  onChange={(e) => {
                    setOriginQuery(e.target.value);
                    setOriginAirport(null);
                    setDropdownOpen(true);
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                  className="flex-1 bg-transparent text-text-primary placeholder:text-text-xmuted text-base outline-none"
                  autoComplete="off"
                  aria-label="Origin city or airport"
                />
                {airportLoading && <Loader2 size={14} className="text-text-muted animate-spin shrink-0" />}
                {originAirport && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setOriginAirport(null);
                      setOriginQuery('');
                      originRef.current?.focus();
                    }}
                    className="text-text-muted hover:text-text-primary transition-colors shrink-0"
                    aria-label="Clear origin"
                  >
                    ×
                  </button>
                )}
              </label>

              {dropdownOpen && airportResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-2xl shadow-lg overflow-hidden z-20">
                  {airportResults.slice(0, 5).map((airport) => (
                    <button
                      key={airport.iata}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setOriginAirport(airport);
                        setOriginQuery('');
                        setDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-soft/50 transition-colors border-b border-border/40 last:border-0 text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-soft border border-indigo-border flex items-center justify-center shrink-0">
                        <PlaneTakeoff size={13} className="text-indigo" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-text-primary truncate">
                          {airport.city.name}
                          <span className="ml-2 text-xs font-mono font-bold text-indigo-mid">{airport.iata}</span>
                        </p>
                        <p className="text-xs text-text-muted truncate">{airport.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Nearby airports — visible until the user picks one */}
          {!originAirport && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <MapPin size={12} className="text-indigo-mid shrink-0" />
                <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-text-muted">
                  {geoLoading ? 'Detecting nearby airports…' : 'Nearby airports'}
                </span>
                {geoLoading && <Loader2 size={11} className="text-indigo animate-spin shrink-0" />}
              </div>
              {!geoLoading && (nearby.length > 0 ? nearby : POPULAR_AIRPORTS).map((airport) => (
                <button
                  key={airport.iata}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setOriginAirport(airport as Airport);
                    setOriginQuery('');
                    setDropdownOpen(false);
                  }}
                  className="flex items-center gap-3 px-4 py-3 bg-surface-2 hover:bg-indigo-soft/50 border border-border rounded-2xl transition-all text-left"
                >
                  <div className="w-8 h-8 rounded-xl bg-indigo-soft border border-indigo-border flex items-center justify-center shrink-0">
                    <MapPin size={13} className="text-indigo" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text-primary truncate">
                      {airport.city.name}
                      <span className="ml-2 text-xs font-mono font-bold text-indigo-mid">{airport.iata}</span>
                    </p>
                    <p className="text-xs text-text-muted truncate">{airport.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* 2. Dates — unlocked after origin */}
          {datesVisible && (
            <DateRangePicker
              dateFrom={dateFrom}
              dateTo={dateTo}
              today={today}
              onChangeFrom={(v) => {
                setDateFrom(v);
                if (dateTo && v >= dateTo) setDateTo('');
              }}
              onChangeTo={setDateTo}
            />
          )}

          {/* 3. Budget — unlocked after dates */}
          {budgetVisible && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-text-muted px-1">Flight ticket budget per person</span>
              <label className="input-field flex items-center gap-2 px-3 rounded-2xl" style={{ height: '48px' }}>
                <DollarSign size={16} className="text-text-xmuted shrink-0" />
                <input
                  type="number"
                  min={100}
                  max={100000}
                  placeholder="500"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="flex-1 bg-transparent text-text-primary placeholder:text-text-xmuted text-base outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  aria-label="Flight budget per person in USD"
                />
                <span className="text-sm text-text-muted shrink-0">USD</span>
              </label>
            </div>
          )}

          {/* 4 + 5. Passengers & Destination count — unlocked together after budget ≥ $100 */}
          {destCountVisible && (
            <div className="grid grid-cols-2 gap-3">
              {/* Passengers */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-text-muted px-1">Passengers</span>
                <PassengerStepper value={passengers} onChange={setPassengersLocal} />
              </div>

              {/* Destination count */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between px-1">
                  <span className="text-xs font-medium text-text-muted">Destinations</span>
                  {tripNights >= 2 && (
                    <span className="text-[10px] text-text-xmuted">≤ {maxDestinations}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <div
                    className={`input-field flex-1 flex items-center justify-between gap-1 px-2 rounded-2xl transition-opacity ${destCount === 'max' ? 'opacity-40 pointer-events-none' : ''}`}
                    style={{ height: '48px' }}
                  >
                    <button
                      type="button"
                      onClick={() => setDestCount(Math.max(1, numericDests - 1))}
                      disabled={numericDests <= 1}
                      className="w-8 h-8 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-primary font-semibold text-lg transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed hover:border-indigo-border shrink-0"
                    >
                      &minus;
                    </button>
                    <span className="text-text-primary font-semibold text-base text-center flex-1">
                      {destCount === 'max' ? '—' : numericDests}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDestCount(Math.min(maxDestinations, numericDests + 1))}
                      disabled={numericDests >= maxDestinations}
                      className="w-8 h-8 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-primary font-semibold text-lg transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed hover:border-indigo-border shrink-0"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDestCount(destCount === 'max' ? Math.min(2, maxDestinations) : 'max')}
                    className={`h-12 px-3 rounded-2xl border text-sm font-semibold transition-all shrink-0 ${
                      destCount === 'max'
                        ? 'bg-indigo-soft border-indigo-border text-indigo'
                        : 'bg-surface-2 border-border text-text-muted hover:border-indigo-border'
                    }`}
                  >
                    Auto
                  </button>
                </div>
                {destCount === 'max' && (
                  <p className="text-[10px] text-indigo px-1">Algorithm finds max stops</p>
                )}
              </div>
            </div>
          )}

          {/* 6. Nights section — unlocked after destination count */}
          {showNightsSection && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-medium text-text-muted">How long at each stop?</span>
                <span className="text-xs font-semibold text-indigo">{tripNights} nights total</span>
              </div>

              {/* Auto mode — info panel */}
              {destCount === 'max' && (
                <div className="bg-indigo-soft border border-indigo-border rounded-2xl px-4 py-3">
                  {maxModeNumHops > 0 ? (
                    <p className="text-sm text-text-primary">
                      <strong className="text-indigo">{maxModeNumHops} stop{maxModeNumHops !== 1 ? 's' : ''}</strong>
                      {' — '}
                      {maxModeNightsArray.map((n, i) => (
                        <span key={i}>{i > 0 ? ', ' : ''}<span className="font-medium">{n} night{n !== 1 ? 's' : ''}</span></span>
                      ))}
                    </p>
                  ) : (
                    <p className="text-sm text-text-muted">Select travel dates to see the planned stops.</p>
                  )}
                </div>
              )}

              {/* Single destination */}
              {numericDests === 1 && (
                <p className="text-xs text-text-muted px-1">
                  You'll spend all <strong className="text-text-primary">{tripNights} nights</strong> at your destination.
                </p>
              )}

              {/* 2+ destinations — per-stop steppers */}
              {numericDests >= 2 && nightsPerStopArr.length === numericDests && (
                <NightsPerStopEditor
                  nights={nightsPerStopArr}
                  totalNights={tripNights}
                  onChange={setNightsPerStopArr}
                />
              )}
            </div>
          )}

          {/* 7. Trip style — unlocked after destination count */}
          {tripStyleVisible && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-text-muted px-1">What should we optimise for?</span>
              <div className="flex flex-col gap-2">
                {STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTripStyle(opt.value)}
                    className={`flex items-start gap-3 p-3 rounded-2xl border text-left transition-all ${
                      tripStyle === opt.value
                        ? 'bg-indigo-soft border-indigo-border'
                        : 'bg-surface-2 border-border hover:border-indigo-border'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                      tripStyle === opt.value ? 'border-indigo bg-indigo' : 'border-border'
                    }`}>
                      {tripStyle === opt.value && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-semibold block ${tripStyle === opt.value ? 'text-indigo' : 'text-text-primary'}`}>
                        {opt.label}
                      </span>
                      <span className="text-xs text-text-muted leading-snug">{opt.sub}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search button */}
          <button
            onClick={handleSearch}
            disabled={!canSearch || loading}
            className="w-full h-14 bg-indigo hover:bg-indigo/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-base rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span className="flex flex-col items-start leading-tight">
                  <span>Planning your adventure…</span>
                  <span className="text-xs font-normal opacity-70">This may take up to a minute</span>
                </span>
              </>
            ) : (
              <>
                <Wallet size={18} />
                Find my trip
              </>
            )}
          </button>

          {/* Results — mobile only (shown below form) */}
          <div className="md:hidden">
            {result && (
              <div className="flex gap-2 mb-3 border-b border-border pb-3">
                <button
                  type="button"
                  onClick={() => setMobileResultTab('list')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                    mobileResultTab === 'list'
                      ? 'bg-indigo-soft border-indigo-border text-indigo'
                      : 'bg-surface-2 border-border text-text-muted hover:border-indigo-border'
                  }`}
                >
                  <ListIcon size={15} />
                  Flights
                </button>
                <button
                  type="button"
                  onClick={() => setMobileResultTab('map')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                    mobileResultTab === 'map'
                      ? 'bg-indigo-soft border-indigo-border text-indigo'
                      : 'bg-surface-2 border-border text-text-muted hover:border-indigo-border'
                  }`}
                >
                  <MapIcon size={15} />
                  Map
                </button>
              </div>
            )}
            {mobileResultTab === 'map' && result && originAirport ? (
              <div className="h-72 rounded-2xl overflow-hidden border border-border">
                <Suspense fallback={<div className="h-full flex items-center justify-center text-sm text-text-muted"><Loader2 size={18} className="animate-spin text-indigo" /></div>}>
                  <TripMap origin={originAirport} legs={budgetLegsToTripLegs(result.legs)} />
                </Suspense>
              </div>
            ) : renderResults()}
          </div>
        </div>

        {/* ── Results column — desktop only ── */}
        <div className="hidden md:block sticky top-[73px]">
          {/* Map: shows a result route, the chosen origin, or a nearby-airports preview */}
          {result && originAirport ? (
            <div className="h-56 rounded-2xl overflow-hidden border border-border mb-4">
              <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 size={20} className="animate-spin text-indigo" /></div>}>
                <TripMap origin={originAirport} legs={budgetLegsToTripLegs(result.legs)} />
              </Suspense>
            </div>
          ) : originAirport ? (
            <div className="h-56 rounded-2xl overflow-hidden border border-border mb-4">
              <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 size={20} className="animate-spin text-indigo" /></div>}>
                <TripMap origin={originAirport} legs={[]} />
              </Suspense>
            </div>
          ) : !geoLoading ? (
            <div className="h-56 rounded-2xl overflow-hidden border border-border mb-4 opacity-60">
              <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 size={20} className="animate-spin text-indigo" /></div>}>
                <TripMap origin={(nearby[0] ?? POPULAR_AIRPORTS[0]) as Airport} legs={[]} />
              </Suspense>
            </div>
          ) : null}
          {renderResults()}
        </div>
      </div>
    </div>
  );
}
