import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Airport } from '@fast-travel/shared';
import {
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
import { track, AnalyticsEvent } from '../lib/analytics';
import { MarketingShell } from '../components/MarketingShell';
import { DateRangePicker } from '../components/DateRangePicker';
import { SingleFlightMap } from '../components/SingleFlightMap';
import { useAuthStore } from '../store/auth.store';

/* ────────────────────────────────────────────────────────────────────────────
   When To Go — pick origin, destination, and a window. The user hits Search
   and we return the cheapest single day in that window with a rich card and
   a map preview. URL state via ?from/?to/?start/?end keeps it shareable.
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
          style={{ height: '52px' }}
        >
          <MapPin size={16} className="text-text-xmuted shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wide text-text-muted font-bold">
              {label}
            </div>
            <div className="text-sm font-semibold text-text-primary truncate">
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
        <div className="input-field flex items-center gap-2 px-3 rounded-2xl" style={{ height: '52px' }}>
          <Search size={16} className="text-text-xmuted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${label.toLowerCase()} city or airport…`}
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
  onCustomChange: (start: string, end: string) => void;
}

function WindowPicker({ preset, start, end, onPresetChange, onCustomChange }: WindowPickerProps) {
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
          onChangeFrom={(v) => onCustomChange(v, end && v && end >= v ? end : '')}
          onChangeTo={(v) => onCustomChange(start, v)}
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
  if (!origin || !destination) {
    return (
      <div className="section-shell p-8 text-center">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-indigo-soft border border-indigo-border items-center justify-center mb-4">
          <Sparkles size={22} className="text-indigo" />
        </div>
        <h3 className="text-lg font-bold text-text-primary mb-1.5">Pick a route to start</h3>
        <p className="text-sm text-text-muted max-w-sm mx-auto">
          Choose where you&rsquo;re flying from, where you&rsquo;d like to land, and how flexible you
          can be — we&rsquo;ll show you the single cheapest day in that window.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="section-shell p-6 border-rose-300/50 bg-rose-50/30">
        <div className="text-sm font-semibold text-rose-700">Couldn&rsquo;t fetch prices</div>
        <p className="text-xs text-rose-600/80 mt-1">{error}</p>
      </div>
    );
  }

  if (loading && !result) {
    return (
      <div className="section-shell p-6">
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
      <div className="section-shell p-6">
        <div className="text-sm font-semibold text-text-primary mb-1">
          No flights found in this window
        </div>
        <p className="text-xs text-text-muted">
          Try widening the window or picking a different month.
        </p>
      </div>
    );
  }

  if (!cheapest) return null;

  const it = cheapest.itinerary;
  const stopsLabel =
    !it || it.stops === 0
      ? 'Direct'
      : it.viaIatas && it.viaIatas.length > 0
        ? `${it.stops} stop${it.stops > 1 ? 's' : ''} · via ${it.viaIatas.join(', ')}`
        : `${it.stops} stop${it.stops > 1 ? 's' : ''}`;

  return (
    <div className="section-shell relative overflow-hidden">
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
  const user = useAuthStore((s) => s.user);
  void user; // MarketingShell reads from the store directly.

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

  const [result, setResult] = useState<CheapestDayResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  // Mobile-only view toggle. Desktop shows card + map stacked.
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
  const abortRef = useRef<AbortController | null>(null);

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

  const canSearch = !!fromIata && !!toIata && !!start && !!end && fromIata !== toIata && !loading;

  function setFrom(airport: Airport) {
    const next = new URLSearchParams(params);
    next.set('from', airport.iata);
    setParams(next, { replace: true });
  }
  function clearFrom() {
    const next = new URLSearchParams(params);
    next.delete('from');
    setParams(next, { replace: true });
    setResult(null);
    setError(null);
  }
  function setTo(airport: Airport) {
    const next = new URLSearchParams(params);
    next.set('to', airport.iata);
    setParams(next, { replace: true });
  }
  function clearTo() {
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

  function handleCustomChange(s: string, e: string) {
    setStart(s);
    setEnd(e);
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

  /* ── Renders ── */

  const buttonLabel = loading
    ? 'Searching…'
    : result
      ? dirty
        ? 'Update search'
        : 'Search again'
      : 'Find cheapest day';

  const leftPanel = (
    <div className="max-w-xl w-full">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-soft border border-indigo-border mb-4">
        <Sparkles size={12} className="text-indigo" />
        <span className="text-[11px] font-bold text-indigo tracking-wide uppercase">When To Go</span>
      </div>
      <h1
        className="font-black text-text-primary leading-[0.95]"
        style={{ fontSize: 'clamp(2rem, 4.4vw, 3rem)', letterSpacing: '-0.045em' }}
      >
        When&rsquo;s it <span className="text-indigo">cheap</span> to fly?
      </h1>
      <p className="mt-3 text-sm text-text-muted leading-relaxed max-w-md">
        Pick a route and a window — we&rsquo;ll find the single cheapest day. Prices come live from
        Kiwi.com on every search.
      </p>

      <div className="mt-6 section-shell p-5">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,1fr] gap-2 items-end mb-4">
          <CityPicker label="From" iata={fromIata} onSelect={setFrom} onClear={clearFrom} />
          <button
            type="button"
            onClick={swap}
            disabled={!fromIata || !toIata}
            className="self-center sm:self-end w-10 h-10 rounded-full bg-surface-2 border border-border flex items-center justify-center text-text-secondary hover:text-indigo hover:border-indigo-border transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Swap origin and destination"
          >
            <ArrowLeftRight size={14} />
          </button>
          <CityPicker label="To" iata={toIata} onSelect={setTo} onClear={clearTo} />
        </div>

        <div className="pt-3 border-t border-border/60">
          <div className="text-[10px] uppercase tracking-wide text-text-muted font-bold mb-2 flex items-center gap-1.5">
            <CalendarDays size={11} /> Window
          </div>
          <WindowPicker
            preset={preset}
            start={start}
            end={end}
            onPresetChange={handlePresetChange}
            onCustomChange={handleCustomChange}
          />
        </div>

        <button
          type="button"
          onClick={runSearch}
          disabled={!canSearch}
          className={`mt-5 flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98] ${
            canSearch
              ? 'bg-indigo text-white hover:bg-indigo/90'
              : 'bg-surface-2 text-text-xmuted cursor-not-allowed border border-border'
          }`}
          style={canSearch ? { boxShadow: '0 10px 28px rgba(55,48,163,0.28)' } : undefined}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          {buttonLabel}
        </button>

        {!canSearch && (fromIata === toIata && fromIata) && (
          <p className="mt-2 text-[11px] text-rose-600 text-center">
            Origin and destination must differ.
          </p>
        )}
      </div>

      <p className="text-[11px] text-text-muted/70 mt-4">
        Prices are sampled from Kiwi.com on every search. We don&rsquo;t add markups.
      </p>
    </div>
  );

  const map = result?.cheapest?.itinerary ? (
    <SingleFlightMap
      origin={{
        iata: result.cheapest.itinerary.originIata,
        city: result.cheapest.itinerary.originCity,
        lat: result.cheapest.itinerary.originLat,
        lng: result.cheapest.itinerary.originLng,
      }}
      destination={{
        iata: result.cheapest.itinerary.destinationIata,
        city: result.cheapest.itinerary.destinationCity,
        lat: result.cheapest.itinerary.destinationLat,
        lng: result.cheapest.itinerary.destinationLng,
      }}
      via={
        result.cheapest.itinerary.viaIatas && result.cheapest.itinerary.viaCoords
          ? result.cheapest.itinerary.viaIatas.map((iata, i) => ({
              iata,
              lat: result.cheapest!.itinerary!.viaCoords![i]?.lat ?? 0,
              lng: result.cheapest!.itinerary!.viaCoords![i]?.lng ?? 0,
            }))
          : []
      }
    />
  ) : null;

  const rightPanel = (
    <div className="w-full">
      {/* Mobile-only list/map tabs — desktop stacks both vertically. */}
      {map && (
        <div className="md:hidden flex items-center gap-1 bg-surface-2 p-1 rounded-2xl mb-3 border border-border">
          <button
            type="button"
            onClick={() => setMobileView('list')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
              mobileView === 'list'
                ? 'bg-white text-indigo shadow-sm'
                : 'text-text-muted'
            }`}
          >
            <ListIcon size={12} /> Details
          </button>
          <button
            type="button"
            onClick={() => setMobileView('map')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
              mobileView === 'map'
                ? 'bg-white text-indigo shadow-sm'
                : 'text-text-muted'
            }`}
          >
            <MapIcon size={12} /> Map
          </button>
        </div>
      )}

      <div className={map ? (mobileView === 'map' ? 'hidden md:block' : 'block') : 'block'}>
        <ResultCard
          loading={loading}
          error={error}
          result={result}
          origin={fromIata}
          destination={toIata}
          onCtaClick={handleCtaClick}
          onPickDay={pickDay}
        />
      </div>

      {map && (
        <div className={`mt-4 ${mobileView === 'list' ? 'hidden md:block' : 'block'}`}>
          {map}
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
      )}
    </div>
  );

  return (
    <MarketingShell
      active="tools"
      title="When To Go"
      description="Pick a departure city, an arrival city, and a flexible window — FlexBook will show you the single cheapest day to fly."
      onMenuOpen={() => navigate('/tools')}
      left={leftPanel}
      right={rightPanel}
    />
  );
}
