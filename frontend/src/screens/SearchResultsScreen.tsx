import { useEffect, useMemo, useState } from 'react';
import { FlightOption, RoundTripOption } from '@fast-travel/shared';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { searchFlights, searchRoundTrip } from '../api/flights.api';
import { FlightCard, FlightCardSkeleton } from '../components/FlightCard';
import { RoundTripCard, RoundTripCardSkeleton } from '../components/RoundTripCard';
import { GoHomeLogo } from '../components/GoHomeLogo';
import { useAuthStore } from '../store/auth.store';
import { format } from 'date-fns';
import {
  ArrowLeft,
  ArrowRight,
  Edit3,
  Plane,
  SearchX,
  User,
  Sparkles,
  Waypoints,
  CalendarSearch,
} from 'lucide-react';

type TripType = 'oneway' | 'return' | 'multi';

interface Leg {
  origin: string;
  destination: string;
  date: string;
}

interface LegResult {
  leg: Leg;
  loading: boolean;
  error: string | null;
  flights: FlightOption[];
}

const RESULTS_LIMIT = 30;
const ROUND_TRIP_LIMIT = 15;

type StopsFilter = 'any' | 'direct' | 'one' | 'twoplus';

const STOPS_FILTER_OPTIONS: { value: StopsFilter; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'direct', label: 'Direct' },
  { value: 'one', label: '1 stop' },
  { value: 'twoplus', label: '2+ stops' },
];

function legMatchesStopsFilter(leg: { stops: number }, filter: StopsFilter): boolean {
  switch (filter) {
    case 'any':
      return true;
    case 'direct':
      return leg.stops === 0;
    case 'one':
      return leg.stops === 1;
    case 'twoplus':
      return leg.stops >= 2;
  }
}

function decodeLegs(raw: string): Leg[] {
  return raw
    .split('|')
    .map((segment) => {
      const [origin, destination, date] = segment.split(',');
      return origin && destination && date ? { origin, destination, date } : null;
    })
    .filter((leg): leg is Leg => leg !== null);
}

function formatDate(ymd: string): string {
  try {
    return format(new Date(ymd + 'T12:00:00'), 'EEE, MMM d');
  } catch {
    return ymd;
  }
}

function TripSummary({
  type,
  legs,
  passengers,
}: {
  type: TripType;
  legs: Leg[];
  passengers: number;
}) {
  const paxLabel = `${passengers} traveler${passengers > 1 ? 's' : ''}`;
  const typeLabel = type === 'oneway' ? 'One-way' : type === 'return' ? 'Return' : 'Multi-city';

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-soft text-indigo text-[11px] font-bold">
        {typeLabel}
      </span>
      {legs.map((leg, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 && <span className="text-text-xmuted">·</span>}
          <span className="font-mono font-bold text-text-primary">{leg.origin}</span>
          <Plane size={11} className="rotate-90 text-text-xmuted" />
          <span className="font-mono font-bold text-text-primary">{leg.destination}</span>
          <span className="text-text-muted">· {formatDate(leg.date)}</span>
        </span>
      ))}
      <span className="text-text-xmuted">·</span>
      <span className="text-text-muted">{paxLabel}</span>
    </div>
  );
}

function ToolCrossSell() {
  return (
    <div className="section-shell p-5 mt-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-indigo" />
        <p className="text-xs font-bold uppercase tracking-wider text-indigo">
          No luck? Try a FlexBook tool
        </p>
      </div>
      <p className="text-sm text-text-muted mb-4">
        Direct routes aren't the only way. These tools were built for exactly this moment.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Link
          to="/hop-planner"
          className="flex items-center gap-3 p-3 rounded-2xl border border-border hover:border-indigo-border bg-surface transition-colors group"
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.97) 0%, rgba(234,108,10,0.97) 100%)' }}
          >
            <Waypoints size={18} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-text-primary">Hop Planner</p>
            <p className="text-[11px] text-text-muted truncate">
              Chain the cheapest one-way fares
            </p>
          </div>
          <ArrowRight size={14} className="text-text-xmuted group-hover:text-indigo shrink-0" />
        </Link>
        <Link
          to="/when-to-go"
          className="flex items-center gap-3 p-3 rounded-2xl border border-border hover:border-indigo-border bg-surface transition-colors group"
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, rgba(13,148,136,0.97) 0%, rgba(16,185,129,0.97) 100%)' }}
          >
            <CalendarSearch size={18} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-text-primary">When To Go</p>
            <p className="text-[11px] text-text-muted truncate">
              Find the cheapest day to fly
            </p>
          </div>
          <ArrowRight size={14} className="text-text-xmuted group-hover:text-indigo shrink-0" />
        </Link>
      </div>
    </div>
  );
}

function StopsFilterChips({
  value,
  onChange,
}: {
  value: StopsFilter;
  onChange: (next: StopsFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Filter by stops">
      {STOPS_FILTER_OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={
              'px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ' +
              (active
                ? 'bg-indigo text-white border-indigo'
                : 'bg-surface text-text-secondary border-border hover:border-indigo-border hover:text-text-primary')
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

interface RoundTripResult {
  loading: boolean;
  error: string | null;
  pairs: RoundTripOption[];
}

function RoundTripSection({
  result,
  passengers,
}: {
  result: RoundTripResult;
  passengers: number;
}) {
  const [stopsFilter, setStopsFilter] = useState<StopsFilter>('any');

  const filtered = useMemo(() => {
    return result.pairs.filter(
      (p) =>
        legMatchesStopsFilter(p.outbound, stopsFilter) &&
        legMatchesStopsFilter(p.inbound, stopsFilter),
    );
  }, [result.pairs, stopsFilter]);

  function handleSelect(trip: RoundTripOption) {
    if (trip.bookingUrl) {
      window.open(trip.bookingUrl, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-3 gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-bold text-text-primary">Round-trip options</h2>
          <p className="text-[11px] text-text-muted mt-0.5">
            Outbound + return sold together — often cheaper than two one-ways.
          </p>
        </div>
        {filtered.length > 0 && (
          <p className="text-xs text-text-muted">
            <strong className="text-text-secondary">{filtered.length}</strong> result
            {filtered.length === 1 ? '' : 's'} · cheapest first
          </p>
        )}
      </div>

      <div className="mb-3">
        <StopsFilterChips value={stopsFilter} onChange={setStopsFilter} />
      </div>

      {result.loading && (
        <div className="space-y-2.5">
          <RoundTripCardSkeleton />
          <RoundTripCardSkeleton />
          <RoundTripCardSkeleton />
        </div>
      )}

      {!result.loading && result.error && (
        <div className="section-shell p-5 text-center">
          <SearchX size={28} className="text-text-xmuted mx-auto mb-2" />
          <p className="text-sm text-text-secondary">{result.error}</p>
        </div>
      )}

      {!result.loading && !result.error && result.pairs.length === 0 && (
        <div className="section-shell p-6 text-center">
          <SearchX size={28} className="text-text-xmuted mx-auto mb-2" />
          <p className="text-sm font-semibold text-text-primary">No round-trip pairs found</p>
          <p className="text-xs text-text-muted mt-1">
            Try shifting the dates a day or two — bundled fares are date-sensitive.
          </p>
        </div>
      )}

      {!result.loading && !result.error && result.pairs.length > 0 && filtered.length === 0 && (
        <div className="section-shell p-5 text-center">
          <p className="text-sm text-text-secondary">
            No round-trips match this stops filter. Try a less strict choice.
          </p>
        </div>
      )}

      {!result.loading && filtered.length > 0 && (
        <div className="space-y-2.5">
          {filtered.map((trip, i) => (
            <div key={trip.tripId} style={{ animationDelay: `${i * 30}ms` }}>
              <RoundTripCard trip={trip} passengers={passengers} onSelect={handleSelect} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultsSection({
  heading,
  result,
  passengers,
}: {
  heading: string;
  result: LegResult;
  passengers: number;
}) {
  const sorted = useMemo(
    () => [...result.flights].sort((a, b) => a.priceUsd - b.priceUsd).slice(0, RESULTS_LIMIT),
    [result.flights],
  );

  function handleSelect(flight: FlightOption) {
    if (flight.bookingUrl) {
      window.open(flight.bookingUrl, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-3">
        <h2 className="text-sm font-bold text-text-primary">{heading}</h2>
        {sorted.length > 0 && (
          <p className="text-xs text-text-muted">
            <strong className="text-text-secondary">{sorted.length}</strong> result
            {sorted.length === 1 ? '' : 's'} · cheapest first
          </p>
        )}
      </div>

      {result.loading && (
        <div className="space-y-2.5">
          <FlightCardSkeleton />
          <FlightCardSkeleton />
          <FlightCardSkeleton />
        </div>
      )}

      {!result.loading && result.error && (
        <div className="section-shell p-5 text-center">
          <SearchX size={28} className="text-text-xmuted mx-auto mb-2" />
          <p className="text-sm text-text-secondary">{result.error}</p>
        </div>
      )}

      {!result.loading && !result.error && sorted.length === 0 && (
        <div className="section-shell p-6 text-center">
          <SearchX size={28} className="text-text-xmuted mx-auto mb-2" />
          <p className="text-sm font-semibold text-text-primary">No flights found</p>
          <p className="text-xs text-text-muted mt-1">
            We couldn't find {result.leg.origin} → {result.leg.destination} on {formatDate(result.leg.date)}.
          </p>
        </div>
      )}

      {!result.loading && sorted.length > 0 && (
        <div className="space-y-2.5">
          {sorted.map((flight, i) => (
            <div key={flight.flightId} style={{ animationDelay: `${i * 30}ms` }}>
              <FlightCard
                flight={flight}
                weather={flight.weather}
                onSelect={handleSelect}
              />
              {/* Approximate per-passenger price hint for multi-traveler searches */}
              {passengers > 1 && (
                <p className="text-[10px] text-text-xmuted mt-1 text-right pr-1">
                  ≈ ${(flight.priceUsd * passengers).toFixed(0)} for {passengers} travelers
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SearchResultsScreen({ onMenuOpen }: { onMenuOpen?: () => void }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : null;

  const type = (searchParams.get('type') ?? 'oneway') as TripType;
  const passengers = Math.max(1, Math.min(9, parseInt(searchParams.get('pax') ?? '1', 10) || 1));

  const legs: Leg[] = useMemo(() => {
    if (type === 'multi') {
      const raw = searchParams.get('legs');
      return raw ? decodeLegs(raw) : [];
    }
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');
    const depart = searchParams.get('depart');
    const out: Leg[] = [];
    if (origin && destination && depart) {
      out.push({ origin, destination, date: depart });
    }
    if (type === 'return') {
      const ret = searchParams.get('return');
      if (origin && destination && ret) {
        out.push({ origin: destination, destination: origin, date: ret });
      }
    }
    return out;
    // We intentionally re-derive on every searchParams change.
  }, [searchParams, type]);

  const [results, setResults] = useState<LegResult[]>([]);
  const [roundTrip, setRoundTrip] = useState<RoundTripResult>({
    loading: false,
    error: null,
    pairs: [],
  });

  // Round-trip path: one bundled-pair call instead of two independent one-ways.
  // Splits cleanly from the leg-by-leg effect below — they never run together
  // for the same `type`.
  useEffect(() => {
    if (type !== 'return') return;
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');
    const depart = searchParams.get('depart');
    const ret = searchParams.get('return');
    if (!origin || !destination || !depart || !ret) return;

    let cancelled = false;
    setRoundTrip({ loading: true, error: null, pairs: [] });
    searchRoundTrip(origin, destination, depart, ret, {
      passengers,
      limit: ROUND_TRIP_LIMIT,
    })
      .then((pairs) => {
        if (cancelled) return;
        setRoundTrip({ loading: false, error: null, pairs });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setRoundTrip({
          loading: false,
          error: err.message || 'Could not load round-trip options',
          pairs: [],
        });
      });

    return () => {
      cancelled = true;
    };
  }, [type, searchParams, passengers]);

  // One-way + multi: fire one searchFlights call per leg, in parallel. Each
  // leg's loading and results live in its own row so independent legs render
  // as they resolve. Skipped for `return` — round-trip uses a single bundled
  // call above instead.
  useEffect(() => {
    if (type === 'return') return;
    if (legs.length === 0) return;
    let cancelled = false;
    setResults(legs.map((leg) => ({ leg, loading: true, error: null, flights: [] })));

    legs.forEach((leg, index) => {
      searchFlights(leg.origin, leg.date, {
        destination: leg.destination,
        sort: 'price',
        passengers,
      })
        .then((flights) => {
          if (cancelled) return;
          setResults((prev) =>
            prev.map((row, i) => (i === index ? { ...row, loading: false, flights } : row)),
          );
        })
        .catch((err: Error) => {
          if (cancelled) return;
          setResults((prev) =>
            prev.map((row, i) =>
              i === index
                ? { ...row, loading: false, error: err.message || 'Could not load flights for this leg' }
                : row,
            ),
          );
        });
    });

    return () => {
      cancelled = true;
    };
  }, [type, legs, passengers]);

  const hasInvalidParams = legs.length === 0;
  const allDone =
    type === 'return'
      ? !roundTrip.loading
      : results.length > 0 && results.every((r) => !r.loading);
  const totalFlights =
    type === 'return'
      ? roundTrip.pairs.length
      : results.reduce((sum, r) => sum + r.flights.length, 0);
  const noResults = allDone && totalFlights === 0 && !roundTrip.error;

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Helmet>
        <title>Flight results — FlexBook</title>
      </Helmet>

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 20% 10%, rgba(79,70,229,0.10) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 80% 5%, rgba(14,165,233,0.08) 0%, transparent 55%)',
        }}
      />

      <nav className="relative flex items-center justify-between px-5 pt-7 pb-4 md:px-8 md:py-5 lg:px-10 lg:border-b lg:border-border/50">
        <GoHomeLogo size="lg" variant="light" />

        <div className="hidden lg:flex items-center gap-1">
          <Link
            to="/"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-indigo bg-indigo-soft border border-indigo-border"
          >
            Plan
          </Link>
          <Link
            to="/trips"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-text-muted hover:text-text-primary hover:bg-surface-2 transition-all"
          >
            Trips
          </Link>
          <Link
            to="/deals"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-text-muted hover:text-text-primary hover:bg-surface-2 transition-all"
          >
            Deals
          </Link>
          <Link
            to="/tools"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-text-muted hover:text-text-primary hover:bg-surface-2 transition-all"
          >
            Tools
          </Link>
          <Link
            to="/about"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-text-muted hover:text-text-primary hover:bg-surface-2 transition-all"
          >
            About Us
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {!user && (
            <Link
              to="/login"
              className="hidden lg:block text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors"
            >
              Sign in
            </Link>
          )}
          <button
            onClick={onMenuOpen}
            className="w-10 h-10 rounded-2xl bg-surface border border-border flex items-center justify-center text-indigo-mid transition-all hover:bg-indigo-soft hover:border-indigo-border"
            style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.08)' }}
            aria-label="Account"
          >
            {initials ? (
              <span className="text-xs font-bold text-indigo leading-none">{initials}</span>
            ) : (
              <User size={16} />
            )}
          </button>
        </div>
      </nav>

      <div className="relative px-5 pb-16 md:max-w-4xl md:mx-auto md:px-8 md:pt-6 lg:px-12">
        {/* Header: trip summary + edit */}
        <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center text-text-muted hover:text-text-primary hover:border-indigo-border transition-colors shrink-0 mt-0.5"
              aria-label="Back to search"
            >
              <ArrowLeft size={15} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-mid mb-1">
                Flight results
              </p>
              {!hasInvalidParams && (
                <TripSummary type={type} legs={legs} passengers={passengers} />
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-text-secondary hover:border-indigo-border hover:text-text-primary transition-colors shrink-0"
          >
            <Edit3 size={12} /> Edit search
          </button>
        </div>

        {hasInvalidParams ? (
          <div className="section-shell p-6 text-center">
            <SearchX size={32} className="text-text-xmuted mx-auto mb-3" />
            <p className="text-base font-bold text-text-primary mb-1">Missing search details</p>
            <p className="text-sm text-text-muted mb-4">
              We couldn't read the search you tried. Start a new one from the home page.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo text-white text-sm font-bold hover:bg-indigo/90 transition-all"
            >
              Back to search <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {type === 'return' ? (
              <RoundTripSection result={roundTrip} passengers={passengers} />
            ) : (
              results.map((result, index) => {
                const heading =
                  type === 'oneway'
                    ? 'Available flights'
                    : `Leg ${index + 1}: ${result.leg.origin} → ${result.leg.destination}`;
                return (
                  <ResultsSection
                    key={`${result.leg.origin}-${result.leg.destination}-${result.leg.date}`}
                    heading={heading}
                    result={result}
                    passengers={passengers}
                  />
                );
              })
            )}

            {noResults && <ToolCrossSell />}
          </div>
        )}
      </div>
    </div>
  );
}
