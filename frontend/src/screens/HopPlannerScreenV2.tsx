import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Airport, LocationSelection, selectionLabel, selectionName, selectionCountryCode } from '@fast-travel/shared';
import { format, addDays } from 'date-fns';
import { ArrowRight, MapPin, Waypoints, CalendarDays, Loader2 } from 'lucide-react';
import { MarketingShellV2 } from '../components/MarketingShellV2';
import { AirportSearchInput } from '../components/AirportSearchInput';
import { TripMapColumn } from '../components/TripMapColumn';
import { V2ToolHero } from '../components/V2ToolHero';
import { NearbyAirportRow } from '../components/NearbyAirportRow';
import { MobileViewToggle, type MobileView } from '../components/MobileViewToggle';
import { nearbyAirportsByCoords } from '../api/airports.api';
import { resolveUserCoords, readCachedCoords, readCachedNearby, cacheNearby } from '../utils/geolocation.utils';
import { formatYMD } from '../utils/date.utils';
import { useTripStore } from '../store/trip.store';
import { useSessionStore } from '../store/session.store';
import { track, AnalyticsEvent } from '../lib/analytics';

interface Props {
  onMenuOpen?: () => void;
}

// Static fallback used when we have no geolocation (e.g. user denied the
// browser prompt and the IP lookup also failed). Picked to cover the three
// major Western-Europe demand corridors Flexbook routes most often.
const POPULAR_AIRPORTS: Airport[] = [
  { iata: 'BCN', name: 'Barcelona–El Prat', timezone: 'Europe/Madrid',  city: { id: 'bcn', name: 'Barcelona', countryCode: 'ES', countryName: 'Spain',          lat: 41.30, lng: 2.08 } },
  { iata: 'LHR', name: 'Heathrow',          timezone: 'Europe/London',  city: { id: 'lon', name: 'London',    countryCode: 'GB', countryName: 'United Kingdom', lat: 51.47, lng: -0.46 } },
  { iata: 'CDG', name: 'Charles de Gaulle', timezone: 'Europe/Paris',   city: { id: 'par', name: 'Paris',     countryCode: 'FR', countryName: 'France',         lat: 49.01, lng: 2.55 } },
];

function airportToSelection(a: Airport): LocationSelection {
  return { kind: 'airport', airport: a };
}

export function HopPlannerScreenV2({ onMenuOpen }: Props) {
  const navigate = useNavigate();
  const setStoreOrigin = useTripStore((s) => s.setOrigin);
  const setStorePassengers = useTripStore((s) => s.setPassengers);
  const setSelectedDate = useSessionStore((s) => s.setSelectedDate);
  const [originQuery, setOriginQuery] = useState('');
  const [origin, setOrigin] = useState<LocationSelection | null>(null);
  const [date, setDate] = useState<string>(formatYMD(addDays(new Date(), 7)));
  const [nearby, setNearby] = useState<Airport[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(true);
  const [mobileView, setMobileView] = useState<MobileView>('list');

  // Stops accumulate in V1 once user proceeds; V2 landing tracks only origin.
  const stops: LocationSelection[] = [];
  const cityCount = origin ? 1 : 0;

  // Resolve user coords + fetch 3 nearby airports. Prefer cached values so the
  // chips appear instantly on repeat visits; otherwise hit the API in the
  // background and fall back to POPULAR_AIRPORTS if everything fails.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const cachedCoords = readCachedCoords();
      if (cachedCoords) {
        const cachedNearby = readCachedNearby<Airport>(cachedCoords.lat, cachedCoords.lng);
        if (cachedNearby && cachedNearby.length > 0) {
          if (!cancelled) {
            setNearby(cachedNearby.slice(0, 3));
            setLoadingNearby(false);
          }
          return;
        }
      }

      try {
        const coords = await resolveUserCoords();
        const result = await nearbyAirportsByCoords(coords.lat, coords.lng);
        if (cancelled) return;
        cacheNearby(coords.lat, coords.lng, result);
        setNearby(result.slice(0, 3));
      } catch {
        if (!cancelled) setNearby(POPULAR_AIRPORTS);
      } finally {
        if (!cancelled) setLoadingNearby(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleProceed() {
    if (!origin || !date) return;
    setStoreOrigin(origin);
    setStorePassengers(1);
    setSelectedDate(date);
    const trackOrigin =
      origin.kind === 'airport' ? origin.airport.iata : `@${origin.city.id}`;
    const trackCity =
      origin.kind === 'airport' ? origin.airport.city.name : origin.city.name;
    const trackCountry =
      origin.kind === 'airport' ? origin.airport.city.countryCode : origin.city.countryCode;
    track(AnalyticsEvent.TripSearchStarted, {
      origin: trackOrigin,
      originCity: trackCity,
      originCountry: trackCountry,
      passengers: 1,
      departureDate: date,
    });
    navigate('/flights');
  }

  const canProceed = !!origin && !!date;

  return (
    <MarketingShellV2
      active="build"
      title="Trip Builder"
      description="Chain the cheapest one-way fares into a multi-stop trip."
      onMenuOpen={onMenuOpen}
      showShare={!!origin}
    >
      <section className="max-w-6xl xl:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 pt-6 md:pt-14 pb-10">
        {/* Two-column on lg+: [hero + map] left, form right (aligned with the
            hero text). On mobile both stack with the toggle between hero and
            content. */}
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 lg:gap-10">
          {/* LEFT: hero + (mobile toggle) + map */}
          <div>
            <V2ToolHero
              toolName="Trip Builder"
              titleLine1="Plan your"
              titleAccent="trip"
              subhead="Cheapest fares. Biggest adventures. Hop between cities on the lowest available next-leg fare — no return required."
            />

            <div className="md:hidden mb-5">
              <MobileViewToggle value={mobileView} onChange={setMobileView} />
            </div>

            <div className={`${mobileView === 'map' ? '' : 'hidden'} md:block`}>
              <TripMapColumn
                origin={origin}
                stops={stops}
              />
            </div>
          </div>

          {/* RIGHT: Your trip card */}
          <div
            className={`bg-surface rounded-[24px] border border-border/60 p-5 md:p-6 ${mobileView === 'list' ? '' : 'hidden'} md:block`}
            style={{ boxShadow: '0 20px 50px -20px rgba(15,23,42,0.18)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-text-primary">Your trip</h2>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-2 border border-border text-[11px] font-bold text-text-secondary">
                <Waypoints size={11} />
                {cityCount} {cityCount === 1 ? 'city' : 'cities'}
              </span>
            </div>

            {/* Origin block */}
            <FieldLabel>Starting from</FieldLabel>
            {origin ? (
              <button
                type="button"
                onClick={() => {
                  setOrigin(null);
                  setOriginQuery('');
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl border border-indigo-border bg-indigo-soft text-left mb-4"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo flex items-center justify-center shrink-0">
                  <MapPin size={14} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-text-primary truncate">
                      {selectionName(origin)}
                    </p>
                    <CountryFlag cc={selectionCountryCode(origin)} />
                  </div>
                  <p className="text-[11px] text-text-muted">
                    {origin.kind === 'airport' ? `${origin.airport.iata} · Departure airport` : 'Departure city'}
                  </p>
                </div>
                <span className="text-xs font-semibold text-text-muted">Change</span>
              </button>
            ) : (
              <>
                <div className="mb-3">
                  <AirportSearchInput
                    value={originQuery}
                    onChange={(v) => {
                      setOriginQuery(v);
                      if (origin) setOrigin(null);
                    }}
                    onSelect={(s) => {
                      setOrigin(s);
                      setOriginQuery(selectionLabel(s));
                    }}
                    placeholder="Search any city or airport"
                    ariaLabel="Origin"
                  />
                </div>

                {/* Nearby airports — mirror the V1 production layout: section
                    label + full-width rows with airport name + IATA + distance. */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2.5 mt-3 px-1">
                    <MapPin size={13} className="text-indigo-mid" />
                    <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-semibold">
                      Nearby airports
                    </p>
                  </div>
                  {loadingNearby ? (
                    <div className="section-shell px-4 py-4 flex items-center gap-2.5 text-text-muted text-sm">
                      <Loader2 size={14} className="animate-spin text-indigo-mid" />
                      <span>Detecting nearby airports…</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {nearby.slice(0, 3).map((a) => (
                        <NearbyAirportRow
                          key={a.iata}
                          airport={a}
                          onSelect={() => {
                            const sel = airportToSelection(a);
                            setOrigin(sel);
                            setOriginQuery(selectionLabel(sel));
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <hr className="border-border/60 my-5" />

            {/* Date block */}
            <FieldLabel>Travel date</FieldLabel>
            <DateField value={date} onChange={setDate} min={formatYMD(new Date())} />

            <hr className="border-border/60 my-5" />

            {/* CTA — stacks vertically on mobile for a full-width tap target,
                horizontal on sm+ where there's room for the price + button row. */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div>
                <p className="text-[11px] text-text-muted">Estimated flights total</p>
                <p className="text-2xl font-black text-text-primary">$0</p>
              </div>
              <button
                type="button"
                onClick={handleProceed}
                disabled={!canProceed}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-4 sm:py-3 rounded-full bg-orange text-white text-sm font-bold disabled:opacity-40 hover:bg-orange-dark transition-all"
                style={{ boxShadow: '0 12px 24px -8px rgba(249,115,22,0.45)' }}
              >
                Find cheapest hops
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

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

function DateField({
  value,
  onChange,
  min,
}: {
  value: string;
  onChange: (v: string) => void;
  min: string;
}) {
  const display = value ? format(new Date(value + 'T12:00:00'), 'EEE, MMM d') : 'Pick a date';
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
        {display}
      </span>
      <input
        type="date"
        className="absolute inset-0 opacity-0 cursor-pointer"
        value={value}
        min={min}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
        aria-label={`Travel date: ${display}`}
      />
    </label>
  );
}

function CountryFlag({ cc }: { cc: string }) {
  const flag = cc
    .toUpperCase()
    .replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));
  return <span className="text-base leading-none">{flag || '🌐'}</span>;
}
