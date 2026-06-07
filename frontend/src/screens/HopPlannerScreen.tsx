import { useState, useEffect, useCallback } from 'react';
import { Airport, LocationSelection } from '@fast-travel/shared';
import { nearbyAirportsByCoords } from '../api/airports.api';
import { resolveUserCoords, readCachedCoords, readCachedNearby, cacheNearby } from '../utils/geolocation.utils';
import { useNavigate } from 'react-router-dom';
import { useTripStore } from '../store/trip.store';
import { useSessionStore } from '../store/session.store';
import { useAuthStore } from '../store/auth.store';
import { formatYMD } from '../utils/date.utils';
import { track, AnalyticsEvent } from '../lib/analytics';
import { addDays, format } from 'date-fns';
import { HomeFlightFan } from '../components/HomeFlightFan';
import { MarketingShell } from '../components/MarketingShell';
import { AirportSearchInput } from '../components/AirportSearchInput';
import {
  MapPin,
  Loader2,
  ArrowRight,
  CalendarDays,
  Star,
  TrendingUp,
  Shield,
} from 'lucide-react';

/* ── Popular airports fallback (when geolocation unavailable) ── */

const POPULAR_AIRPORTS: Pick<Airport, 'iata' | 'name' | 'city'>[] = [
  { iata: 'IST', name: 'Istanbul Airport', city: { id: 'ist', name: 'Istanbul', countryCode: 'TR', countryName: 'Turkey', lat: 41.01, lng: 28.98 } },
  { iata: 'LHR', name: 'Heathrow Airport', city: { id: 'lon', name: 'London', countryCode: 'GB', countryName: 'United Kingdom', lat: 51.47, lng: -0.46 } },
  { iata: 'CDG', name: 'Charles de Gaulle', city: { id: 'par', name: 'Paris', countryCode: 'FR', countryName: 'France', lat: 49.01, lng: 2.55 } },
];

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
   HopPlannerScreen — origin-first, chain-of-hops trip builder.
   Lifted from the original HomeScreen so the route `/` can host a
   generic flight search; behavior here is unchanged from before.
   ═══════════════════════════════════════════ */

export function HopPlannerScreen({ onMenuOpen }: { onMenuOpen?: () => void }) {
  const user = useAuthStore((s) => s.user);
  const [query, setQuery] = useState('');
  const [nearby, setNearby] = useState<Airport[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [passengers, setPassengers] = useState(1);
  const [departureDate, setDepartureDate] = useState(formatYMD(addDays(new Date(), 1)));
  const navigate = useNavigate();
  const setOrigin = useTripStore((s) => s.setOrigin);
  const setStorePassengers = useTripStore((s) => s.setPassengers);
  const { setSelectedDate } = useSessionStore();

  const minDate = formatYMD(new Date());

  useEffect(() => {
    let cancelled = false;

    const cachedCoords = readCachedCoords();
    if (cachedCoords) {
      const cachedAirports = readCachedNearby<Airport>(cachedCoords.lat, cachedCoords.lng);
      if (cachedAirports) {
        setNearby(cachedAirports.slice(0, 3));
        return;
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
    (selection: LocationSelection) => {
      setOrigin(selection);
      setStorePassengers(passengers);
      setSelectedDate(departureDate);
      setQuery('');
      const trackOrigin =
        selection.kind === 'airport'
          ? selection.airport.iata
          : `@${selection.city.id}`;
      const trackCity =
        selection.kind === 'airport' ? selection.airport.city.name : selection.city.name;
      const trackCountry =
        selection.kind === 'airport'
          ? selection.airport.city.countryCode
          : selection.city.countryCode;
      track(AnalyticsEvent.TripSearchStarted, {
        origin: trackOrigin,
        originCity: trackCity,
        originCountry: trackCountry,
        passengers,
        departureDate,
      });
      navigate('/flights');
    },
    [departureDate, passengers, setOrigin, setStorePassengers, setSelectedDate, navigate],
  );

  const showResults = query.trim().length > 0;

  const left = (
    <>
      <div className="mb-6 lg:mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-0.5 w-5 bg-orange rounded-full" />
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-orange">
            FlexBook tool · Hop Planner
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
        <p className="mt-4 text-base md:text-lg leading-7 text-text-muted max-w-[36ch]">
          Cheapest fares. Biggest adventures. Hop between cities
          on the lowest available next-leg fare — no return required.
        </p>

        <div className="flex items-center gap-5 mt-5">
          <div>
            <p className="font-black leading-none text-xl">
              <span className="text-orange">15</span>
              <span className="text-[0.5em] font-bold text-indigo-mid ml-1.5 uppercase tracking-wider">stops</span>
            </p>
            <p className="text-[11px] text-text-muted mt-1">Max per trip</p>
          </div>
          <div className="w-px h-7 bg-border/60 shrink-0" />
          <div>
            <p className="font-black leading-none text-xl">
              <span className="text-orange">$29</span>
              <span className="text-[0.5em] font-bold text-orange/70 ml-1.5">from</span>
            </p>
            <p className="text-[11px] text-text-muted mt-1">Cheapest hop today</p>
          </div>
          <div className="w-px h-7 bg-border/60 shrink-0" />
          <div>
            <p className="font-black leading-none text-xl">
              <span className="text-teal-500">0</span>
              <span className="text-[0.5em] font-bold text-teal-400 ml-1.5 uppercase tracking-wider">acct</span>
            </p>
            <p className="text-[11px] text-text-muted mt-1">No sign-up needed</p>
          </div>
        </div>
      </div>

      <div
        className="hidden md:block mb-8 lg:mb-10 rounded-[20px] border border-border/60 overflow-hidden bg-surface/60"
        style={{ boxShadow: '0 8px 28px -10px rgba(15,23,42,0.12)' }}
      >
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-border/40">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
            Live fares · Departing {nearby[0]?.iata ?? 'EVN'} tonight
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-text-secondary px-2.5 py-0.5 rounded-full bg-surface-2 border border-border">
              9 routes
            </span>
            <span className="text-[11px] font-semibold text-orange px-2.5 py-0.5 rounded-full bg-orange/10 border border-orange/20 flex items-center gap-1">
              ⚡ cheapest $29
            </span>
          </div>
        </div>
        <HomeFlightFan bare />
        <div className="px-4 py-2.5 flex items-center gap-4 border-t border-border/40 flex-wrap">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={12} className="text-emerald shrink-0" />
            <span className="text-xs text-text-muted"><strong className="text-text-secondary">Multi-stop</strong> trip planning</span>
          </div>
          <div className="w-px h-3 bg-border" />
          <div className="flex items-center gap-1.5">
            <Star size={12} className="text-gold shrink-0" />
            <span className="text-xs text-text-muted">Always the <strong className="text-text-secondary">cheapest next hop</strong></span>
          </div>
          <div className="w-px h-3 bg-border" />
          <div className="flex items-center gap-1.5">
            <Shield size={12} className="text-indigo-mid shrink-0" />
            <span className="text-xs text-text-muted"><strong className="text-text-secondary">No account</strong> needed</span>
          </div>
        </div>
      </div>
    </>
  );

  const right = (
    <>
      <div className="hidden md:flex items-center justify-between mb-3 px-1">
        <h2 className="text-base font-bold text-text-primary">Where to first?</h2>
        <span className="text-xs text-text-muted">
          One-way · <span className="font-semibold text-indigo-mid">cheapest hop</span>
        </span>
      </div>

      <div className="section-shell p-4 mb-4">
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-semibold mb-1.5 ml-1">
            Flying from
          </p>
          <AirportSearchInput
            value={query}
            onChange={setQuery}
            onSelect={selectAirport}
            autoFocus
            ariaLabel="Search origin airport"
            accentButton
          />
        </div>
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
        <button
          type="button"
          onClick={() => {
            const el = document.querySelector<HTMLInputElement>('input[aria-label="Search origin airport"]');
            el?.focus();
          }}
          className="w-full mt-3 h-12 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #3730A3 0%, #4F46E5 100%)',
            boxShadow: '0 8px 24px rgba(55,48,163,0.28)',
          }}
        >
          Find a starting flight
          <ArrowRight size={16} />
        </button>
      </div>

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
              onSelect={() => selectAirport({ kind: 'airport', airport })}
            />
          ))}
        {!geoLoading &&
          nearby.length === 0 &&
          POPULAR_AIRPORTS.map((airport) => (
            <AirportCard
              key={airport.iata}
              airport={airport as Airport}
              onSelect={() => selectAirport({ kind: 'airport', airport: airport as Airport })}
            />
          ))}
      </div>

      {!showResults && (
        <div className="mt-8 md:hidden">
          <TrustBar />
        </div>
      )}
    </>
  );

  return (
    <MarketingShell
      active="tools"
      title="Hop Planner"
      description="Chain the cheapest one-way fares into a multi-stop trip. Pick a starting airport — FlexBook builds the route hop by hop. Up to 15 stops, no return required, no account needed."
      onMenuOpen={onMenuOpen}
      left={left}
      right={right}
    />
  );
}
