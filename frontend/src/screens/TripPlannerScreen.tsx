import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { format, addDays } from 'date-fns';
import {
  ArrowLeft,
  CalendarDays,
  DollarSign,
  Loader2,
  MapPin,
  PlaneLanding,
  PlaneTakeoff,
  Users,
  Wallet,
} from 'lucide-react';
import { Airport } from '@fast-travel/shared';
import { useAirportSearch } from '../hooks/useAirportSearch';
import { useTripStore } from '../store/trip.store';
import { useSessionStore } from '../store/session.store';
import { clearSessionHint } from '../utils/sessionHint';
import { planBudgetTrip, BudgetPlanResult, BudgetPlanLeg } from '../api/budgetTrip.api';

/* ── helpers ── */

function fmt(dateStr: string) {
  return format(new Date(dateStr.slice(0, 10) + 'T12:00:00'), 'EEE, MMM d');
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/* ── sub-components ── */

function DatePicker({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: string;
  min: string;
  onChange: (v: string) => void;
}) {
  const display = value ? fmt(value) : 'Pick a date';
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-text-muted px-1">{label}</span>
      <label className="input-field relative flex items-center gap-2 px-3 rounded-2xl cursor-pointer" style={{ height: '48px' }}>
        <CalendarDays size={16} className="text-text-xmuted shrink-0 pointer-events-none" />
        <span className={`text-base flex-1 truncate pointer-events-none ${value ? 'text-text-primary font-medium' : 'text-text-xmuted'}`}>
          {display}
        </span>
        <input
          type="date"
          className="absolute inset-0 opacity-0 cursor-pointer"
          value={value}
          min={min}
          onChange={(e) => { if (e.target.value) onChange(e.target.value); }}
          aria-label={label}
        />
      </label>
    </div>
  );
}

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

function PlanResult({
  result,
  passengers,
  tripStyle,
  onStartTrip,
  onRetry,
}: {
  result: BudgetPlanResult;
  passengers: number;
  tripStyle: 'value' | 'surprise';
  onStartTrip: () => void;
  onRetry: () => void;
}) {
  const usedPct = Math.min(100, Math.round((result.totalCostPerPerson / result.budgetPerPerson) * 100));
  const totalForGroup = result.totalCostPerPerson * passengers;
  const outboundLegs = result.legs.filter((l) => !l.isReturn);
  const firstLeg = result.legs[0];
  const lastLeg = outboundLegs[outboundLegs.length - 1];

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-primary">Your trip plan</h2>
        <button
          onClick={onRetry}
          className="text-sm text-indigo font-medium hover:underline"
        >
          {tripStyle === 'value' ? 'Re-check prices' : 'Try another'}
        </button>
      </div>

      {/* Summary chips */}
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

      {/* Leg timeline */}
      <div className="bg-surface border border-border rounded-3xl px-4 py-1">
        {result.legs.map((leg, i) => (
          <LegRow key={`${leg.flightId}-${i}`} leg={leg} />
        ))}
      </div>

      {/* Cost breakdown */}
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

        {/* Budget bar */}
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
  const [maxStops, setMaxStops] = useState<1 | 2 | 3>(2);
  const [nightsPerStop, setNightsPerStop] = useState(4);
  const [tripStyle, setTripStyle] = useState<'value' | 'surprise'>('value');
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
  const minDateTo = dateFrom ? addDays(new Date(dateFrom), 1).toISOString().slice(0, 10) : today;

  const canSearch =
    originAirport !== null &&
    dateFrom !== '' &&
    dateTo !== '' &&
    Number(budget) >= 100;

  async function handleSearch() {
    if (!canSearch || !originAirport) return;
    setLoading(true);
    setError(null);
    setErrorStatus(null);
    setResult(null);
    try {
      const data = await planBudgetTrip({
        originIata: originAirport.iata,
        departureDateFrom: dateFrom,
        departureDateTo: dateTo,
        budgetPerPerson: Math.round(Number(budget)),
        passengers,
        maxStops,
        nightsPerStop,
        tripStyle,
      });
      setResult(data);
    } catch (err: any) {
      const status = err?.status;
      const raw = err?.message ?? 'Something went wrong. Please try again.';
      const msg = status === 401
        ? 'Your session has expired. Please log in again.'
        : raw;
      if (status === 401) {
        // Clear the hint so the next page load doesn't try to reuse the stale cookie.
        // Do NOT call logout() here — that nulls out `user` and triggers RequireAuth
        // to redirect before the error banner can render.
        clearSessionHint();
      }
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

  return (
    <div className="min-h-screen bg-bg max-w-[448px] mx-auto flex flex-col">
      <Helmet>
        <title>Budget Planner · Fast Travel</title>
      </Helmet>

      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-4 border-b border-border sticky top-0 bg-bg z-10">
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

      <div className="flex-1 px-4 py-6 space-y-5">
        {/* ── Form ── */}
        <div className="space-y-3">
          {/* Origin */}
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
                    onMouseDown={(e) => { e.preventDefault(); setOriginAirport(null); setOriginQuery(''); originRef.current?.focus(); }}
                    className="text-text-muted hover:text-text-primary transition-colors shrink-0"
                    aria-label="Clear origin"
                  >
                    ×
                  </button>
                )}
              </label>

              {/* Dropdown */}
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

          {/* Date range */}
          <div className="grid grid-cols-2 gap-2">
            <DatePicker
              label="Earliest departure"
              value={dateFrom}
              min={today}
              onChange={(v) => {
                setDateFrom(v);
                if (dateTo && v >= dateTo) setDateTo('');
              }}
            />
            <DatePicker
              label="Latest return"
              value={dateTo}
              min={minDateTo}
              onChange={setDateTo}
            />
          </div>

          {/* Budget */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-muted px-1">Budget per person</span>
            <label className="input-field flex items-center gap-2 px-3 rounded-2xl" style={{ height: '48px' }}>
              <DollarSign size={16} className="text-text-xmuted shrink-0" />
              <input
                type="number"
                min={100}
                max={100000}
                placeholder="500"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="flex-1 bg-transparent text-text-primary placeholder:text-text-xmuted text-base outline-none"
                aria-label="Budget per person in USD"
              />
              <span className="text-sm text-text-muted shrink-0">USD · flights only</span>
            </label>
          </div>

          {/* Passengers */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-muted px-1">Passengers</span>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface-2 border border-border flex items-center justify-center shrink-0">
                <Users size={14} className="text-text-muted" />
              </div>
              <PassengerStepper value={passengers} onChange={setPassengersLocal} />
            </div>
          </div>

          {/* Destination count */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-text-muted px-1">How many places do you want to visit?</span>
            <div className="flex gap-2">
              {([1, 2, 3] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMaxStops(n)}
                  className={`flex-1 h-10 rounded-2xl border text-sm font-medium transition-all ${
                    maxStops === n
                      ? 'bg-indigo-soft border-indigo-border text-indigo'
                      : 'bg-surface-2 border-border text-text-muted hover:border-indigo-border'
                  }`}
                >
                  {n} destination{n > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Nights per stop */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center px-1">
              <span className="text-xs font-medium text-text-muted">How long do you want to spend at each stop?</span>
              <span className="text-xs font-semibold text-indigo">{nightsPerStop} nights</span>
            </div>
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
          </div>

          {/* Trip style */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-text-muted px-1">What should we optimise for?</span>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'value' as const, label: 'Best value', sub: 'Cheapest possible route.' },
                { value: 'surprise' as const, label: 'Surprise me', sub: "Creative routes — 'Try another' gives a different trip each time." },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTripStyle(opt.value)}
                  className={`flex flex-col items-start gap-1 p-3 rounded-2xl border text-left transition-all ${
                    tripStyle === opt.value
                      ? 'bg-indigo-soft border-indigo-border'
                      : 'bg-surface-2 border-border hover:border-indigo-border'
                  }`}
                >
                  <span className={`text-sm font-semibold ${tripStyle === opt.value ? 'text-indigo' : 'text-text-primary'}`}>
                    {opt.label}
                  </span>
                  <span className="text-xs text-text-muted leading-snug">{opt.sub}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Search button ── */}
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

        {/* ── Error ── */}
        {error && (
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
        )}

        {/* ── Results ── */}
        {result && (
          <PlanResult
            result={result}
            passengers={passengers}
            tripStyle={tripStyle}
            onStartTrip={handleStartTrip}
            onRetry={handleRetry}
          />
        )}

        {/* ── Empty state hint ── */}
        {!result && !error && !loading && (
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
        )}
      </div>
    </div>
  );
}
