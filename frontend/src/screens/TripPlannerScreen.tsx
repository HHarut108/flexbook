import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { format } from 'date-fns';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Loader2,
  MapPin,
  PlaneLanding,
  PlaneTakeoff,
  Users,
  Wallet,
  CalendarDays,
} from 'lucide-react';
import { Airport } from '@fast-travel/shared';
import { useAirportSearch } from '../hooks/useAirportSearch';
import { useTripStore } from '../store/trip.store';
import { useSessionStore } from '../store/session.store';
import { clearSessionHint } from '../utils/sessionHint';
import { planBudgetTrip, BudgetPlanResult, BudgetPlanLeg } from '../api/budgetTrip.api';

/* ── types ── */

type DestCount = 1 | 2 | 3 | 'max';
type TripStyle = 'value' | 'surprise' | 'offpath';

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

/** Returns cumulative split positions dividing totalNights into numDests parts.
 *  Remainder nights go to the first destinations (+1 each). */
function defaultSplits(numDests: number, totalNights: number): number[] {
  const base = Math.floor(totalNights / numDests);
  const remainder = totalNights % numDests;
  const splits: number[] = [];
  let cumulative = 0;
  for (let i = 0; i < numDests - 1; i++) {
    cumulative += base + (i < remainder ? 1 : 0);
    splits.push(cumulative);
  }
  return splits;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/* ── DateRangePicker ── */

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
  const seed = dateFrom ? new Date(dateFrom + 'T12:00:00') : new Date(today + 'T12:00:00');
  const [displayMonth, setDisplayMonth] = useState(seed.getMonth());
  const [displayYear, setDisplayYear] = useState(seed.getFullYear());
  const [phase, setPhase] = useState<'from' | 'to'>(dateFrom && !dateTo ? 'to' : 'from');

  const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(displayYear, displayMonth, 1).getDay();

  function handleDayClick(day: number) {
    const dateStr = `${displayYear}-${String(displayMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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

  function prevMonth() {
    if (displayMonth === 0) { setDisplayMonth(11); setDisplayYear(y => y - 1); }
    else setDisplayMonth(m => m - 1);
  }
  function nextMonth() {
    if (displayMonth === 11) { setDisplayMonth(0); setDisplayYear(y => y + 1); }
    else setDisplayMonth(m => m + 1);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-text-muted px-1">Travel window</span>

      {/* Departure / Return chips */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setPhase('from')}
          className={`flex flex-col p-3 rounded-2xl border transition-all text-left ${
            phase === 'from' ? 'border-indigo bg-indigo-soft' : 'border-border bg-surface-2'
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
            phase === 'to' ? 'border-indigo bg-indigo-soft' : 'border-border bg-surface-2'
          } ${!dateFrom ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          <span className="text-[10px] uppercase tracking-wide font-semibold text-text-xmuted">Return</span>
          <span className={`text-sm font-semibold mt-0.5 ${dateTo ? 'text-text-primary' : 'text-text-xmuted'}`}>
            {dateTo ? fmtDisplay(dateTo) : 'dd.mm.yyyy'}
          </span>
        </button>
      </div>

      {/* Calendar */}
      <div className="bg-surface border border-border rounded-2xl p-4">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1.5 rounded-xl hover:bg-surface-2 transition-colors text-text-muted"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-text-primary">
            {MONTH_NAMES[displayMonth]} {displayYear}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1.5 rounded-xl hover:bg-surface-2 transition-colors text-text-muted"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_NAMES.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-text-xmuted py-1">{d}</div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`empty-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${displayYear}-${String(displayMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isPast = dateStr < today;
            const isFrom = dateStr === dateFrom;
            const isTo = dateStr === dateTo;
            const inRange = !!(dateFrom && dateTo && dateStr > dateFrom && dateStr < dateTo);
            const isToday = dateStr === today;

            let cls = 'relative flex items-center justify-center h-9 w-full text-sm transition-colors select-none ';
            if (isPast) {
              cls += 'opacity-25 cursor-not-allowed ';
            } else if (isFrom || isTo) {
              cls += 'bg-indigo text-white font-semibold rounded-xl cursor-pointer ';
            } else if (inRange) {
              cls += 'bg-indigo/10 text-indigo cursor-pointer ';
            } else {
              cls += 'hover:bg-surface-2 text-text-primary cursor-pointer ';
            }

            return (
              <button
                key={day}
                type="button"
                disabled={isPast}
                onClick={() => handleDayClick(day)}
                className={cls}
                aria-label={dateStr}
                aria-pressed={isFrom || isTo}
              >
                {day}
                {isToday && !isFrom && !isTo && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo" />
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

const SEG_COLORS = ['bg-indigo', 'bg-violet-500', 'bg-sky-500'] as const;
const SEG_TEXT = ['text-indigo', 'text-violet-500', 'text-sky-500'] as const;
const SEG_BORDER = ['border-indigo/30', 'border-violet-500/30', 'border-sky-500/30'] as const;

function NightsSlider({
  totalNights,
  numDestinations,
  splits,
  onChange,
}: {
  totalNights: number;
  numDestinations: number;
  splits: number[];
  onChange: (s: number[]) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingIdx = useRef<number | null>(null);

  // Keep mutable refs so pointer-event handlers always see latest values
  const splitsRef = useRef(splits);
  useEffect(() => { splitsRef.current = splits; });
  const totalRef = useRef(totalNights);
  useEffect(() => { totalRef.current = totalNights; });
  const cbRef = useRef(onChange);
  useEffect(() => { cbRef.current = onChange; });

  const handleMove = useCallback((e: PointerEvent) => {
    if (draggingIdx.current === null || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const total = totalRef.current;
    const rawNights = Math.round(ratio * total);
    const idx = draggingIdx.current;
    const s = splitsRef.current;
    const min = idx === 0 ? 1 : s[idx - 1] + 1;
    const max = idx === s.length - 1 ? total - 1 : s[idx + 1] - 1;
    const clamped = Math.max(min, Math.min(max, rawNights));
    const next = [...s];
    next[idx] = clamped;
    cbRef.current(next);
  }, []);

  const handleUp = useCallback(() => {
    draggingIdx.current = null;
    document.removeEventListener('pointermove', handleMove);
    document.removeEventListener('pointerup', handleUp);
  }, [handleMove]);

  useEffect(() => () => {
    document.removeEventListener('pointermove', handleMove);
    document.removeEventListener('pointerup', handleUp);
  }, [handleMove, handleUp]);

  function onPointerDown(e: React.PointerEvent, idx: number) {
    e.preventDefault();
    draggingIdx.current = idx;
    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  }

  const nightsPerDest = Array.from({ length: numDestinations }, (_, i) => {
    const start = i === 0 ? 0 : splits[i - 1];
    const end = i === numDestinations - 1 ? totalNights : splits[i];
    return end - start;
  });

  return (
    <div className="flex flex-col gap-3">
      {/* Per-stop chips */}
      <div className="flex gap-2 flex-wrap">
        {nightsPerDest.map((n, i) => (
          <span
            key={i}
            className={`text-xs px-2.5 py-1 rounded-full border font-medium bg-surface-2 ${SEG_TEXT[i % SEG_TEXT.length]} ${SEG_BORDER[i % SEG_BORDER.length]}`}
          >
            Stop {i + 1}: {n} night{n !== 1 ? 's' : ''}
          </span>
        ))}
      </div>

      {/* Track */}
      <div className="relative py-3">
        <div ref={trackRef} className="relative h-3 bg-surface-2 rounded-full">
          {nightsPerDest.map((nights, i) => {
            const startNight = i === 0 ? 0 : splits[i - 1];
            const left = (startNight / totalNights) * 100;
            const width = (nights / totalNights) * 100;
            const isFirst = i === 0;
            const isLast = i === numDestinations - 1;
            const br = isFirst && isLast ? '9999px'
              : isFirst ? '9999px 0 0 9999px'
              : isLast ? '0 9999px 9999px 0'
              : '0';
            return (
              <div
                key={i}
                className={`absolute h-full ${SEG_COLORS[i % SEG_COLORS.length]}`}
                style={{ left: `${left}%`, width: `${width}%`, borderRadius: br }}
              />
            );
          })}

          {splits.map((split, i) => (
            <div
              key={i}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 bg-white border-[2.5px] border-indigo rounded-full shadow-md cursor-grab active:cursor-grabbing touch-none z-10 transition-transform hover:scale-110"
              style={{ left: `${(split / totalNights) * 100}%` }}
              onPointerDown={(e) => onPointerDown(e, i)}
              aria-label={`Split at night ${split}`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2 px-0.5">
          <span className="text-xs text-text-xmuted">Night 1</span>
          <span className="text-xs text-text-xmuted">Night {totalNights}</span>
        </div>
      </div>
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

/* ── LegRow ── */

function LegRow({ leg }: { leg: BudgetPlanLeg }) {
  const isReturn = leg.isReturn;
  const departureDate = fmt(leg.departureDatetime);

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0">
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
      <span className="text-[15px] font-bold text-text-primary shrink-0">${leg.priceUsd}</span>
    </div>
  );
}

/* ── PlanResult ── */

function PlanResult({
  result,
  passengers,
  tripStyle,
  onStartTrip,
  onRetry,
}: {
  result: BudgetPlanResult;
  passengers: number;
  tripStyle: TripStyle;
  onStartTrip: () => void;
  onRetry: () => void;
}) {
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

      <div className="bg-surface border border-border rounded-3xl px-4 py-1">
        {result.legs.map((leg, i) => (
          <LegRow key={`${leg.flightId}-${i}`} leg={leg} />
        ))}
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

      <button
        onClick={onStartTrip}
        className="w-full h-14 bg-indigo hover:bg-indigo/90 text-white font-semibold text-base rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
      >
        <PlaneTakeoff size={18} />
        Start this trip
      </button>
    </div>
  );
}

/* ── Constants ── */

const DEST_OPTIONS: { value: DestCount; label: string; sublabel: string }[] = [
  { value: 1, label: '1', sublabel: 'destination' },
  { value: 2, label: '2', sublabel: 'destinations' },
  { value: 3, label: '3', sublabel: 'destinations' },
  { value: 'max', label: '∞', sublabel: 'as many as\npossible' },
];

const STYLE_OPTIONS: { value: TripStyle; label: string; sub: string }[] = [
  { value: 'value', label: 'Best value', sub: 'Cheapest route, every penny counts.' },
  { value: 'surprise', label: 'Surprise me', sub: "Serendipitous picks — 'Try another' each time." },
  { value: 'offpath', label: 'Off the beaten path', sub: 'Under-the-radar gems, fewer tourists.' },
];

/* ── Main screen ── */

export function TripPlannerScreen() {
  const navigate = useNavigate();
  const { setOrigin, setPassengers } = useTripStore();
  const { setSelectedDate } = useSessionStore();

  // Form state
  const [originQuery, setOriginQuery] = useState('');
  const [originAirport, setOriginAirport] = useState<Airport | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [budget, setBudget] = useState('');
  const [passengers, setPassengersLocal] = useState(1);
  const [destCount, setDestCount] = useState<DestCount | null>(null);
  const [nightSplits, setNightSplits] = useState<number[]>([]);
  const [nightsPerStop, setNightsPerStop] = useState(4); // for 'max' mode only
  const [tripStyle, setTripStyle] = useState<TripStyle>('value');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const originRef = useRef<HTMLInputElement>(null);

  // Search state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BudgetPlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  const { results: airportResults, loading: airportLoading } = useAirportSearch(
    dropdownOpen ? originQuery : '',
  );

  const today = todayStr();
  const tripNights = useMemo(() => nightsBetween(dateFrom, dateTo), [dateFrom, dateTo]);

  // Recompute splits whenever destination count or total nights change
  useEffect(() => {
    const n = typeof destCount === 'number' ? destCount : 0;
    if (n < 2 || tripNights < n) { setNightSplits([]); return; }
    setNightSplits(defaultSplits(n, tripNights));
  }, [destCount, tripNights]);

  // Progressive section visibility
  const datesVisible = !!originAirport;
  const budgetVisible = !!(dateFrom && dateTo);
  const passengersVisible = Number(budget) >= 100;
  const destCountVisible = passengersVisible;
  const numericDests = typeof destCount === 'number' ? destCount : 0;
  const showMultiNights = destCount !== null && numericDests >= 2 && tripNights >= numericDests;
  const showMaxNights = destCount === 'max';
  const showNightsSection = showMultiNights || showMaxNights;
  const tripStyleVisible = destCount !== null;

  // Effective nights per stop sent to API
  const effectiveNightsForApi = useMemo(() => {
    if (destCount === 'max') return nightsPerStop;
    if (destCount === 1) return tripNights;
    if (numericDests >= 2 && tripNights > 0) return Math.round(tripNights / numericDests);
    return nightsPerStop;
  }, [destCount, numericDests, tripNights, nightsPerStop]);

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
    try {
      const apiMaxStops: 1 | 2 | 3 = destCount === 'max' ? 3 : destCount;
      const apiTripStyle: 'value' | 'surprise' = tripStyle === 'offpath' ? 'surprise' : tripStyle;
      const data = await planBudgetTrip({
        originIata: originAirport.iata,
        departureDateFrom: dateFrom,
        departureDateTo: dateTo,
        budgetPerPerson: Math.round(Number(budget)),
        passengers,
        maxStops: apiMaxStops,
        nightsPerStop: effectiveNightsForApi,
        tripStyle: apiTripStyle,
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
    setOrigin(originAirport);
    setPassengers(passengers);
    const firstLeg = result.legs[0];
    if (firstLeg) setSelectedDate(firstLeg.departureDatetime.slice(0, 10));
    navigate('/flights');
  }

  function handleRetry() {
    setResult(null);
    setError(null);
    setErrorStatus(null);
  }

  function renderResults() {
    if (result) {
      return (
        <PlanResult
          result={result}
          passengers={passengers}
          tripStyle={tripStyle}
          onStartTrip={handleStartTrip}
          onRetry={handleRetry}
        />
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
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Budget Planner</h1>
          <p className="text-xs text-text-muted">Find a multi-stop adventure within your budget</p>
        </div>
      </header>

      {/* Content — single column on mobile, two columns on desktop */}
      <div className="max-w-screen-lg mx-auto px-4 md:px-8 py-6 md:grid md:grid-cols-2 md:gap-10 md:items-start">

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

          {/* 4. Passengers — unlocked after budget ≥ $100 */}
          {passengersVisible && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-text-muted px-1">Passengers</span>
              <PassengerStepper value={passengers} onChange={setPassengersLocal} />
            </div>
          )}

          {/* 5. Destination count — unlocked after passengers */}
          {destCountVisible && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-text-muted px-1">How many places do you want to visit?</span>
              <div className="grid grid-cols-4 gap-2">
                {DEST_OPTIONS.map((opt) => {
                  const active = destCount === opt.value;
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => setDestCount(opt.value)}
                      className={`flex flex-col items-center justify-center gap-0.5 py-3 px-1 rounded-2xl border text-center transition-all ${
                        active
                          ? 'bg-indigo-soft border-indigo-border'
                          : 'bg-surface-2 border-border hover:border-indigo-border'
                      }`}
                    >
                      <span className={`text-xl font-bold leading-none ${active ? 'text-indigo' : 'text-text-primary'}`}>
                        {opt.label}
                      </span>
                      <span className={`text-[10px] leading-tight whitespace-pre-line mt-0.5 ${active ? 'text-indigo/80' : 'text-text-muted'}`}>
                        {opt.sublabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. Nights section — unlocked after destination count */}
          {showNightsSection && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-medium text-text-muted">How long at each stop?</span>
                {showMaxNights && (
                  <span className="text-xs font-semibold text-indigo">
                    {nightsPerStop} night{nightsPerStop !== 1 ? 's' : ''}
                  </span>
                )}
                {showMultiNights && (
                  <span className="text-xs font-semibold text-indigo">{tripNights} nights total</span>
                )}
              </div>

              {showMaxNights && (
                <>
                  <input
                    type="range"
                    min={2}
                    max={14}
                    step={1}
                    value={nightsPerStop}
                    onChange={(e) => setNightsPerStop(Number(e.target.value))}
                    className="w-full accent-indigo"
                    aria-label={`${nightsPerStop} nights per stop`}
                  />
                  <div className="flex justify-between px-0.5">
                    <span className="text-xs text-text-xmuted">2 nights</span>
                    <span className="text-xs text-text-xmuted">14 nights</span>
                  </div>
                </>
              )}

              {showMultiNights && nightSplits.length > 0 && (
                <NightsSlider
                  totalNights={tripNights}
                  numDestinations={numericDests}
                  splits={nightSplits}
                  onChange={setNightSplits}
                />
              )}

              {destCount === 1 && tripNights > 0 && (
                <p className="text-xs text-text-muted px-1">
                  You'll spend all <strong className="text-text-primary">{tripNights} nights</strong> at your destination.
                </p>
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
            {renderResults()}
          </div>
        </div>

        {/* ── Results column — desktop only ── */}
        <div className="hidden md:block sticky top-[73px]">
          {renderResults()}
        </div>
      </div>
    </div>
  );
}
