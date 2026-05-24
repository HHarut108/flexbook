import { useState, useEffect, useRef, useCallback } from 'react';
import { Airport } from '@fast-travel/shared';
import { useAirportSearch } from '../hooks/useAirportSearch';
import { nearbyAirportsByCoords } from '../api/airports.api';
import { resolveUserCoords, readCachedCoords, readCachedNearby, cacheNearby } from '../utils/geolocation.utils';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useTripStore } from '../store/trip.store';
import { useSessionStore } from '../store/session.store';
import { useAuthStore } from '../store/auth.store';
import { formatYMD } from '../utils/date.utils';
import { addDays, format } from 'date-fns';
import { GoHomeLogo } from '../components/GoHomeLogo';
import {
  MapPin,
  Search,
  Loader2,
  User,
  ArrowRight,
  PlaneTakeoff,
  CalendarDays,
  Users,
  Star,
  TrendingUp,
  Shield,
  X,
} from 'lucide-react';

/* ── Popular airports fallback (when geolocation unavailable) ── */

const POPULAR_AIRPORTS: Pick<Airport, 'iata' | 'name' | 'city'>[] = [
  { iata: 'IST', name: 'Istanbul Airport', city: { id: 'ist', name: 'Istanbul', countryCode: 'TR', countryName: 'Turkey', lat: 41.01, lng: 28.98 } },
  { iata: 'LHR', name: 'Heathrow Airport', city: { id: 'lon', name: 'London', countryCode: 'GB', countryName: 'United Kingdom', lat: 51.47, lng: -0.46 } },
  { iata: 'CDG', name: 'Charles de Gaulle', city: { id: 'par', name: 'Paris', countryCode: 'FR', countryName: 'France', lat: 49.01, lng: 2.55 } },
];

/* ── Passenger Stepper ── */

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

/* ── Date Field ── */

function DateField({
  value,
  onChange,
  min,
}: {
  value: string;
  onChange: (v: string) => void;
  min: string;
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
        aria-label={`Departure date: ${displayDate}`}
      />
    </label>
  );
}

/* ── Airport Result Row ── */

function AirportRow({
  airport,
  onSelect,
  delay,
}: {
  airport: Airport;
  onSelect: () => void;
  delay: number;
}) {
  return (
    <button
      className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-indigo-soft/50 transition-colors border-b border-border/40 last:border-0 text-left"
      style={{ animationDelay: `${delay}ms` }}
      onClick={onSelect}
      aria-label={`Select ${airport.city.name} (${airport.iata})`}
    >
      <div className="w-9 h-9 rounded-xl bg-indigo-soft border border-indigo-border flex items-center justify-center shrink-0">
        <PlaneTakeoff size={14} className="text-indigo" />
      </div>
      <div className="min-w-0 flex-1">
        {/* Line 1: City name + IATA chip — the recognisable identifiers.
            The marketing-alias overlay (see backend MARKETING_CITY_ALIAS)
            ensures Malpensa/Bergamo/Linate all read "Milan" here. */}
        <div className="flex items-baseline gap-2 min-w-0">
          <p className="text-[15px] font-semibold text-text-primary truncate">
            {airport.city.name}
          </p>
          <span className="text-xs font-mono font-bold text-indigo-mid shrink-0">
            {airport.iata}
          </span>
        </div>
        {/* Line 2: Full airport name (and distance, when this is a "did you
            mean" fallback hit). */}
        <p className="text-xs text-text-muted mt-0.5 truncate">
          {airport.name}
          {airport.distanceKm !== undefined && ` · ${airport.distanceKm} km`}
        </p>
      </div>
      <div className="w-8 h-8 rounded-full bg-indigo-soft/60 text-indigo flex items-center justify-center shrink-0">
        <ArrowRight size={14} />
      </div>
    </button>
  );
}

/* ── Nearby / Popular Airport Card ── */

function AirportCard({
  airport,
  onSelect,
}: {
  airport: Pick<Airport, 'iata' | 'name' | 'city'> & { distanceKm?: number };
  onSelect: () => void;
}) {
  return (
    <button
      className="list-row group active:scale-[0.98] transition-all duration-150"
      onClick={onSelect}
      aria-label={`Depart from ${airport.city.name} (${airport.iata})`}
    >
      <div className="flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-2xl bg-indigo-soft border border-indigo-border text-indigo flex items-center justify-center shrink-0 group-hover:bg-indigo group-hover:text-white group-hover:border-indigo transition-colors duration-200">
          <MapPin size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-text-primary truncate">{airport.name}</p>
          <p className="text-xs text-text-muted mt-0.5">
            <span className="font-mono font-semibold text-indigo-mid">{airport.iata}</span>
            {airport.distanceKm
              ? ` · ${airport.distanceKm} km away`
              : ` · ${airport.city.name}, ${airport.city.countryName}`}
          </p>
        </div>
      </div>
    </button>
  );
}

/* ── Stats Bar ── */

function TrustBar() {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
      <div className="flex items-center gap-2">
        <TrendingUp size={13} className="text-emerald shrink-0" />
        <span className="text-xs text-text-muted">
          <strong className="text-text-secondary">Flexible multi-stop</strong> trip planning
        </span>
      </div>
      <div className="hidden lg:block w-px h-3 bg-border" />
      <div className="flex items-center gap-2">
        <Star size={13} className="text-gold shrink-0" />
        <span className="text-xs text-text-muted">
          Always the <strong className="text-text-secondary">cheapest next hop</strong>
        </span>
      </div>
      <div className="hidden lg:block w-px h-3 bg-border" />
      <div className="flex items-center gap-2">
        <Shield size={13} className="text-indigo-mid shrink-0" />
        <span className="text-xs text-text-muted">
          <strong className="text-text-secondary">No account</strong> needed
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Main HomeScreen
   ═══════════════════════════════════════════ */

export function HomeScreen({ onMenuOpen }: { onMenuOpen?: () => void }) {
  const user = useAuthStore((s) => s.user);
  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : null;
  const [query, setQuery] = useState('');
  const [nearby, setNearby] = useState<Airport[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [passengers, setPassengers] = useState(1);
  const [departureDate, setDepartureDate] = useState(formatYMD(addDays(new Date(), 1)));
  const { results, fallback, loading, error: searchError } = useAirportSearch(query);
  const navigate = useNavigate();
  const setOrigin = useTripStore((s) => s.setOrigin);
  const setStorePassengers = useTripStore((s) => s.setPassengers);
  const { setSelectedDate } = useSessionStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const minDate = formatYMD(new Date());

  /* Geolocation: serve cached nearby airports instantly, then refresh in background */
  useEffect(() => {
    let cancelled = false;

    // If we have both cached coords and cached nearby airports, show them immediately
    // with no loading state — the list appears before any network call.
    const cachedCoords = readCachedCoords();
    if (cachedCoords) {
      const cachedAirports = readCachedNearby<Airport>(cachedCoords.lat, cachedCoords.lng);
      if (cachedAirports) {
        setNearby(cachedAirports.slice(0, 3));
        return; // skip network entirely until cache expires
      }
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
        /* both browser and IP geolocation failed — fall back to POPULAR_AIRPORTS */
      } finally {
        if (!cancelled) setGeoLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectAirport = useCallback(
    (airport: Airport) => {
      setOrigin(airport);
      setStorePassengers(passengers);
      setSelectedDate(departureDate);
      setQuery('');
      navigate('/flights');
    },
    [departureDate, passengers, setOrigin, setStorePassengers, setSelectedDate, navigate],
  );

  const showResults = query.trim().length > 0;

  /* ── Shared sub-components rendered in the right panel ── */
  const searchForm = (
    <div className="section-shell p-4 mb-4">
      <div className="mb-3">
        {!showResults && (
          <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-semibold mb-1.5 ml-1">
            Flying from
          </p>
        )}
        <div className="relative">
          <PlaneTakeoff
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-text-xmuted pointer-events-none"
          />
          {query && (
            <button
              className="absolute right-14 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-surface-2 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
          <button
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-xl text-white flex items-center justify-center transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #F97316 0%, #EA6C0A 100%)',
              boxShadow: '0 8px 24px rgba(249,115,22,0.28)',
              minHeight: '44px',
              minWidth: '44px',
            }}
            tabIndex={-1}
            aria-hidden
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Search size={16} />
            )}
          </button>
          <input
            ref={inputRef}
            type="text"
            className="input-field pl-11 pr-28 rounded-2xl text-base"
            style={{ minHeight: '48px' }}
            placeholder="City or airport code..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            aria-label="Search origin airport"
          />
        </div>
      </div>
      {!showResults && (
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-semibold mb-1.5 ml-1">
              Departure
            </p>
            <DateField value={departureDate} onChange={setDepartureDate} min={minDate} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-semibold mb-1.5 ml-1">
              Travelers
            </p>
            <PassengerStepper value={passengers} onChange={setPassengers} />
          </div>
        </div>
      )}
    </div>
  );

  const searchResults = showResults && (
    <div className="section-shell overflow-hidden mb-4 animate-fade-in">
      {searchError && !loading && results.length === 0 && (
        <p className="px-5 py-4 text-rose-400 text-sm" role="alert">
          {searchError}
        </p>
      )}
      {!searchError && results.length === 0 && !loading && !fallback && (
        <p className="px-5 py-4 text-text-muted text-sm">
          No airports found. Try a different city or code.
        </p>
      )}
      {/* We resolved the query to a known place (gazetteer hit) but no
          commercial airport sits within 300 km — e.g. remote islands like
          Diego Garcia. Tell the user honestly. */}
      {!searchError && results.length === 0 && !loading && fallback && (
        <p className="px-5 py-4 text-text-muted text-sm">
          We found <strong className="text-text-primary">{fallback.matchedPlace}</strong>, but no
          commercial airport sits within {fallback.radiusKm} km.
        </p>
      )}
      {loading && results.length === 0 && (
        <div className="flex items-center gap-2.5 px-5 py-4 text-text-muted text-sm">
          <Loader2 size={14} className="animate-spin text-indigo-mid" />
          Searching airports...
        </div>
      )}
      {/* "Did you mean" header — only shown when the query matched a known
          place that has no commercial airport (e.g. São Carlos) and we fell
          back to nearest commercial airports within 300 km. */}
      {fallback && results.length > 0 && !loading && (
        <div className="px-5 py-3 border-b border-border bg-indigo-soft/40">
          <p className="text-[13px] text-text-primary">
            No commercial airport in <strong>{fallback.matchedPlace}</strong>.
          </p>
          <p className="text-xs text-text-muted mt-0.5">
            Nearest commercial airports within {fallback.radiusKm} km:
          </p>
        </div>
      )}
      {results.map((airport, i) => (
        <AirportRow
          key={airport.iata}
          airport={airport}
          onSelect={() => selectAirport(airport)}
          delay={i * 20}
        />
      ))}
    </div>
  );

  const airportList = !showResults && (
    <>
      <div className="flex items-center gap-2 mb-2.5 mt-2">
        <MapPin size={13} className="text-indigo-mid" />
        <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-semibold">
          Nearby airports
        </p>
      </div>
      <div className="space-y-2">
        {geoLoading && (
          <div className="section-shell px-4 py-4 flex items-center gap-2.5 text-text-muted text-sm">
            <Loader2 size={14} className="animate-spin text-indigo-mid" />
            <span>Detecting nearby airports...</span>
          </div>
        )}
        {!geoLoading &&
          nearby.length > 0 &&
          nearby.map((airport) => (
            <AirportCard
              key={airport.iata}
              airport={airport}
              onSelect={() => selectAirport(airport)}
            />
          ))}
        {!geoLoading &&
          nearby.length === 0 &&
          POPULAR_AIRPORTS.map((airport) => (
            <AirportCard
              key={airport.iata}
              airport={airport as Airport}
              onSelect={() => selectAirport(airport as Airport)}
            />
          ))}
      </div>
    </>
  );

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Helmet>
        <title>FlexBook — Plan your multi-stop trip</title>
        <meta name="description" content="Find the cheapest multi-stop flights. No sign-up required. Up to 15 stops per trip." />
      </Helmet>
      {/* ── Ambient background ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 20% 10%, rgba(79,70,229,0.10) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 80% 5%, rgba(14,165,233,0.08) 0%, transparent 55%), radial-gradient(ellipse 40% 30% at 50% 95%, rgba(249,115,22,0.05) 0%, transparent 50%)',
        }}
      />

      {/* ── Nav — full width across all breakpoints ── */}
      <div className="relative flex items-center justify-between px-5 pt-7 pb-4 md:px-8 md:py-5 lg:px-10 lg:border-b lg:border-border/50">
        <GoHomeLogo size="lg" variant="light" />
        <button
          onClick={onMenuOpen}
          className="w-10 h-10 rounded-2xl bg-surface border border-border flex items-center justify-center text-indigo-mid transition-all hover:bg-indigo-soft hover:border-indigo-border"
          style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.08)' }}
          aria-label="Account"
        >
          {initials
            ? <span className="text-xs font-bold text-indigo leading-none">{initials}</span>
            : <User size={16} />
          }
        </button>
      </div>

      {/* ── Body: single column on mobile, 2-panel from md: up ── */}
      <div
        className="relative md:flex md:items-stretch md:max-w-6xl md:mx-auto xl:max-w-7xl"
        style={{ minHeight: 'calc(100dvh - 72px)' }}
      >

        {/* ── Left panel: hero + trust (always visible on md+, stacked on mobile) ── */}
        <div className="px-5 pt-6 pb-2 md:flex-1 md:flex md:flex-col md:justify-center md:px-8 md:py-10 lg:px-12 lg:py-12">
          {/* Hero */}
          <div className="mb-8 lg:mb-10">
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
              style={{ fontSize: 'clamp(2.8rem, 5.2vw, 5.5rem)', letterSpacing: '-0.06em' }}
            >
              Plan your
              <br />
              <span className="relative inline-block">
                <span className="text-indigo">trip</span>
                <span
                  className="absolute -right-[0.4em] -top-[0.15em] font-black text-orange select-none"
                  style={{ fontSize: '1.6em', lineHeight: 1 }}
                  aria-hidden
                >
                  .
                </span>
              </span>
            </h1>
            <p className="mt-4 text-base md:text-lg leading-7 text-text-muted max-w-[30ch]">
              Cheapest fares. Biggest adventures.
            </p>
          </div>

          {/* Trust bar — md+: always in left panel; mobile: hidden here, shown in right panel */}
          <div className="hidden md:block">
            <TrustBar />
            <p className="mt-6 text-xs text-text-muted/60 leading-5">
              Up to 15 stops per trip. Always the cheapest next hop.
              <br />
              No sign-up required.
            </p>
          </div>
        </div>

        {/* ── Right panel: search form + airports ── */}
        {/* md+: floating "card" treatment rather than a full-height wall — the
            panel is inset with margin, rounded, softly shadowed, and bordered
            on all sides so it reads as a dedicated search widget instead of
            a hard rectangle running edge to edge. Content stays vertically
            centered (justify-center) to mirror the hero on the left. Mobile
            keeps the natural top-down flow (no card chrome). */}
        <div className="px-5 pb-10 md:w-[400px] md:flex-shrink-0 md:bg-white/70 md:backdrop-blur-sm md:px-6 md:py-8 md:flex md:flex-col md:justify-center md:my-8 md:mr-6 md:rounded-[28px] md:border md:border-border/60 md:shadow-[0_18px_50px_-20px_rgba(15,23,42,0.18)] lg:w-[440px] lg:px-8 lg:my-10 lg:mr-8 xl:w-[480px]">
          {searchForm}
          {searchResults}
          {airportList}

          {/* Trust signals — mobile only (md+ shows them in the left panel) */}
          {!showResults && (
            <div className="mt-8 md:hidden">
              <TrustBar />
            </div>
          )}
          {!showResults && (
            <p className="mt-8 text-center text-xs text-text-muted/60 leading-5 md:hidden">
              Up to 15 stops per trip. Always the cheapest next hop.
              <br />
              No sign-up required.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
