import { useState, useEffect, useRef, useCallback } from 'react';
import { Airport } from '@fast-travel/shared';
import { useAirportSearch } from '../hooks/useAirportSearch';
import { nearbyAirportsByCoords } from '../api/airports.api';
import { useTripStore } from '../store/trip.store';
import { useSessionStore } from '../store/session.store';
import { formatYMD } from '../utils/date.utils';
import { addDays, format } from 'date-fns';
import {
  MapPin,
  Search,
  Loader2,
  Menu,
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
      className="input-field relative flex items-center gap-1 pl-11 pr-1.5 py-1 rounded-2xl"
      style={{ minHeight: '48px' }}
      role="group"
      aria-label={`${value} passenger${value > 1 ? 's' : ''}`}
    >
      <Users
        size={16}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-text-xmuted pointer-events-none"
      />
      <span className="text-text-primary font-medium text-base flex-1">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        className="w-9 h-9 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-primary font-semibold text-lg transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed hover:border-indigo-border"
        style={{ minWidth: '36px', minHeight: '36px' }}
        aria-label="Remove passenger"
      >
        &minus;
      </button>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= 9}
        className="w-9 h-9 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-primary font-semibold text-lg transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed hover:border-indigo-border"
        style={{ minWidth: '36px', minHeight: '36px' }}
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
    <label className="relative block cursor-pointer">
      <CalendarDays
        size={16}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-text-xmuted pointer-events-none z-10"
      />
      <span
        className={`absolute left-11 top-1/2 -translate-y-1/2 pointer-events-none z-10 text-base ${
          value ? 'text-text-primary font-medium' : 'text-text-xmuted'
        }`}
      >
        {displayDate}
      </span>
      <input
        type="date"
        className="input-field pl-11 pr-4 py-3.5 rounded-2xl text-base w-full cursor-pointer"
        style={{ minHeight: '48px', color: 'transparent', caretColor: 'transparent', colorScheme: 'light' }}
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
        <p className="text-[15px] font-semibold text-text-primary">{airport.city.name}</p>
        <p className="text-xs text-text-muted mt-0.5">
          <span className="font-mono font-semibold text-indigo-mid">{airport.iata}</span>
          {' · '}
          {airport.name}
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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-6">
      <div className="flex items-center gap-2">
        <TrendingUp size={13} className="text-emerald shrink-0" />
        <span className="text-xs text-text-muted">
          <strong className="text-text-secondary">Flexible multi-stop</strong> trip planning
        </span>
      </div>
      <div className="hidden sm:block w-px h-3 bg-border" />
      <div className="flex items-center gap-2">
        <Star size={13} className="text-gold shrink-0" />
        <span className="text-xs text-text-muted">
          Always the <strong className="text-text-secondary">cheapest next hop</strong>
        </span>
      </div>
      <div className="hidden sm:block w-px h-3 bg-border" />
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
  const [query, setQuery] = useState('');
  const [nearby, setNearby] = useState<Airport[]>([]);
  const [geoCity, setGeoCity] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [passengers, setPassengers] = useState(1);
  const [departureDate, setDepartureDate] = useState(formatYMD(addDays(new Date(), 1)));
  const { results, loading } = useAirportSearch(query);
  const setOrigin = useTripStore((s) => s.setOrigin);
  const { setScreen, setSelectedDate } = useSessionStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const minDate = formatYMD(addDays(new Date(), 1));

  /* Geolocation */
  useEffect(() => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const airports = await nearbyAirportsByCoords(pos.coords.latitude, pos.coords.longitude);
          setNearby(airports.slice(0, 3));
          if (airports.length > 0) setGeoCity(airports[0].city.name);
        } catch {
          /* silent */
        } finally {
          setGeoLoading(false);
        }
      },
      () => setGeoLoading(false),
      { timeout: 5000 },
    );
  }, []);

  const selectAirport = useCallback(
    (airport: Airport) => {
      setOrigin(airport);
      setSelectedDate(departureDate);
      setQuery('');
      setScreen('flight-results');
    },
    [departureDate, setOrigin, setSelectedDate, setScreen],
  );

  const showResults = query.trim().length > 0;

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* ── Ambient background ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 20% 10%, rgba(79,70,229,0.10) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 80% 5%, rgba(14,165,233,0.08) 0%, transparent 55%), radial-gradient(ellipse 40% 30% at 50% 95%, rgba(249,115,22,0.05) 0%, transparent 50%)',
        }}
      />

      <div className="relative px-5 pt-7 pb-10 max-w-screen-sm mx-auto">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-baseline gap-0">
            <span className="text-[1.4rem] font-black tracking-[-0.05em] text-indigo">flex</span>
            <span className="text-[1.4rem] font-black tracking-[-0.05em] text-orange">/</span>
            <span className="text-[1.4rem] font-black tracking-[-0.05em] text-indigo">book</span>
          </div>
          <button
            onClick={onMenuOpen}
            className="w-11 h-11 rounded-2xl bg-surface border border-border flex items-center justify-center text-indigo-mid transition-all hover:bg-indigo-soft hover:border-indigo-border"
            style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.08)' }}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        </div>

        {/* ── Hero ── */}
        <div className="mb-8">
          <h1
            className="leading-[0.92] font-black text-text-primary"
            style={{ fontSize: 'clamp(2.8rem, 10vw, 3.6rem)', letterSpacing: '-0.06em' }}
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
          <p className="mt-4 text-base leading-7 text-text-muted max-w-[30ch]">
            Flexible dates, better prices.
          </p>
        </div>

        {/* ── Search Form ── */}
        <div className="section-shell p-4 mb-4">
          {/* Origin input */}
          <div className="mb-3">
            {!showResults && (
              <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-semibold mb-1.5 ml-1">
                Where from?
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

          {/* Date + Passengers row (visible only when not searching) */}
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

        {/* ── Search Results Dropdown ── */}
        {showResults && (
          <div className="section-shell overflow-hidden mb-4 animate-fade-in">
            {results.length === 0 && !loading && (
              <p className="px-5 py-4 text-text-muted text-sm">
                No airports found. Try a different city or code.
              </p>
            )}
            {loading && results.length === 0 && (
              <div className="flex items-center gap-2.5 px-5 py-4 text-text-muted text-sm">
                <Loader2 size={14} className="animate-spin text-indigo-mid" />
                Searching airports...
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
        )}

        {/* ── Nearby / Popular Airports ── */}
        {!showResults && (
          <>
            <div className="flex items-center gap-2 mb-2.5 mt-2">
              <MapPin size={13} className="text-indigo-mid" />
              <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-semibold">
                {geoCity ? `Departing from ${geoCity}` : 'Nearby airports'}
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
        )}

        {/* ── Trust Signals ── */}
        {!showResults && (
          <div className="mt-8">
            <TrustBar />
          </div>
        )}

        {/* ── Footer tagline ── */}
        {!showResults && (
          <p className="mt-8 text-center text-xs text-text-muted/60 leading-5">
            Up to 15 stops per trip. Always the cheapest next hop.
            <br />
            No sign-up required.
          </p>
        )}
      </div>
    </div>
  );
}
