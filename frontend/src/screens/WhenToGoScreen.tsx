import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import axios from 'axios';
import { Airport } from '@fast-travel/shared';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  CalendarDays,
  ExternalLink,
  List as ListIcon,
  Loader2,
  Map as MapIcon,
  MapPin,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Search,
  Sparkles,
  TrendingDown,
  X,
} from 'lucide-react';
import { format, addDays, addMonths, endOfMonth, startOfMonth } from 'date-fns';
import { useAirportSearch } from '../hooks/useAirportSearch';
import { fetchCheapestDay, CheapestDayResponse, CalendarDay } from '../api/whenToGo.api';
import { nearbyAirportsByCoords } from '../api/airports.api';
import { fetchSuggestedRoutes, SuggestedRoute } from '../api/suggestedRoutes.api';
import {
  resolveUserCoords,
  getBrowserCoords,
  readCachedCoords,
  readCachedNearby,
  cacheNearby,
} from '../utils/geolocation.utils';
import { track, AnalyticsEvent } from '../lib/analytics';
import { DateRangePicker } from '../components/DateRangePicker';
import { SingleFlightMap } from '../components/SingleFlightMap';

const TripMap = lazy(() => import('../components/TripMap').then((m) => ({ default: m.TripMap })));

/* Popular fallback origins — mirrors TripPlannerScreen so the right column
   always has a map to render even before geolocation resolves. */
const POPULAR_AIRPORTS: Airport[] = [
  { iata: 'IST', name: 'Istanbul Airport', timezone: 'Europe/Istanbul', city: { id: 'ist', name: 'Istanbul', countryCode: 'TR', countryName: 'Turkey', lat: 41.01, lng: 28.98 } },
  { iata: 'LHR', name: 'Heathrow Airport', timezone: 'Europe/London', city: { id: 'lon', name: 'London', countryCode: 'GB', countryName: 'United Kingdom', lat: 51.47, lng: -0.46 } },
  { iata: 'CDG', name: 'Charles de Gaulle', timezone: 'Europe/Paris', city: { id: 'par', name: 'Paris', countryCode: 'FR', countryName: 'France', lat: 49.01, lng: 2.55 } },
];


/* ────────────────────────────────────────────────────────────────────────────
   When To Go — pick origin, destination, and a window. The user hits Search
   and we return the cheapest single day in that window with a rich card and
   a map preview. URL state via ?from/?to/?start/?end keeps it shareable.

   Layout mirrors TripPlannerScreen (Budget Planner) so both tools share the
   same chrome: sticky tool header, 400px form column, sticky map + result
   column on desktop.
   ──────────────────────────────────────────────────────────────────────────── */

const TODAY = () => format(new Date(), 'yyyy-MM-dd');
const FMT_DATE_LONG = (iso: string) => format(new Date(iso + 'T12:00:00'), 'EEE, MMM d, yyyy');
const FMT_DATE_TINY = (iso: string) => format(new Date(iso + 'T12:00:00'), 'MMM d');

type Preset = 'this-month' | 'next-month' | 'next-90' | 'custom';

function computePresetWindow(preset: Preset): { start: string; end: string } {
  const today = new Date();
  switch (preset) {
    case 'this-month':
      return { start: format(today, 'yyyy-MM-dd'), end: format(endOfMonth(today), 'yyyy-MM-dd') };
    case 'next-month': {
      const nm = startOfMonth(addMonths(today, 1));
      return { start: format(nm, 'yyyy-MM-dd'), end: format(endOfMonth(nm), 'yyyy-MM-dd') };
    }
    case 'next-90':
      return { start: format(today, 'yyyy-MM-dd'), end: format(addDays(today, 90), 'yyyy-MM-dd') };
    case 'custom':
      return { start: '', end: '' };
  }
}

function presetLabel(preset: Preset): string {
  switch (preset) {
    case 'this-month':
      return 'This month';
    case 'next-month':
      return 'Next month';
    case 'next-90':
      return 'Next 90 days';
    case 'custom':
      return 'Custom range';
  }
}

function fmtTime(iso: string): string {
  // Provider returns local datetime as "YYYY-MM-DDTHH:mm:ss" — parse the
  // wall clock value, don't shift by browser timezone.
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : '';
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function isNextDay(departISO: string, arriveISO: string): boolean {
  return departISO.slice(0, 10) !== arriveISO.slice(0, 10);
}

/* ── City picker ──────────────────────────────────────────────────────────── */

interface CityPickerProps {
  label: string;
  iata: string;
  onSelect: (airport: Airport) => void;
  onClear: () => void;
}

function CityPicker({ label, iata, onSelect, onClear }: CityPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { results, loading } = useAirportSearch(query);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function pick(airport: Airport) {
    onSelect(airport);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="relative">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="input-field w-full flex items-center gap-2 px-3 rounded-2xl text-left"
          style={{ height: '48px' }}
        >
          <MapPin size={16} className="text-text-xmuted shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wide text-text-muted font-bold leading-none">
              {label}
            </div>
            <div className="text-sm font-semibold text-text-primary truncate leading-tight mt-0.5">
              {iata ? iata : <span className="text-text-xmuted font-normal">Pick a city</span>}
            </div>
          </div>
          {iata && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  onClear();
                }
              }}
              className="w-6 h-6 rounded-full bg-surface-2 border border-border flex items-center justify-center text-text-muted hover:text-text-primary cursor-pointer"
              aria-label={`Clear ${label}`}
            >
              <X size={11} />
            </span>
          )}
        </button>
      ) : (
        <div className="input-field w-full flex items-center gap-2 px-3 rounded-2xl" style={{ height: '48px' }}>
          <Search size={16} className="text-text-xmuted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="City or airport…"
            className="flex-1 bg-transparent outline-none text-sm font-medium text-text-primary placeholder:text-text-xmuted"
            aria-label={`Search ${label}`}
          />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setQuery('');
            }}
            className="w-6 h-6 rounded-full bg-surface-2 border border-border flex items-center justify-center text-text-muted hover:text-text-primary"
            aria-label="Cancel"
          >
            <X size={11} />
          </button>
        </div>
      )}

      {open && query.trim().length > 0 && (
        <div
          className="absolute left-0 right-0 top-full mt-1.5 bg-surface border border-border rounded-2xl shadow-xl z-50 overflow-hidden max-h-72 overflow-y-auto"
          style={{ boxShadow: '0 12px 32px rgba(15,23,42,0.12)' }}
        >
          {loading && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-text-muted">
              <Loader2 size={13} className="animate-spin" /> Searching…
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-4 py-3 text-xs text-text-muted">No matches.</div>
          )}
          {results.slice(0, 6).map((a) => (
            <button
              key={a.iata}
              onClick={() => pick(a)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-soft/50 transition-colors border-b border-border/40 last:border-0 text-left"
            >
              <div className="w-8 h-8 rounded-xl bg-indigo-soft border border-indigo-border flex items-center justify-center shrink-0">
                <Plane size={13} className="text-indigo" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-sm font-semibold text-text-primary truncate">
                    {a.city.name}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-indigo-mid shrink-0">
                    {a.iata}
                  </span>
                </div>
                <div className="text-[11px] text-text-muted truncate">{a.name}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Window picker (preset chips + DateRangePicker when custom) ──────────── */

interface WindowPickerProps {
  preset: Preset;
  start: string;
  end: string;
  onPresetChange: (preset: Preset) => void;
  /** Independent setters — DateRangePicker fires two synchronous callbacks
   *  (onChangeFrom + onChangeTo('')) inside the same event handler. Funneling
   *  both through a single (s, e) callback closes over a stale `start` for
   *  the second call and silently reverts the user's pick. Mirror the
   *  TripPlannerScreen wiring instead, where each setter is independent. */
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}

function WindowPicker({
  preset,
  start,
  end,
  onPresetChange,
  onStartChange,
  onEndChange,
}: WindowPickerProps) {
  const presets: Preset[] = ['this-month', 'next-month', 'next-90', 'custom'];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => {
          const active = preset === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPresetChange(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                active
                  ? 'bg-indigo text-white shadow-sm'
                  : 'bg-surface-2 text-text-secondary border border-border hover:border-indigo-border'
              }`}
            >
              {presetLabel(p)}
            </button>
          );
        })}
      </div>

      {preset === 'custom' ? (
        <DateRangePicker
          dateFrom={start}
          dateTo={end}
          today={TODAY()}
          onChangeFrom={(v) => {
            onStartChange(v);
            // Mirror TripPlannerScreen: if the new start is on/after the
            // current end, the end is no longer valid — clear it so the
            // user is prompted to pick a fresh end.
            if (end && v >= end) onEndChange('');
          }}
          onChangeTo={onEndChange}
          label=""
          fromLabel="Start"
          toLabel="End"
        />
      ) : start && end ? (
        <div className="text-xs text-text-muted px-1">
          Searching <span className="font-semibold text-text-secondary">{FMT_DATE_TINY(start)}</span>
          {' → '}
          <span className="font-semibold text-text-secondary">{FMT_DATE_TINY(end)}</span>
        </div>
      ) : null}
    </div>
  );
}

/* ── Result card ──────────────────────────────────────────────────────────── */

interface ResultCardProps {
  loading: boolean;
  error: string | null;
  result: CheapestDayResponse | null;
  origin: string;
  destination: string;
  onCtaClick: () => void;
  onPickDay: (day: CalendarDay) => void;
}

function ResultCard({
  loading,
  error,
  result,
  origin,
  destination,
  onCtaClick,
  onPickDay,
}: ResultCardProps) {
  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-4 py-3">
        <p className="text-sm font-semibold text-red-700 dark:text-red-400">
          Couldn&rsquo;t fetch prices
        </p>
        <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">{error}</p>
      </div>
    );
  }

  if (loading && !result) {
    return (
      <div className="bg-surface border border-border rounded-3xl p-6">
        <div className="h-5 w-32 bg-surface-2 rounded animate-pulse mb-3" />
        <div className="h-8 w-56 bg-surface-2 rounded animate-pulse mb-2" />
        <div className="h-12 w-32 bg-surface-2 rounded animate-pulse mb-4" />
        <div className="h-4 w-40 bg-surface-2 rounded animate-pulse mb-5" />
        <div className="h-12 w-full bg-surface-2 rounded-2xl animate-pulse" />
      </div>
    );
  }

  const cheapest = result?.cheapest ?? null;
  if (result && !cheapest) {
    return (
      <div className="bg-surface border border-border rounded-3xl p-6">
        <p className="text-sm font-semibold text-text-primary mb-1">
          No flights found in this window
        </p>
        <p className="text-xs text-text-muted">
          Try widening the window or picking a different month.
        </p>
      </div>
    );
  }

  if (!cheapest) {
    // Pre-search empty state. Mirrors the Budget Planner "Set your budget,
    // we'll do the rest" treatment so the right column never sits empty.
    const ready = !!origin && !!destination;
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-soft border border-indigo-border flex items-center justify-center">
          <Sparkles size={24} className="text-indigo" />
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">
            {ready ? 'Ready to find the cheapest day' : 'Pick a route to start'}
          </p>
          <p className="text-xs text-text-muted mt-1 max-w-xs">
            {ready
              ? "Hit Find cheapest day — we'll fetch live prices from Kiwi.com on every search."
              : "Choose where you're flying from, where you'd like to land, and how flexible you can be — we'll show you the single cheapest day in that window."}
          </p>
        </div>
      </div>
    );
  }

  const it = cheapest.itinerary;
  const stopsLabel =
    !it || it.stops === 0
      ? 'Direct'
      : it.viaIatas && it.viaIatas.length > 0
        ? `${it.stops} stop${it.stops > 1 ? 's' : ''} · via ${it.viaIatas.join(', ')}`
        : `${it.stops} stop${it.stops > 1 ? 's' : ''}`;

  return (
    <div className="bg-surface border border-border rounded-3xl relative overflow-hidden">
      {loading && (
        <div className="absolute inset-0 bg-white/55 backdrop-blur-[1px] z-10 flex items-start justify-center pt-6">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-border shadow-sm text-xs text-text-secondary">
            <Loader2 size={13} className="animate-spin text-indigo" />
            Refreshing…
          </div>
        </div>
      )}

      <div className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown size={14} className="text-emerald" />
          <span className="text-xs font-bold text-emerald uppercase tracking-wide">
            Cheapest day
          </span>
          {it?.airlineName && (
            <span className="ml-auto text-[11px] font-semibold text-text-muted">
              {it.airlineName}
              {it.airlineCode && (
                <span className="ml-1 font-mono text-indigo-mid">{it.airlineCode}</span>
              )}
            </span>
          )}
        </div>

        <div className="text-2xl font-black text-text-primary tracking-tight mb-1">
          {FMT_DATE_LONG(cheapest.date)}
        </div>
        <div className="text-4xl font-black text-indigo tracking-tight mb-4">
          ${Math.round(cheapest.priceUsd)}
          <span className="text-base font-bold text-text-muted ml-1">{cheapest.currency}</span>
        </div>

        {it ? (
          <div className="bg-surface-2 border border-border rounded-2xl p-4 mb-5">
            <div className="grid grid-cols-[auto,1fr,auto] gap-3 items-center">
              <div className="text-center">
                <div className="text-base font-bold text-text-primary">{fmtTime(it.departureDatetime)}</div>
                <div className="text-[11px] font-mono font-bold text-indigo-mid mt-0.5">{it.originIata}</div>
              </div>

              <div className="flex flex-col items-center min-w-0">
                <div className="text-[10px] uppercase tracking-wide font-semibold text-text-muted mb-0.5">
                  {fmtDuration(it.durationMinutes)}
                </div>
                <div className="relative w-full flex items-center">
                  <div className="flex-1 h-px bg-border" />
                  <PlaneTakeoff size={13} className="text-indigo mx-1.5" />
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="text-[10px] text-text-muted mt-0.5 truncate max-w-full">
                  {stopsLabel}
                </div>
              </div>

              <div className="text-center">
                <div className="text-base font-bold text-text-primary">
                  {fmtTime(it.arrivalDatetime)}
                  {isNextDay(it.departureDatetime, it.arrivalDatetime) && (
                    <span className="text-[10px] text-orange-500 align-super ml-0.5">+1</span>
                  )}
                </div>
                <div className="text-[11px] font-mono font-bold text-indigo-mid mt-0.5">
                  {it.destinationIata}
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-1.5 text-xs text-text-muted">
              <span className="font-semibold text-text-secondary">{it.originCity}</span>
              <ArrowRight size={11} />
              <span className="font-semibold text-text-secondary">{it.destinationCity}</span>
              {it.destinationCountry && (
                <>
                  <span>·</span>
                  <span>{it.destinationCountry}</span>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-text-muted mb-5">
            <span className="font-semibold text-text-secondary">{origin}</span>
            <ArrowRight size={11} />
            <span className="font-semibold text-text-secondary">{destination}</span>
            <span className="mx-1">·</span>
            <span>one-way</span>
          </div>
        )}

        {cheapest.bookingUrl ? (
          <a
            href={cheapest.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onCtaClick}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-indigo text-white text-sm font-bold hover:bg-indigo/90 transition-all active:scale-[0.98]"
            style={{ boxShadow: '0 10px 28px rgba(55,48,163,0.28)' }}
          >
            Book this flight
            <ExternalLink size={14} />
          </a>
        ) : null}

        {result && result.days.length > 1 && (
          <div className="mt-5 pt-5 border-t border-border/60">
            <div className="text-[11px] uppercase tracking-wide text-text-muted font-bold mb-2">
              Other cheap days nearby
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.days
                .filter((d) => d.date !== cheapest.date)
                .slice(0, 6)
                .map((d) => (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => onPickDay(d)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-2 border border-border hover:border-indigo-border transition-all text-xs"
                  >
                    <span className="font-semibold text-text-primary">{FMT_DATE_TINY(d.date)}</span>
                    <span className="text-text-muted">${Math.round(d.priceUsd)}</span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main screen ──────────────────────────────────────────────────────────── */

export function WhenToGoScreen() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const fromIata = (params.get('from') ?? '').toUpperCase();
  const toIata = (params.get('to') ?? '').toUpperCase();
  const startParam = params.get('start') ?? '';
  const endParam = params.get('end') ?? '';

  const initialPreset: Preset = useMemo(() => {
    if (!startParam || !endParam) return 'next-month';
    for (const p of ['this-month', 'next-month', 'next-90'] as Preset[]) {
      const w = computePresetWindow(p);
      if (w.start === startParam && w.end === endParam) return p;
    }
    return 'custom';
  }, [startParam, endParam]);

  const [preset, setPreset] = useState<Preset>(initialPreset);
  const [start, setStart] = useState(startParam || computePresetWindow('next-month').start);
  const [end, setEnd] = useState(endParam || computePresetWindow('next-month').end);

  // Full Airport objects for the picked endpoints. Used to render the map
  // preview before a search runs. After a search, the map prefers itinerary
  // coords (which include actual airport lat/lng from Kiwi). On URL reload
  // with bare ?from=/?to= IATA, these stay null until the user re-picks or
  // until the result lands — same trade-off as TripPlannerScreen.
  const [fromAirport, setFromAirport] = useState<Airport | null>(null);
  const [toAirport, setToAirport] = useState<Airport | null>(null);

  const [result, setResult] = useState<CheapestDayResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  // Mobile-only view toggle. Desktop shows card + map stacked.
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
  // Nearby airports — used as a single-pin fallback for the desktop empty-state
  // map so the right column never sits blank. Mirrors TripPlannerScreen.
  const [nearby, setNearby] = useState<Airport[]>([]);
  // True once both browser geolocation AND IP fallback have failed. Used to
  // render an explicit "Allow location" CTA in the suggestions block — the
  // common case (IP geo resolves) leaves this false and never shows the CTA.
  const [locDenied, setLocDenied] = useState(false);
  const [geoTick, setGeoTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  /* Geolocation — resolve nearby airports for the empty-state map fallback. */
  useEffect(() => {
    let cancelled = false;
    const cachedCoords = readCachedCoords();
    if (cachedCoords) {
      const cached = readCachedNearby<Airport>(cachedCoords.lat, cachedCoords.lng);
      if (cached) {
        setNearby(cached.slice(0, 3));
        return;
      }
    }
    (async () => {
      try {
        const coords = await resolveUserCoords();
        if (cancelled) return;
        const airports = await nearbyAirportsByCoords(coords.lat, coords.lng);
        if (cancelled) return;
        cacheNearby(coords.lat, coords.lng, airports);
        setNearby(airports.slice(0, 3));
      } catch {
        if (!cancelled) setLocDenied(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [geoTick]);

  /* Suggested routes — fetched once we know an origin (URL "from" wins,
     otherwise the nearest airport derived from geolocation). The backend
     returns top destinations from analytics, backfilling from a curated
     regional list when PostHog is sparse. */
  const suggestionOriginIata = fromIata || nearby[0]?.iata || '';
  const [suggestions, setSuggestions] = useState<SuggestedRoute[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionOriginCity, setSuggestionOriginCity] = useState<string | null>(null);

  useEffect(() => {
    if (!suggestionOriginIata) {
      setSuggestions([]);
      setSuggestionOriginCity(null);
      return;
    }
    const controller = new AbortController();
    setSuggestionsLoading(true);
    fetchSuggestedRoutes(suggestionOriginIata, 3, controller.signal)
      .then((res) => {
        setSuggestions(res.routes);
        setSuggestionOriginCity(res.origin.city.name);
      })
      .catch(() => {
        // Endpoint failure leaves the section empty — the curated fallback
        // already runs server-side, so a true zero here means the origin IATA
        // wasn't recognised. We swallow rather than surfacing an error in an
        // inspiration panel.
        setSuggestions([]);
      })
      .finally(() => setSuggestionsLoading(false));
    return () => controller.abort();
  }, [suggestionOriginIata]);

  function requestLocation() {
    // Re-trigger the geolocation effect. getBrowserCoords prompts the OS
    // dialog directly so a previously-denied user can grant it explicitly.
    getBrowserCoords().catch(() => {
      // Still denied — leave the CTA visible.
    });
    setLocDenied(false);
    setGeoTick((t) => t + 1);
  }

  /* URL sync — write whenever inputs change, no auto-fetch. */
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (fromIata) next.set('from', fromIata);
    else next.delete('from');
    if (toIata) next.set('to', toIata);
    else next.delete('to');
    if (start) next.set('start', start);
    else next.delete('start');
    if (end) next.set('end', end);
    else next.delete('end');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromIata, toIata, start, end]);

  /* Mark dirty whenever inputs change after a successful search. */
  useEffect(() => {
    if (result) setDirty(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromIata, toIata, start, end]);

  /* Drop cached Airport metadata if the URL IATA no longer matches — keeps
     the map preview honest when the user pastes a fresh share link or clears
     a side via the URL. */
  useEffect(() => {
    if (fromAirport && fromAirport.iata !== fromIata) setFromAirport(null);
  }, [fromIata, fromAirport]);
  useEffect(() => {
    if (toAirport && toAirport.iata !== toIata) setToAirport(null);
  }, [toIata, toAirport]);

  const canSearch = !!fromIata && !!toIata && !!start && !!end && fromIata !== toIata && !loading;

  function setFrom(airport: Airport) {
    setFromAirport(airport);
    const next = new URLSearchParams(params);
    next.set('from', airport.iata);
    setParams(next, { replace: true });
  }
  function clearFrom() {
    setFromAirport(null);
    const next = new URLSearchParams(params);
    next.delete('from');
    setParams(next, { replace: true });
    setResult(null);
    setError(null);
  }
  function setTo(airport: Airport) {
    setToAirport(airport);
    const next = new URLSearchParams(params);
    next.set('to', airport.iata);
    setParams(next, { replace: true });
  }
  function clearTo() {
    setToAirport(null);
    const next = new URLSearchParams(params);
    next.delete('to');
    setParams(next, { replace: true });
    setResult(null);
    setError(null);
  }
  function swap() {
    if (!fromIata || !toIata) return;
    const next = new URLSearchParams(params);
    next.set('from', toIata);
    next.set('to', fromIata);
    setParams(next, { replace: true });
    setFromAirport(toAirport);
    setToAirport(fromAirport);
  }

  function handlePresetChange(p: Preset) {
    setPreset(p);
    track(AnalyticsEvent.WhenToGoWindowPreset, { preset: p });
    if (p !== 'custom') {
      const w = computePresetWindow(p);
      setStart(w.start);
      setEnd(w.end);
    } else if (!start || !end) {
      // Seed custom range from current values if available, else from "next-month".
      const seed = computePresetWindow('next-month');
      if (!start) setStart(seed.start);
      if (!end) setEnd(seed.end);
    }
  }

  async function runSearch() {
    if (!canSearch) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    track(AnalyticsEvent.WhenToGoSearch, { from: fromIata, to: toIata, start, end, preset });

    try {
      const res = await fetchCheapestDay(fromIata, toIata, start, end, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setResult(res);
      setDirty(false);
    } catch (err: unknown) {
      if (axios.isCancel(err)) return;
      const message =
        err instanceof Error ? err.message : 'Something went wrong fetching the calendar.';
      setError(message);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  function handleCtaClick() {
    track(AnalyticsEvent.WhenToGoCtaClick, {
      from: fromIata,
      to: toIata,
      date: result?.cheapest?.date,
      priceUsd: result?.cheapest?.priceUsd,
    });
  }

  function pickDay(day: CalendarDay) {
    // Treat clicking a nearby day as a new "primary" answer: synthesize a
    // result envelope where the picked day becomes cheapest, keep the rest
    // of the list. Avoids a refetch since we already have the data.
    if (!result) return;
    setResult({ ...result, cheapest: day });
  }

  /* ── Map element — prefers fresh itinerary coords; falls back to picked
        Airport metadata, then to a single-pin nearby/popular airport so the
        desktop right column never renders empty. ── */
  const mapElement = (() => {
    const it = result?.cheapest?.itinerary;
    if (it) {
      return (
        <SingleFlightMap
          origin={{
            iata: it.originIata,
            city: it.originCity,
            lat: it.originLat,
            lng: it.originLng,
          }}
          destination={{
            iata: it.destinationIata,
            city: it.destinationCity,
            lat: it.destinationLat,
            lng: it.destinationLng,
          }}
          via={
            it.viaIatas && it.viaCoords
              ? it.viaIatas.map((iata, i) => ({
                  iata,
                  lat: it.viaCoords![i]?.lat ?? 0,
                  lng: it.viaCoords![i]?.lng ?? 0,
                }))
              : []
          }
          height="100%"
        />
      );
    }
    if (fromAirport && toAirport) {
      return (
        <SingleFlightMap
          origin={{
            iata: fromAirport.iata,
            city: fromAirport.city.name,
            lat: fromAirport.city.lat,
            lng: fromAirport.city.lng,
          }}
          destination={{
            iata: toAirport.iata,
            city: toAirport.city.name,
            lat: toAirport.city.lat,
            lng: toAirport.city.lng,
          }}
          height="100%"
        />
      );
    }
    return null;
  })();

  /* Single-pin fallback for the desktop empty state. Pick the most relevant
     anchor we have: a partial pick, then nearby (geolocated), then a popular
     airport. Always returns an Airport so the desktop column never renders
     bare. */
  const fallbackAnchor: Airport =
    fromAirport ?? toAirport ?? nearby[0] ?? POPULAR_AIRPORTS[0];

  /* Apply a suggested route from the desktop empty-state inspiration list. */
  function applySuggestedRoute(from: Airport, to: Airport) {
    track(AnalyticsEvent.WhenToGoCtaClick, {
      from: from.iata,
      to: to.iata,
      source: 'suggested-route',
    });
    setFromAirport(from);
    setToAirport(to);
    const next = new URLSearchParams(params);
    next.set('from', from.iata);
    next.set('to', to.iata);
    setParams(next, { replace: true });
  }

  const buttonLabel = loading
    ? 'Searching…'
    : result
      ? dirty
        ? 'Update search'
        : 'Search again'
      : 'Find cheapest day';

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-bg">
      <Helmet>
        <title>When To Go · Fast Travel</title>
      </Helmet>

      {/* Header — same chrome as Budget Planner so the tool screens feel like
          siblings, not unrelated pages. */}
      <header className="flex items-center gap-3 px-4 md:px-8 py-4 border-b border-border sticky top-0 bg-bg z-10">
        <button
          onClick={() => navigate(-1)}
          className="p-1 -ml-1 text-text-muted hover:text-text-primary transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-text-primary">When To Go</h1>
          <p className="text-xs text-text-muted">
            Find the cheapest day to fly between any two cities
          </p>
        </div>
      </header>

      {/* Content — single column on mobile, two columns on desktop */}
      <div className="max-w-screen-lg mx-auto px-4 md:px-8 py-6 md:grid md:grid-cols-[400px_1fr] md:gap-10 md:items-start">

        {/* ── Form column ── */}
        <div className="space-y-5">
          {/* Route */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-muted px-1">Route</span>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2 items-center">
              <CityPicker label="From" iata={fromIata} onSelect={setFrom} onClear={clearFrom} />
              <button
                type="button"
                onClick={swap}
                disabled={!fromIata || !toIata}
                className="w-10 h-10 rounded-full bg-surface-2 border border-border flex items-center justify-center text-text-secondary hover:text-indigo hover:border-indigo-border transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Swap origin and destination"
              >
                <ArrowLeftRight size={14} />
              </button>
              <CityPicker label="To" iata={toIata} onSelect={setTo} onClear={clearTo} />
            </div>
            {fromIata && toIata && fromIata === toIata && (
              <p className="text-[11px] text-rose-600 px-1">
                Origin and destination must differ.
              </p>
            )}
          </div>

          {/* Window */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-muted px-1 flex items-center gap-1.5">
              <CalendarDays size={11} /> Window
            </span>
            <WindowPicker
              preset={preset}
              start={start}
              end={end}
              onPresetChange={handlePresetChange}
              onStartChange={setStart}
              onEndChange={setEnd}
            />
          </div>

          {/* Search button */}
          <button
            type="button"
            onClick={runSearch}
            disabled={!canSearch}
            className="w-full h-14 bg-indigo hover:bg-indigo/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-base rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Search size={18} />
            )}
            {buttonLabel}
          </button>

          <p className="text-[11px] text-text-muted/70 px-1">
            Prices are sampled from Kiwi.com on every search. We don&rsquo;t add markups.
          </p>

          {/* Mobile-only results column (matches TripPlannerScreen's pattern). */}
          <div className="md:hidden">
            {mapElement && (
              <div className="flex gap-2 mb-3 border-b border-border pb-3">
                <button
                  type="button"
                  onClick={() => setMobileView('list')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                    mobileView === 'list'
                      ? 'bg-indigo-soft border-indigo-border text-indigo'
                      : 'bg-surface-2 border-border text-text-muted hover:border-indigo-border'
                  }`}
                >
                  <ListIcon size={15} />
                  Details
                </button>
                <button
                  type="button"
                  onClick={() => setMobileView('map')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                    mobileView === 'map'
                      ? 'bg-indigo-soft border-indigo-border text-indigo'
                      : 'bg-surface-2 border-border text-text-muted hover:border-indigo-border'
                  }`}
                >
                  <MapIcon size={15} />
                  Map
                </button>
              </div>
            )}
            {mobileView === 'map' && mapElement ? (
              <div className="h-72 rounded-2xl overflow-hidden border border-border">
                {mapElement}
                {result?.cheapest?.itinerary && (
                  <div className="flex items-center justify-between gap-2 mt-2 text-[11px] text-text-muted px-1">
                    <span className="flex items-center gap-1">
                      <PlaneTakeoff size={11} /> {result.cheapest.itinerary.originCity}
                    </span>
                    <span className="flex items-center gap-1">
                      <PlaneLanding size={11} /> {result.cheapest.itinerary.destinationCity}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <ResultCard
                loading={loading}
                error={error}
                result={result}
                origin={fromIata}
                destination={toIata}
                onCtaClick={handleCtaClick}
                onPickDay={pickDay}
              />
            )}
          </div>
        </div>

        {/* ── Results column — desktop only ── */}
        <div className="hidden md:block sticky top-[73px]">
          {mapElement ? (
            <div className="h-56 rounded-2xl overflow-hidden border border-border mb-4">
              {mapElement}
            </div>
          ) : (
            <div
              className={`h-72 rounded-2xl overflow-hidden border border-border mb-4 ${
                !fromAirport && !toAirport ? 'opacity-70' : ''
              }`}
            >
              <Suspense
                fallback={
                  <div className="h-full flex items-center justify-center">
                    <Loader2 size={20} className="animate-spin text-indigo" />
                  </div>
                }
              >
                <TripMap origin={fallbackAnchor} legs={[]} />
              </Suspense>
            </div>
          )}
          <ResultCard
            loading={loading}
            error={error}
            result={result}
            origin={fromIata}
            destination={toIata}
            onCtaClick={handleCtaClick}
            onPickDay={pickDay}
          />

          {/* Desktop-only inspiration shown until the user has a real result.
              Origin is the URL "from" if present, else the user's nearest
              airport from geolocation. Routes come from PostHog (top searched
              from that origin) with curated regional backfill server-side. */}
          {!result && !loading && !error && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-3 px-1">
                <Sparkles size={13} className="text-indigo" />
                <span className="text-[11px] uppercase tracking-wide font-bold text-text-muted">
                  {suggestionOriginCity
                    ? `Popular from ${suggestionOriginCity}`
                    : 'Trending routes'}
                </span>
              </div>
              {suggestionsLoading && suggestions.length === 0 ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-full h-[64px] bg-surface border border-border rounded-2xl animate-pulse"
                    />
                  ))}
                </div>
              ) : suggestions.length > 0 ? (
                <div className="space-y-2">
                  {suggestions.map((r) => (
                    <button
                      key={`${r.from.iata}-${r.to.iata}`}
                      type="button"
                      onClick={() => applySuggestedRoute(r.from, r.to)}
                      className="w-full flex items-center gap-3 bg-surface border border-border rounded-2xl px-4 py-3 hover:border-indigo-border hover:bg-indigo-soft/40 transition-all text-left"
                    >
                      <div className="w-10 h-10 rounded-xl bg-indigo-soft border border-indigo-border flex items-center justify-center shrink-0">
                        <PlaneTakeoff size={15} className="text-indigo" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                          <span className="truncate">{r.from.city.name}</span>
                          <ArrowRight size={12} className="text-text-muted shrink-0" />
                          <span className="truncate">{r.to.city.name}</span>
                        </div>
                        <div className="text-[11px] text-text-muted mt-0.5">{r.tagline}</div>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-indigo-mid shrink-0">
                        {r.from.iata} · {r.to.iata}
                      </span>
                    </button>
                  ))}
                </div>
              ) : locDenied && !suggestionOriginIata ? (
                <button
                  type="button"
                  onClick={requestLocation}
                  className="w-full flex items-center gap-3 bg-surface border border-dashed border-border rounded-2xl px-4 py-3 hover:border-indigo-border hover:bg-indigo-soft/40 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-soft border border-indigo-border flex items-center justify-center shrink-0">
                    <MapPin size={15} className="text-indigo" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-text-primary">
                      Allow location for personalized suggestions
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5">
                      We&apos;ll surface popular routes from your nearest airport.
                    </div>
                  </div>
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
