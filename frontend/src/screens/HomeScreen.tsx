import { useState, useCallback } from 'react';
import { LocationSelection, selectionLabel, selectionToMarker } from '@fast-travel/shared';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { formatYMD } from '../utils/date.utils';
import { addDays, format } from 'date-fns';
import { GoHomeLogo } from '../components/GoHomeLogo';
import { AirportSearchInput } from '../components/AirportSearchInput';
import { SegmentedControl } from '../components/SegmentedControl';
import { ToolCard } from '../components/ToolCard';
import { TOOLS } from './ToolsScreen';
import {
  ArrowRight,
  CalendarDays,
  Plus,
  X,
  Search,
  User,
  Sparkles,
} from 'lucide-react';

type TripType = 'oneway' | 'return' | 'multi';

interface Leg {
  fromQuery: string;
  fromAirport: LocationSelection | null;
  toQuery: string;
  toAirport: LocationSelection | null;
  date: string;
}

const TRIP_TYPE_OPTIONS: { value: TripType; label: string }[] = [
  { value: 'oneway', label: 'One-way' },
  { value: 'return', label: 'Return' },
  { value: 'multi', label: 'Multi-city' },
];

const MAX_LEGS = 6;

function emptyLeg(date: string, fromAirport: LocationSelection | null = null): Leg {
  return {
    fromQuery: fromAirport ? selectionLabel(fromAirport) : '',
    fromAirport,
    toQuery: '',
    toAirport: null,
    date,
  };
}

function PassengerStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
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

function DateField({
  value,
  onChange,
  min,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  min: string;
  label?: string;
}) {
  const displayDate = value ? format(new Date(value + 'T12:00:00'), 'EEE, MMM d') : 'Pick a date';

  return (
    <label
      className="input-field relative flex items-center gap-2 px-3 rounded-2xl cursor-pointer"
      style={{ height: '48px' }}
    >
      <CalendarDays size={16} className="text-text-xmuted shrink-0 pointer-events-none" />
      <span
        className={`text-base flex-1 truncate pointer-events-none ${
          value ? 'text-text-primary font-medium' : 'text-text-xmuted'
        }`}
      >
        {displayDate}
      </span>
      <input
        type="date"
        className="absolute inset-0 opacity-0 cursor-pointer"
        value={value}
        min={min}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
        aria-label={label ?? `Date: ${displayDate}`}
      />
    </label>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-semibold mb-1.5 ml-1">
      {children}
    </p>
  );
}

/* ═══════════════════════════════════════════
   HomeScreen — generic flight search.
   This is the public landing page. It looks like a familiar
   flight-search product (one-way / return / multi-city tabs)
   and surfaces FlexBook tools below the hero as an acquisition
   funnel. The flagship multi-stop "hop chain" experience lives
   under /hop-planner.
   ═══════════════════════════════════════════ */

export function HomeScreen({ onMenuOpen }: { onMenuOpen?: () => void }) {
  const user = useAuthStore((s) => s.user);
  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : null;
  const navigate = useNavigate();

  const minDate = formatYMD(new Date());
  const defaultDepart = formatYMD(addDays(new Date(), 7));
  const defaultReturn = formatYMD(addDays(new Date(), 14));

  const [tripType, setTripType] = useState<TripType>('oneway');
  const [passengers, setPassengers] = useState(1);

  // Shared single-trip state (one-way & return).
  const [fromQuery, setFromQuery] = useState('');
  const [fromAirport, setFromAirport] = useState<LocationSelection | null>(null);
  const [toQuery, setToQuery] = useState('');
  const [toAirport, setToAirport] = useState<LocationSelection | null>(null);
  const [departDate, setDepartDate] = useState(defaultDepart);
  const [returnDate, setReturnDate] = useState(defaultReturn);

  // Multi-city state — its own array of legs.
  const [legs, setLegs] = useState<Leg[]>(() => [
    emptyLeg(defaultDepart),
    emptyLeg(formatYMD(addDays(new Date(), 10))),
  ]);

  const selectFromForLeg = useCallback((index: number, selection: LocationSelection) => {
    setLegs((prev) =>
      prev.map((leg, i) =>
        i === index
          ? { ...leg, fromAirport: selection, fromQuery: selectionLabel(selection) }
          : leg,
      ),
    );
  }, []);

  const selectToForLeg = useCallback((index: number, selection: LocationSelection) => {
    setLegs((prev) => {
      const next = prev.map((leg, i) =>
        i === index
          ? { ...leg, toAirport: selection, toQuery: selectionLabel(selection) }
          : leg,
      );
      // If a downstream leg has no origin yet, pre-fill it with this leg's destination
      // so the user doesn't retype it (default behavior on most flight sites).
      if (index + 1 < next.length && !next[index + 1].fromAirport) {
        next[index + 1] = {
          ...next[index + 1],
          fromAirport: selection,
          fromQuery: selectionLabel(selection),
        };
      }
      return next;
    });
  }, []);

  const addLeg = useCallback(() => {
    setLegs((prev) => {
      if (prev.length >= MAX_LEGS) return prev;
      const last = prev[prev.length - 1];
      const carryFrom = last.toAirport;
      const nextDate = formatYMD(addDays(new Date(last.date + 'T12:00:00'), 3));
      return [...prev, emptyLeg(nextDate, carryFrom)];
    });
  }, []);

  const removeLeg = useCallback((index: number) => {
    setLegs((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  function canSubmit(): boolean {
    if (tripType === 'multi') {
      return legs.every((leg) => leg.fromAirport && leg.toAirport && leg.date);
    }
    if (!fromAirport || !toAirport || !departDate) return false;
    if (tripType === 'return' && !returnDate) return false;
    return true;
  }

  function handleSubmit() {
    if (!canSubmit()) return;
    const params = new URLSearchParams();
    params.set('type', tripType);
    params.set('pax', String(passengers));

    if (tripType === 'multi') {
      const encoded = legs
        .map((leg) => `${selectionToMarker(leg.fromAirport!)},${selectionToMarker(leg.toAirport!)},${leg.date}`)
        .join('|');
      params.set('legs', encoded);
    } else {
      params.set('origin', selectionToMarker(fromAirport!));
      params.set('destination', selectionToMarker(toAirport!));
      params.set('depart', departDate);
      if (tripType === 'return') params.set('return', returnDate);
    }
    navigate(`/search?${params.toString()}`);
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Helmet>
        <title>FlexBook — Find your next flight</title>
        <meta
          name="description"
          content="Search flights from any airport to anywhere. Compare cheapest one-way, return, and multi-city fares — plus three FlexBook planning tools built for travellers who want more for less."
        />
      </Helmet>

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 20% 10%, rgba(79,70,229,0.10) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 80% 5%, rgba(14,165,233,0.08) 0%, transparent 55%), radial-gradient(ellipse 40% 30% at 50% 95%, rgba(249,115,22,0.05) 0%, transparent 50%)',
        }}
      />

      <nav className="relative flex items-center justify-between px-5 pt-7 pb-4 md:px-8 md:py-5 lg:px-10 lg:border-b lg:border-border/50">
        <GoHomeLogo size="lg" variant="light" />

        <div className="hidden lg:flex items-center gap-1">
          <span className="px-4 py-2 rounded-xl text-sm font-semibold text-indigo bg-indigo-soft border border-indigo-border">
            Plan
          </span>
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

      {/* ── Hero: copy on left, search card on right (md+) ── */}
      <div className="relative md:flex md:items-stretch md:max-w-6xl md:mx-auto xl:max-w-7xl">
        {/* Left panel: hero copy */}
        <div className="px-5 pt-6 pb-2 md:flex-1 md:flex md:flex-col md:justify-center md:px-8 md:py-10 lg:px-12 lg:py-12">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-0.5 w-5 bg-orange rounded-full" />
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-orange">
              Search flights
            </p>
          </div>

          {user && (
            <p
              className="text-text-secondary font-semibold mb-2"
              style={{ fontSize: 'clamp(1.1rem, 1.6vw, 1.5rem)', letterSpacing: '-0.01em' }}
            >
              Hi {user.firstName} 👋
            </p>
          )}

          <h1
            className="leading-[0.92] font-black text-text-primary"
            style={{ fontSize: 'clamp(2.6rem, 5vw, 5rem)', letterSpacing: '-0.06em' }}
          >
            Find your next
            <br />
            <span className="relative inline-block">
              <span className="text-indigo">flight</span>
              <span
                className="absolute -right-[0.4em] -top-[0.15em] font-black text-orange select-none"
                style={{ fontSize: '1.6em', lineHeight: 1 }}
                aria-hidden
              >
                .
              </span>
            </span>
          </h1>

          <p className="mt-4 text-base md:text-lg leading-7 text-text-muted max-w-[42ch]">
            Compare cheapest fares across millions of routes. One-way, return,
            or multi-city — search any combination and pick the option that fits.
          </p>

          <div className="hidden md:flex items-center gap-2 mt-6">
            <Sparkles size={13} className="text-indigo" />
            <p className="text-xs text-text-muted">
              Scroll down for FlexBook's <strong className="text-text-secondary">planning tools</strong> — built for travellers who want more.
            </p>
          </div>
        </div>

        {/* Right panel: search card */}
        <div className="px-5 pb-8 md:w-[440px] md:flex-shrink-0 md:bg-surface/80 md:backdrop-blur-sm md:px-6 md:py-8 md:flex md:flex-col md:justify-center md:my-8 md:mr-6 md:rounded-[28px] md:border md:border-border/60 md:shadow-[0_18px_50px_-20px_rgba(15,23,42,0.18)] lg:w-[480px] lg:px-8 lg:my-10 lg:mr-8 xl:w-[520px]">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-base font-bold text-text-primary">Where to?</h2>
            <SegmentedControl
              value={tripType}
              onChange={setTripType}
              options={TRIP_TYPE_OPTIONS}
              ariaLabel="Trip type"
            />
          </div>

          <div className="section-shell p-4 mb-4">
            {tripType !== 'multi' ? (
              <>
                <div className="mb-3">
                  <FieldLabel>From</FieldLabel>
                  <AirportSearchInput
                    value={fromQuery}
                    onChange={(v) => {
                      setFromQuery(v);
                      if (fromAirport) setFromAirport(null);
                    }}
                    onSelect={(selection) => {
                      setFromAirport(selection);
                      setFromQuery(selectionLabel(selection));
                    }}
                    placeholder="Origin city or airport code"
                    ariaLabel="Origin airport"
                  />
                </div>
                <div className="mb-3">
                  <FieldLabel>To</FieldLabel>
                  <AirportSearchInput
                    value={toQuery}
                    onChange={(v) => {
                      setToQuery(v);
                      if (toAirport) setToAirport(null);
                    }}
                    onSelect={(selection) => {
                      setToAirport(selection);
                      setToQuery(selectionLabel(selection));
                    }}
                    placeholder="Destination city or airport code"
                    ariaLabel="Destination airport"
                  />
                </div>
                <div className={`grid gap-2.5 ${tripType === 'return' ? 'grid-cols-2' : 'grid-cols-2'}`}>
                  <div>
                    <FieldLabel>Depart</FieldLabel>
                    <DateField
                      value={departDate}
                      onChange={setDepartDate}
                      min={minDate}
                      label="Departure date"
                    />
                  </div>
                  {tripType === 'return' ? (
                    <div>
                      <FieldLabel>Return</FieldLabel>
                      <DateField
                        value={returnDate}
                        onChange={setReturnDate}
                        min={departDate}
                        label="Return date"
                      />
                    </div>
                  ) : (
                    <div>
                      <FieldLabel>Travelers</FieldLabel>
                      <PassengerStepper value={passengers} onChange={setPassengers} />
                    </div>
                  )}
                </div>
                {tripType === 'return' && (
                  <div className="mt-3">
                    <FieldLabel>Travelers</FieldLabel>
                    <PassengerStepper value={passengers} onChange={setPassengers} />
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                {legs.map((leg, index) => (
                  <div key={index} className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-mid">
                        Leg {index + 1}
                      </p>
                      {legs.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeLeg(index)}
                          className="w-6 h-6 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-text-muted hover:text-rose-500 transition-colors"
                          aria-label={`Remove leg ${index + 1}`}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    <div className="space-y-2.5">
                      <div>
                        <FieldLabel>From</FieldLabel>
                        <AirportSearchInput
                          value={leg.fromQuery}
                          onChange={(v) =>
                            setLegs((prev) =>
                              prev.map((l, i) =>
                                i === index ? { ...l, fromQuery: v, fromAirport: null } : l,
                              ),
                            )
                          }
                          onSelect={(airport) => selectFromForLeg(index, airport)}
                          placeholder="Origin"
                          ariaLabel={`Leg ${index + 1} origin`}
                        />
                      </div>
                      <div>
                        <FieldLabel>To</FieldLabel>
                        <AirportSearchInput
                          value={leg.toQuery}
                          onChange={(v) =>
                            setLegs((prev) =>
                              prev.map((l, i) =>
                                i === index ? { ...l, toQuery: v, toAirport: null } : l,
                              ),
                            )
                          }
                          onSelect={(airport) => selectToForLeg(index, airport)}
                          placeholder="Destination"
                          ariaLabel={`Leg ${index + 1} destination`}
                        />
                      </div>
                      <div>
                        <FieldLabel>Date</FieldLabel>
                        <DateField
                          value={leg.date}
                          onChange={(v) =>
                            setLegs((prev) =>
                              prev.map((l, i) => (i === index ? { ...l, date: v } : l)),
                            )
                          }
                          min={index === 0 ? minDate : legs[index - 1].date}
                          label={`Leg ${index + 1} date`}
                        />
                      </div>
                    </div>
                    {index < legs.length - 1 && (
                      <div className="h-px bg-border/60 mt-4" />
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addLeg}
                  disabled={legs.length >= MAX_LEGS}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-indigo-border text-xs font-bold text-indigo bg-indigo-soft/40 hover:bg-indigo-soft transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus size={13} /> Add another flight
                  {legs.length >= MAX_LEGS && <span className="text-text-muted font-normal">(max {MAX_LEGS})</span>}
                </button>

                <div>
                  <FieldLabel>Travelers</FieldLabel>
                  <PassengerStepper value={passengers} onChange={setPassengers} />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit()}
              className="w-full mt-4 h-12 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #3730A3 0%, #4F46E5 100%)',
                boxShadow: '0 8px 24px rgba(55,48,163,0.28)',
              }}
            >
              <Search size={16} />
              Search flights
            </button>
          </div>

          <p className="text-center text-[11px] text-text-muted/70 px-2">
            Looking for something different? Try a{' '}
            <Link to="/tools" className="font-semibold text-indigo-mid hover:underline">
              FlexBook tool
            </Link>{' '}
            below.
          </p>
        </div>
      </div>

      {/* ── Tools showcase row ── */}
      <section className="relative px-5 pb-16 pt-4 md:max-w-6xl md:mx-auto md:px-8 md:pt-10 md:pb-20 lg:px-12 xl:max-w-7xl">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-soft border border-indigo-border mb-3">
              <Sparkles size={12} className="text-indigo" />
              <span className="text-[11px] font-bold text-indigo tracking-wide uppercase">
                Plan smarter
              </span>
            </div>
            <h2
              className="font-black text-text-primary leading-tight"
              style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', letterSpacing: '-0.03em' }}
            >
              FlexBook <span className="text-indigo">tools</span>.
            </h2>
            <p className="text-sm text-text-muted mt-1 max-w-[48ch]">
              Three free planning tools built for travellers who want more for less.
              Pick one and let FlexBook do the heavy lifting.
            </p>
          </div>
          <Link
            to="/tools"
            className="inline-flex items-center gap-1 text-xs font-bold text-indigo hover:gap-2 transition-all"
          >
            View all <ArrowRight size={13} />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {TOOLS.map((tool) => (
            <ToolCard key={tool.id} tool={tool} variant="compact" />
          ))}
        </div>
      </section>
    </div>
  );
}
