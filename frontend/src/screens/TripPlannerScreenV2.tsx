import { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { Airport, LocationSelection, selectionLabel } from '@fast-travel/shared';
import { MarketingShellV2 } from '../components/MarketingShellV2';
import { V2ToolHero } from '../components/V2ToolHero';
import { AirportSearchInput } from '../components/AirportSearchInput';
import { TripMapColumn } from '../components/TripMapColumn';
import { DateRangePicker } from '../components/DateRangePicker';
import { NearbyAirportRow } from '../components/NearbyAirportRow';
import { MobileViewToggle, type MobileView } from '../components/MobileViewToggle';
import { planBudgetTrip, BudgetPlanResult } from '../api/budgetTrip.api';
import { nearbyAirportsByCoords } from '../api/airports.api';
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

  // Submit
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BudgetPlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mobile view toggle
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
    setLoading(true);
    setError(null);
    setResult(null);
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
      });
      setResult(res);
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

  return (
    <MarketingShellV2
      active="budget"
      title="Budget Planner"
      description="Set a budget — we build the cheapest multi-stop trip that fits."
      onMenuOpen={onMenuOpen}
      showShare={!!result}
    >
      <section className="max-w-6xl xl:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 pt-6 md:pt-14 pb-10">
        {/* Two-column on lg+: [hero + result + map] left, form right */}
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 lg:gap-10">
          {/* LEFT: hero + (mobile toggle) + result panel + map */}
          <div>
            <V2ToolHero
              toolName="Budget Planner"
              titleLine1="Plan within your"
              titleAccent="budget"
              subhead="Set a total budget per person — we search live fares and assemble the cheapest multi-stop trip that fits, return flights included."
            />

            <div className="md:hidden mb-5">
              <MobileViewToggle value={mobileView} onChange={setMobileView} />
            </div>

            <div className={`flex flex-col gap-6 ${mobileView === 'map' ? '' : 'hidden'} md:flex`}>
              {result && (
                <div
                  className="bg-surface rounded-[24px] border border-border/60 p-5 md:p-6"
                  style={{ boxShadow: '0 20px 50px -20px rgba(15,23,42,0.18)' }}
                >
                  <div className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald mb-1">
                      Your trip
                    </p>
                    <h3 className="text-xl font-black text-text-primary">
                      ${result.totalCostPerPerson}{' '}
                      <span className="text-sm font-semibold text-text-muted">per person</span>
                    </h3>
                  </div>
                  <div className="border-t border-border/40">
                    {result.legs.map((leg, i) => (
                      <div
                        key={`${leg.flightId}-${i}`}
                        className="py-3 border-b border-border/30 last:border-0 flex items-start gap-3"
                      >
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
                        <span className="text-[14px] font-bold text-text-primary shrink-0">
                          ${leg.priceUsd}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <TripMapColumn
                origin={origin ? airportToSelection(origin) : null}
              />
            </div>
          </div>

          {/* RIGHT: form card */}
          <div
            className={`bg-surface rounded-[24px] border border-border/60 p-5 md:p-6 ${mobileView === 'list' ? '' : 'hidden'} md:block`}
            style={{ boxShadow: '0 20px 50px -20px rgba(15,23,42,0.18)' }}
          >
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
                    You'll spend all <strong className="text-text-primary">{tripNights} nights</strong>{' '}
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
          </div>

        </div>

        {/* end body grid */}

        {/* Mobile: start-over link below the body */}
        <div className="mt-6 flex justify-center md:hidden">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={14} />
            Start over with a different tool
          </button>
        </div>
      </section>
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
