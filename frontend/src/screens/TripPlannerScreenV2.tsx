import { lazy, Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowLeft,
  MapPin,
  Sparkles,
  Waypoints,
  Users,
  Loader2,
  AlertTriangle,
  PlaneTakeoff,
  PlaneLanding,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Airport, LocationSelection, selectionLabel } from '@fast-travel/shared';
import { MarketingShellV2 } from '../components/MarketingShellV2';
import { V2ToolHero } from '../components/V2ToolHero';
import { AirportSearchInput } from '../components/AirportSearchInput';
// Map column is leaflet-heavy and below the form CTA → lazy. The MapLeg
// type is erased at compile time, so it's safe to keep as a `type` import.
import type { MapLeg } from '../components/TripMapColumn';
const TripMapColumn = lazy(() =>
  import('../components/TripMapColumn').then((m) => ({ default: m.TripMapColumn })),
);
// DateRangePicker (calendar grid + date-fns logic) only appears once
// the user reveals custom dates. Lazy so the form ships without it.
const DateRangePicker = lazy(() =>
  import('../components/DateRangePicker').then((m) => ({ default: m.DateRangePicker })),
);
import { NearbyAirportRow } from '../components/NearbyAirportRow';
import { MobileViewToggle, type MobileView } from '../components/MobileViewToggle';
import { planBudgetTrip, BudgetPlanResult, BudgetPlanLeg } from '../api/budgetTrip.api';
import { nearbyAirportsByCoords } from '../api/airports.api';
import { persistSelectedTrip } from '../lib/selectedTrip';
import { useCurrentPassport } from '../hooks/useCurrentPassport';
import { VisaCheckPopup } from '../components/visa/VisaCheckPopup';
import {
  saveBudgetSnapshot,
  loadBudgetSnapshot,
  clearBudgetSnapshot,
} from '../lib/budgetPlannerState';
import {
  resolveUserCoords,
  readCachedCoords,
  readCachedNearby,
  cacheNearby,
} from '../utils/geolocation.utils';

interface Props {
  onMenuOpen?: () => void;
}

type DestCount = number | 'max';
type TripStyle = 'value' | 'visafree' | 'offpath' | 'sunny' | 'short';

// Trip-style options — same identifiers as V1 STYLE_OPTIONS (TripPlannerScreen.tsx:427)
// so we can call the existing /trips/budget-plan endpoint unchanged. Labels
// match the user's reference; the V2 surface picks its own visual treatment
// (radio cards, indigo selection state) rather than copying V1.
const STYLE_OPTIONS: { value: TripStyle; label: string; sub: string }[] = [
  { value: 'value',    label: 'Best value',       sub: 'Cheapest direct flight at every stop — stretch your budget as far as possible.' },
  { value: 'visafree', label: 'Visa-free escape', sub: 'Only destinations your passport opens automatically — no embassy queues, no e-visa forms.' },
  { value: 'offpath',  label: 'Furthest',         sub: 'Longest direct hop at each stop — budget spread evenly so later stops never run dry.' },
  { value: 'sunny',    label: 'Sun chaser',       sub: 'Picks the warmest, clearest destination available at each hop — best for winter escapes.' },
  { value: 'short',    label: 'Shortest flights', sub: 'Quickest direct hop at each stop — spend less time in the air and more time on the ground.' },
];

const POPULAR_AIRPORTS: Airport[] = [
  { iata: 'BCN', name: 'Barcelona–El Prat', timezone: 'Europe/Madrid', city: { id: 'bcn', name: 'Barcelona', countryCode: 'ES', countryName: 'Spain',          lat: 41.30, lng: 2.08 } },
  { iata: 'LHR', name: 'Heathrow',          timezone: 'Europe/London',  city: { id: 'lon', name: 'London',    countryCode: 'GB', countryName: 'United Kingdom', lat: 51.47, lng: -0.46 } },
  { iata: 'CDG', name: 'Charles de Gaulle', timezone: 'Europe/Paris',   city: { id: 'par', name: 'Paris',     countryCode: 'FR', countryName: 'France',         lat: 49.01, lng: 2.55 } },
];

function nightsBetween(from: string, to: string): number {
  if (!from || !to) return 0;
  const diff = Math.floor(
    (new Date(to + 'T12:00:00').getTime() - new Date(from + 'T12:00:00').getTime()) /
      (1000 * 60 * 60 * 24),
  );
  return Math.max(1, diff);
}

function defaultNightsArr(numDests: number, totalNights: number): number[] {
  if (numDests <= 0 || totalNights <= 0) return [];
  const base = Math.floor(totalNights / numDests);
  const rem = totalNights % numDests;
  return Array.from({ length: numDests }, (_, i) => base + (i < rem ? 1 : 0));
}

function fmtLegDate(s: string) {
  return format(new Date(s.slice(0, 10) + 'T12:00:00'), 'EEE, MMM d');
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function airportToSelection(a: Airport): LocationSelection {
  return { kind: 'airport', airport: a };
}

/** Convert budget-plan legs to MapLeg[] for RoutePreviewMap. Each destination
 *  becomes a synthetic LocationSelection — only the city.lat/lng are read by
 *  the map (via selectionCoords), so the other fields stay minimal. */
function legsToMapLegs(legs: BudgetPlanLeg[], originAirport: Airport): MapLeg[] {
  const out: MapLeg[] = [];
  let from: LocationSelection = airportToSelection(originAirport);
  for (const leg of legs) {
    const to: LocationSelection = {
      kind: 'airport',
      airport: {
        iata: leg.destinationIata,
        name: leg.destinationCity,
        timezone: '',
        city: {
          id: leg.destinationIata.toLowerCase(),
          name: leg.destinationCity,
          countryCode: leg.destinationCountry,
          countryName: leg.destinationCountry,
          lat: leg.destinationLat,
          lng: leg.destinationLng,
        },
      },
    };
    out.push({ from, to });
    from = to;
  }
  return out;
}

/* ── Steppers (lifted from V1 TripPlannerScreen) ── */

function StepperBtn({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-8 h-8 rounded-xl bg-surface border border-border flex items-center justify-center text-text-primary font-semibold text-lg transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed hover:border-indigo-border shrink-0"
    >
      {label}
    </button>
  );
}

const SEG_TEXT = ['text-indigo', 'text-violet-500', 'text-sky-500'] as const;
const SEG_SOFT = [
  'bg-indigo-soft border-indigo-border',
  'bg-violet-500/10 border-violet-500/20',
  'bg-sky-500/10 border-sky-500/20',
] as const;

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
          <div
            key={i}
            className={`flex items-center justify-between rounded-2xl border px-4 py-2.5 ${SEG_SOFT[segIdx]}`}
          >
            <span className={`text-sm font-semibold ${SEG_TEXT[segIdx]}`}>Stop {i + 1}</span>
            <div className="flex items-center gap-2">
              <StepperBtn onClick={() => changeStop(i, -1)} disabled={!canDec} label="−" />
              <span className="text-sm font-semibold text-text-primary w-20 text-center">
                {n} night{n !== 1 ? 's' : ''}
              </span>
              <StepperBtn onClick={() => changeStop(i, 1)} disabled={!canInc} label="+" />
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

/* ════════════════════════════════════════════════════════════
   V2 Budget Planner — keeps the slider-driven layout and adds
   the V1 flow fields the user asked for: travel-window date
   range, passengers stepper, destinations with Auto, per-stop
   nights editor. Submits to the same /trips/budget-plan API.
   ════════════════════════════════════════════════════════════ */

export function TripPlannerScreenV2({ onMenuOpen }: Props) {
  const navigate = useNavigate();
  const today = todayStr();

  // Origin
  const [originQuery, setOriginQuery] = useState('');
  const [origin, setOrigin] = useState<Airport | null>(null);
  const [nearby, setNearby] = useState<Airport[]>([]);
  const [geoLoading, setGeoLoading] = useState(true);

  // Budget (slider)
  const [budget, setBudget] = useState(400);

  // Travel window
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Passengers + destinations
  const [passengers, setPassengers] = useState(1);
  const [destCount, setDestCount] = useState<DestCount | null>(null);
  const [nightsPerStopArr, setNightsPerStopArr] = useState<number[]>([]);

  // Optimizer / trip style
  const [tripStyle, setTripStyle] = useState<TripStyle>('value');

  // Visa-free escape needs a passport to filter destinations against. We read
  // it from the unified resolver (session override → profile primary → none).
  const { passport } = useCurrentPassport();
  // Open the existing VisaCheckPopup when "Visa-free escape" is picked and we
  // have no passport on file. The popup handles guest signup and the
  // "save to profile" path internally; we just re-run the plan once it commits.
  const [showPassportPopup, setShowPassportPopup] = useState(false);

  // Submit
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BudgetPlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Per-leg swap state — mirrors V1 TripPlannerScreen's swap flow. Excluded
  // destinations accumulate across swaps so the planner never re-picks them
  // for the current session; the user clears them by starting a new search.
  const [excludedDestinations, setExcludedDestinations] = useState<string[]>([]);
  const [swapWarningIndex, setSwapWarningIndex] = useState<number | null>(null);
  const [swapLoading, setSwapLoading] = useState(false);

  // Form vs result view — once a plan exists we hide the inputs and surface
  // a "Modify search" link to bring the form back. Mirrors WhenToGoScreenV2.
  const [view, setView] = useState<'search' | 'result'>('search');

  // Mobile view toggle — only meaningful in result view (before a plan, the
  // form is shown full-width on mobile and there's nothing to map).
  const [mobileView, setMobileView] = useState<MobileView>('list');

  /* derived */
  const tripNights = useMemo(() => nightsBetween(dateFrom, dateTo), [dateFrom, dateTo]);
  const maxDestinations = useMemo(
    () => (tripNights < 2 ? 1 : Math.min(6, Math.floor(tripNights / 2))),
    [tripNights],
  );
  const datesVisible = !!origin;
  const passengersVisible = datesVisible && !!dateFrom && !!dateTo;
  const showNightsSection = passengersVisible && destCount !== null && tripNights > 0;
  const numericDests = typeof destCount === 'number' ? destCount : 0;
  const canSearch =
    !!origin && !!dateFrom && !!dateTo && budget >= 100 && passengers >= 1 && destCount !== null;

  /* effects */
  // Hydrate from sessionStorage on first mount — restores the user's plan
  // when they refresh the page after a successful search. Cleared by the
  // "Modify search" link and overwritten on the next submit.
  const didHydrateRef = useRef(false);
  useEffect(() => {
    if (didHydrateRef.current) return;
    didHydrateRef.current = true;
    const snap = loadBudgetSnapshot();
    if (!snap) return;
    setOrigin(snap.origin);
    setOriginQuery(selectionLabel(airportToSelection(snap.origin)));
    setBudget(snap.budget);
    setDateFrom(snap.dateFrom);
    setDateTo(snap.dateTo);
    setPassengers(snap.passengers);
    setDestCount(snap.destCount);
    setNightsPerStopArr(snap.nightsPerStopArr);
    setTripStyle(snap.tripStyle);
    setExcludedDestinations(snap.excludedDestinations);
    setResult(snap.result);
    setView('result');
  }, []);

  useEffect(() => {
    if (passengersVisible && destCount === null) {
      setDestCount(Math.min(2, maxDestinations));
    }
  }, [passengersVisible, destCount, maxDestinations]);

  useEffect(() => {
    if (typeof destCount === 'number' && destCount > maxDestinations) {
      setDestCount(maxDestinations);
    }
  }, [maxDestinations, destCount]);

  useEffect(() => {
    const n = typeof destCount === 'number' ? destCount : 0;
    if (n < 1 || tripNights < n) {
      setNightsPerStopArr([]);
      return;
    }
    setNightsPerStopArr(defaultNightsArr(n, tripNights));
  }, [destCount, tripNights]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const cachedCoords = readCachedCoords();
      if (cachedCoords) {
        const cached = readCachedNearby<Airport>(cachedCoords.lat, cachedCoords.lng);
        if (cached && cached.length > 0) {
          if (!cancelled) {
            setNearby(cached.slice(0, 3));
            setGeoLoading(false);
          }
          return;
        }
      }
      try {
        const coords = await resolveUserCoords();
        const airports = await nearbyAirportsByCoords(coords.lat, coords.lng);
        if (cancelled) return;
        cacheNearby(coords.lat, coords.lng, airports);
        setNearby(airports.slice(0, 3));
      } catch {
        if (!cancelled) setNearby(POPULAR_AIRPORTS);
      } finally {
        if (!cancelled) setGeoLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit() {
    if (!canSearch || !origin || destCount === null) return;
    // Visa-free escape needs a passport. If we don't have one yet (guest, or
    // signed-in user with no saved citizenship), open VisaCheckPopup and bail —
    // the popup's onCommitted will call runPlan with the newly-chosen code.
    if (tripStyle === 'visafree' && !passport) {
      setError(null);
      setShowPassportPopup(true);
      return;
    }
    await runPlan(passport ?? undefined);
  }

  /** Actual API call. Split from handleSubmit so VisaCheckPopup can invoke it
   *  directly with the freshly-committed passport code (avoids a render-cycle
   *  race waiting for the hook value to propagate). */
  async function runPlan(passportCodeOverride?: string) {
    if (!canSearch || !origin || destCount === null) return;
    setLoading(true);
    setError(null);
    setResult(null);
    // Fresh search resets any per-leg exclusions from a previous session.
    setExcludedDestinations([]);
    setSwapWarningIndex(null);
    try {
      const maxStops = destCount === 'max' ? Math.max(1, maxDestinations) : (destCount as number);
      const res = await planBudgetTrip({
        originIata: origin.iata,
        departureDateFrom: dateFrom,
        departureDateTo: dateTo,
        budgetPerPerson: budget,
        passengers,
        maxStops,
        nightsPerStop: Math.max(1, Math.floor(tripNights / maxStops)),
        nightsPerStopArray: destCount === 'max' ? undefined : nightsPerStopArr,
        tripStyle,
        passportCode: tripStyle === 'visafree' ? passportCodeOverride : undefined,
      });
      setResult(res);
      setView('result');
      setMobileView('list');
      // Persist for refresh recovery — the search params + the plan itself.
      saveBudgetSnapshot({
        origin,
        budget,
        dateFrom,
        dateTo,
        passengers,
        destCount,
        nightsPerStopArr,
        tripStyle,
        excludedDestinations: [],
        result: res,
      });
      // Land the user at the top of the result view rather than wherever the
      // form's scroll position left them (after a long form they're at the
      // bottom and would otherwise miss the headline price).
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Something went wrong — please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  /** Re-plan with one destination excluded — keeps the form values, just
   *  appends to excludedDestinations and re-hits /trips/budget-plan. */
  async function handleSwap(excludedIata: string) {
    if (!origin || destCount === null) return;
    const nextExcluded = [...excludedDestinations, excludedIata];
    setExcludedDestinations(nextExcluded);
    setSwapLoading(true);
    setError(null);
    try {
      const maxStops = destCount === 'max' ? Math.max(1, maxDestinations) : (destCount as number);
      const res = await planBudgetTrip({
        originIata: origin.iata,
        departureDateFrom: dateFrom,
        departureDateTo: dateTo,
        budgetPerPerson: budget,
        passengers,
        maxStops,
        nightsPerStop: Math.max(1, Math.floor(tripNights / maxStops)),
        nightsPerStopArray: destCount === 'max' ? undefined : nightsPerStopArr,
        tripStyle,
        passportCode: tripStyle === 'visafree' ? passport ?? undefined : undefined,
        excludedDestinations: nextExcluded,
      });
      setResult(res);
      saveBudgetSnapshot({
        origin,
        budget,
        dateFrom,
        dateTo,
        passengers,
        destCount,
        nightsPerStopArr,
        tripStyle,
        excludedDestinations: nextExcluded,
        result: res,
      });
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'No alternative found. Try adjusting budget or dates.';
      setError(message);
    } finally {
      setSwapLoading(false);
    }
  }

  function handleModifySearch() {
    setView('search');
    setMobileView('list');
    setError(null);
    setSwapWarningIndex(null);
    // Drop the persisted plan — modifying inputs invalidates the snapshot;
    // a fresh submit will write a new one.
    setResult(null);
    setExcludedDestinations([]);
    clearBudgetSnapshot();
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function handleBook() {
    if (!result) return;
    const saved = persistSelectedTrip({
      type: 'multi',
      passengers,
      flights: result.legs,
      bookings: result.legs.map((leg, i) => ({
        label: `Book Leg ${i + 1}: ${leg.originIata} → ${leg.destinationIata}`,
        url: leg.bookingUrl ?? '',
      })),
      totalPriceUsd: result.totalCostPerPerson * passengers,
    });
    navigate(`/trip/${saved.id}`, { state: { trip: saved } });
  }

  return (
    <MarketingShellV2
      active="budget"
      title="Budget Planner"
      description="Set a budget — we build the cheapest multi-stop trip that fits."
      onMenuOpen={onMenuOpen}
    >
      <section className="max-w-6xl xl:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 pt-6 md:pt-14 pb-10">
        {/* Two-column on lg+: [hero + map] left, form/result right */}
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 lg:gap-10">
          {/* LEFT: hero + (mobile toggle, result-only) + map */}
          <div>
            <V2ToolHero
              toolName="Budget Planner"
              titleLine1="Plan within your"
              titleAccent="budget"
              subhead="Set a total budget per person — we search live fares and assemble the cheapest multi-stop trip that fits, return flights included."
            />

            {/* Mobile toggle only appears once a plan exists. Before that, the
                form is shown full-width on mobile (there's nothing to map). */}
            {view === 'result' && (
              <div className="md:hidden mb-5">
                <MobileViewToggle value={mobileView} onChange={setMobileView} />
              </div>
            )}

            {/* Map: desktop always; mobile only when viewing a plan on the
                map tab. Renders the trip plan as polylines when result exists. */}
            <div
              className={`
                ${view === 'result' && mobileView === 'map' ? '' : 'hidden'}
                md:block
              `}
            >
              <Suspense fallback={<div className="aspect-square w-full rounded-2xl bg-surface-muted" aria-hidden />}>
                <TripMapColumn
                  origin={origin ? airportToSelection(origin) : null}
                  legs={result && origin ? legsToMapLegs(result.legs, origin) : undefined}
                />
              </Suspense>
            </div>

            {/* Mobile-map CTA — when the user is on the map tab we still want
                the primary "Book" affordance visible. Hidden on desktop (the
                desktop CTA lives inside the result card on the right). */}
            {view === 'result' && result && mobileView === 'map' && (
              <div className="md:hidden mt-5 flex flex-col items-center gap-3">
                <BookCta onClick={handleBook} />
                <ModifySearchLink onClick={handleModifySearch} />
              </div>
            )}
          </div>

          {/* RIGHT: form (view='search') or result (view='result') —
              same card shell, content swaps in place. On mobile, hidden when
              the user picks Map view. */}
          <div
            className={`
              bg-surface rounded-[24px] border border-border/60 p-5 md:p-6
              ${view === 'result' && mobileView === 'map' ? 'hidden' : ''}
              md:block
            `}
            style={{ boxShadow: '0 20px 50px -20px rgba(15,23,42,0.18)' }}
          >
            {view === 'result' && result ? (
              <ResultPanel
                result={result}
                passengers={passengers}
                onModify={handleModifySearch}
                onBook={handleBook}
                onSwap={handleSwap}
                swapLoading={swapLoading}
                swapWarningIndex={swapWarningIndex}
                setSwapWarningIndex={setSwapWarningIndex}
                error={error}
              />
            ) : (
              <>
            {/* 1. Starting from */}
            <FieldLabel>Starting from</FieldLabel>
            {origin ? (
              <button
                type="button"
                onClick={() => {
                  setOrigin(null);
                  setOriginQuery('');
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl border border-emerald/30 bg-emerald-soft text-left mb-5"
              >
                <MapPin size={16} className="text-emerald shrink-0" />
                <span className="flex-1 text-sm font-bold text-text-primary truncate">
                  {origin.city.name}{' '}
                  <span className="font-mono text-xs text-emerald">{origin.iata}</span>
                </span>
                <span className="text-xs text-text-muted">Change</span>
              </button>
            ) : (
              <div className="mb-5">
                <AirportSearchInput
                  value={originQuery}
                  onChange={(v) => setOriginQuery(v)}
                  onSelect={(sel) => {
                    if (sel.kind === 'airport') {
                      setOrigin(sel.airport);
                      setOriginQuery(selectionLabel(sel));
                    }
                  }}
                  placeholder="Origin city or airport"
                  ariaLabel="Origin"
                />
                {/* Nearby airports — same full-width row pattern used by
                    Trip Builder V2 (shared NearbyAirportRow component). */}
                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <MapPin size={11} className="text-indigo-mid" />
                    <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-text-muted">
                      {geoLoading ? 'Detecting nearby airports…' : 'Nearby airports'}
                    </p>
                    {geoLoading && <Loader2 size={11} className="text-indigo animate-spin" />}
                  </div>
                  {!geoLoading && (
                    <div className="space-y-2">
                      {(nearby.length > 0 ? nearby : POPULAR_AIRPORTS).slice(0, 3).map((a) => (
                        <NearbyAirportRow
                          key={a.iata}
                          airport={a}
                          onSelect={() => {
                            setOrigin(a);
                            setOriginQuery(selectionLabel(airportToSelection(a)));
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. Budget slider — the V2 hallmark */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-sm font-semibold text-text-secondary">My flight budget</span>
                <span className="text-xl font-black text-text-primary">${budget}</span>
              </div>
              <input
                type="range"
                min={100}
                max={2000}
                step={50}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full accent-orange"
              />
              <div className="flex justify-between text-[11px] text-text-muted mt-1">
                <span>$100</span>
                <span>$2,000</span>
              </div>
            </div>

            {/* 3. Travel window — replaces the days slider with explicit dates */}
            {datesVisible && (
              <div className="mb-5">
                <FieldLabel>Travel window</FieldLabel>
                <Suspense fallback={<div className="h-[260px] rounded-2xl bg-surface-muted" aria-hidden />}>
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
                </Suspense>
              </div>
            )}

            {/* 4 + 5. Passengers & Destinations */}
            {passengersVisible && (
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>
                    <span className="inline-flex items-center gap-1.5">
                      <Users size={11} /> Passengers
                    </span>
                  </FieldLabel>
                  <div
                    className="input-field flex items-center justify-between gap-1 px-2 rounded-2xl"
                    style={{ height: '48px' }}
                  >
                    <StepperBtn
                      onClick={() => setPassengers(Math.max(1, passengers - 1))}
                      disabled={passengers <= 1}
                      label="−"
                    />
                    <span className="text-text-primary font-medium text-base text-center flex-1">
                      {passengers}
                    </span>
                    <StepperBtn
                      onClick={() => setPassengers(Math.min(9, passengers + 1))}
                      disabled={passengers >= 9}
                      label="+"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between px-1">
                    <FieldLabel>
                      <span className="inline-flex items-center gap-1.5">
                        <Waypoints size={11} /> Destinations
                      </span>
                    </FieldLabel>
                    {tripNights >= 2 && (
                      <span className="text-[10px] text-text-xmuted">≤ {maxDestinations}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div
                      className={`input-field flex-1 flex items-center justify-between gap-1 px-2 rounded-2xl transition-opacity ${
                        destCount === 'max' ? 'opacity-40 pointer-events-none' : ''
                      }`}
                      style={{ height: '48px' }}
                    >
                      <StepperBtn
                        onClick={() => setDestCount(Math.max(1, numericDests - 1))}
                        disabled={numericDests <= 1}
                        label="−"
                      />
                      <span className="text-text-primary font-semibold text-base text-center flex-1">
                        {destCount === 'max' ? '—' : numericDests}
                      </span>
                      <StepperBtn
                        onClick={() => setDestCount(Math.min(maxDestinations, numericDests + 1))}
                        disabled={numericDests >= maxDestinations}
                        label="+"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDestCount(destCount === 'max' ? Math.min(2, maxDestinations) : 'max')
                      }
                      className={`h-12 px-3 rounded-2xl border text-sm font-semibold transition-all shrink-0 ${
                        destCount === 'max'
                          ? 'bg-indigo-soft border-indigo-border text-indigo'
                          : 'bg-surface border-border text-text-muted hover:border-indigo-border'
                      }`}
                    >
                      Auto
                    </button>
                  </div>
                  {destCount === 'max' && (
                    <p className="text-[10px] text-indigo px-1 mt-1">Algorithm finds max stops</p>
                  )}
                </div>
              </div>
            )}

            {/* 6. How long at each stop */}
            {showNightsSection && (
              <div className="mb-5">
                <div className="flex justify-between items-center px-1 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    How long at each stop?
                  </span>
                  <span className="text-xs font-semibold text-indigo">
                    {tripNights} nights total
                  </span>
                </div>
                {numericDests === 1 && (
                  <p className="text-xs text-text-muted px-1">
                    You&apos;ll spend all <strong className="text-text-primary">{tripNights} nights</strong>{' '}
                    at your destination.
                  </p>
                )}
                {numericDests >= 2 && nightsPerStopArr.length === numericDests && (
                  <NightsPerStopEditor
                    nights={nightsPerStopArr}
                    totalNights={tripNights}
                    onChange={setNightsPerStopArr}
                  />
                )}
              </div>
            )}

            {/* 7. Optimizer / trip style — same V2 row pattern as nearby
                 airports for visual consistency. Selection state is the
                 standard V2 active treatment (indigo-soft bg + indigo-border
                 + a filled indigo dot). */}
            {passengersVisible && (
              <div className="mb-5">
                <FieldLabel>What should we optimise for?</FieldLabel>
                <div className="flex flex-col gap-2">
                  {STYLE_OPTIONS.map((opt) => {
                    const isActive = tripStyle === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTripStyle(opt.value)}
                        className={`group flex items-start gap-3 w-full text-left px-4 py-3 rounded-2xl border transition-all ${
                          isActive
                            ? 'border-indigo-border bg-indigo-soft'
                            : 'border-border bg-surface hover:bg-surface-2/60 hover:border-indigo-border/60'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                            isActive ? 'border-indigo' : 'border-border-strong'
                          }`}
                        >
                          {isActive && <span className="w-2 h-2 rounded-full bg-indigo" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-bold leading-tight ${isActive ? 'text-indigo' : 'text-text-primary'}`}>
                            {opt.label}
                          </p>
                          <p className="text-[11px] text-text-muted leading-snug mt-0.5">
                            {opt.sub}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CTA */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSearch || loading}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-full bg-orange text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-orange-dark transition-all active:scale-[0.98]"
              style={{ boxShadow: '0 14px 32px -10px rgba(249,115,22,0.5)' }}
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Searching live fares…
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  Find my trip options
                </>
              )}
            </button>

            {!result && !error && (
              <p className="mt-3.5 text-xs text-text-muted text-center">
                We assemble real routes that fit under ${budget}. No account needed.
              </p>
            )}

            {error && (
              <div className="mt-4 rounded-2xl bg-error-soft border border-error/30 px-4 py-3 flex items-start gap-2.5">
                <AlertTriangle size={15} className="text-error shrink-0 mt-0.5" />
                <p className="text-xs text-error leading-relaxed">{error}</p>
              </div>
            )}
              </>
            )}
          </div>

        </div>

        {/* end body grid */}

        {/* QA fix: on mobile + list view, the ResultPanel itself already
            renders a `ModifySearchLink` under its `BookCta`, so this
            section was producing a duplicate link directly below the
            result card. Mobile + map view renders its own modify link
            higher up (inside the mobile-map CTA stack). Either way the
            user already has one reachable modify-search affordance, so
            we don't need this fallback any more. */}
      </section>

      {showPassportPopup && (
        <VisaCheckPopup
          onClose={() => setShowPassportPopup(false)}
          onCommitted={(code) => {
            setShowPassportPopup(false);
            // The committed code is already in the session store via
            // useCurrentPassport.setPassport, but the hook value won't update
            // until the next render — pass it explicitly so runPlan sees it.
            runPlan(code);
          }}
        />
      )}
    </MarketingShellV2>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1.5 px-1">
      {children}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   ResultPanel — replaces the form once a plan is generated. Shows the trip
   legs with a per-leg "Try different" swap (V1 parity), a "Modify search"
   link at the top to bring the form back, and a budget summary.
   The map column reflects the same plan; this panel stays on the list view.
   ──────────────────────────────────────────────────────────────────────────── */

interface ResultPanelProps {
  result: BudgetPlanResult;
  passengers: number;
  onModify: () => void;
  onBook: () => void;
  onSwap: (excludedIata: string) => void;
  swapLoading: boolean;
  swapWarningIndex: number | null;
  setSwapWarningIndex: (i: number | null) => void;
  error: string | null;
}

function ResultPanel({
  result,
  passengers,
  onModify,
  onBook,
  onSwap,
  swapLoading,
  swapWarningIndex,
  setSwapWarningIndex,
  error,
}: ResultPanelProps) {
  const usedPct = Math.min(
    100,
    Math.round((result.totalCostPerPerson / result.budgetPerPerson) * 100),
  );
  const totalForGroup = result.totalCostPerPerson * passengers;
  const saved = Math.max(0, result.budgetPerPerson - result.totalCostPerPerson);

  return (
    <div className="flex flex-col gap-4">
      {/* Eyebrow row — modify link is rendered as a hyperlink below the
          Book CTA further down (per design), so we only show the "Your trip"
          eyebrow here. */}
      <div className="flex items-center justify-end">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald">
          Your trip
        </p>
      </div>

      {/* Plan-level warnings (e.g. OVER_BUDGET) — informational; trip still valid. */}
      {result.warnings && result.warnings.length > 0 && (
        <div className="rounded-2xl bg-orange-soft border border-orange/40 px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle size={15} className="text-orange-dark shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            {result.warnings.map((w, i) => (
              <p key={`${w.code}-${i}`} className="text-xs text-orange-dark font-semibold leading-snug">
                {w.message}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Swap error — surface above legs so user keeps their plan visible. */}
      {error && (
        <div className="rounded-2xl bg-error-soft border border-error/30 px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle size={15} className="text-error shrink-0 mt-0.5" />
          <p className="text-xs text-error leading-relaxed">{error}</p>
        </div>
      )}

      {/* Headline price */}
      <div>
        <h3 className="text-2xl font-black text-text-primary leading-tight">
          ${result.totalCostPerPerson}{' '}
          <span className="text-sm font-semibold text-text-muted">per person</span>
        </h3>
        {passengers > 1 && (
          <p className="text-xs text-text-muted mt-0.5">
            ${totalForGroup} total · {passengers} passengers
          </p>
        )}
      </div>

      {/* Legs */}
      <div
        className={`border-t border-border/40 transition-opacity ${swapLoading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {result.legs.map((leg, i) => (
          <ResultLegRow
            key={`${leg.flightId}-${i}`}
            leg={leg}
            showSwap={!leg.isReturn && !swapLoading}
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

      {/* Budget bar */}
      <div className="bg-surface-2/60 border border-border rounded-2xl p-3.5">
        <div className="h-2 bg-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo rounded-full transition-all duration-700"
            style={{ width: `${usedPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[11px] text-text-muted">
            {usedPct}% of ${result.budgetPerPerson} budget
          </span>
          {saved > 0 && (
            <span className="text-[11px] font-semibold text-emerald">${saved} saved</span>
          )}
        </div>
      </div>

      {/* Book hero CTA — same pattern Quick Search / Trip Builder uses to
          hand off to /trip/:id where each leg's booking link lives. The
          modify-search hyperlink sits below per the user's "keep the reset
          hyperlink below the CTA" requirement. */}
      <div className="flex flex-col items-center gap-3 pt-1">
        <BookCta onClick={onBook} />
        <ModifySearchLink onClick={onModify} />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Shared CTAs — surfaced inside the result panel (list view) and below the
   mobile map view so the booking flow is reachable from either tab.
   ──────────────────────────────────────────────────────────────────────────── */

function BookCta({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2 py-4 rounded-full bg-orange text-white text-sm font-bold hover:bg-orange-dark transition-all active:scale-[0.98]"
      style={{ boxShadow: '0 14px 32px -10px rgba(249,115,22,0.5)' }}
    >
      <ExternalLink size={15} />
      Book
    </button>
  );
}

function ModifySearchLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-indigo transition-colors"
    >
      <ArrowLeft size={14} />
      Modify search
    </button>
  );
}

function ResultLegRow({
  leg,
  showSwap,
  isSwapWarning,
  onSwapRequest,
  onSwapConfirm,
  onSwapCancel,
}: {
  leg: BudgetPlanLeg;
  showSwap: boolean;
  isSwapWarning: boolean;
  onSwapRequest: () => void;
  onSwapConfirm: () => void;
  onSwapCancel: () => void;
}) {
  return (
    <div className="py-3 border-b border-border/30 last:border-0">
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
            leg.isReturn
              ? 'bg-emerald/10 border border-emerald/30'
              : 'bg-indigo-soft border border-indigo-border'
          }`}
        >
          {leg.isReturn ? (
            <PlaneLanding size={13} className="text-emerald" />
          ) : (
            <PlaneTakeoff size={13} className="text-indigo" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-text-primary truncate">
            {leg.originCity} → {leg.destinationCity}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">
            {leg.airlineName} · {fmtLegDate(leg.departureDatetime)} ·{' '}
            {leg.stops === 0 ? 'Direct' : `${leg.stops} stop${leg.stops > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[14px] font-bold text-text-primary">${leg.priceUsd}</span>
          {showSwap && (
            <button
              type="button"
              onClick={onSwapRequest}
              title="Try a different destination"
              className={`
                flex items-center gap-1.5 transition-all active:scale-95 rounded-full
                w-7 h-7 justify-center md:w-auto md:h-auto md:px-2.5 md:py-1 md:rounded-lg
                ${
                  isSwapWarning
                    ? 'bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                    : 'bg-surface-2 border border-border text-text-muted hover:text-indigo hover:border-indigo-border hover:bg-indigo-soft'
                }
              `}
            >
              <RefreshCw size={12} className="shrink-0" />
              <span className="hidden md:inline text-[11px] font-medium">Try different</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline swap confirm — shown only for the leg being swapped. */}
      {isSwapWarning && (
        <div className="mt-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-snug">
            {leg.destinationCity} and any later stops may be replaced.
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onSwapConfirm}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
            >
              Swap
            </button>
            <button
              type="button"
              onClick={onSwapCancel}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg text-text-muted hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
