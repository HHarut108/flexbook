import { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Airport } from '@fast-travel/shared';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  CalendarDays,
  ExternalLink,
  Loader2,
  MapPin,
  Plane,
  Search,
  Sparkles,
  TrendingDown,
  X,
} from 'lucide-react';
import { format, addDays, addMonths, endOfMonth, startOfMonth } from 'date-fns';
import { useAirportSearch } from '../hooks/useAirportSearch';
import { fetchCheapestDay, CheapestDayResponse } from '../api/whenToGo.api';
import { track, AnalyticsEvent } from '../lib/analytics';

/* ────────────────────────────────────────────────────────────────────────────
   When To Go — pick origin, destination, and a window. We auto-search whenever
   all three are committed and return the cheapest single day in that window.
   Result card morphs in place; URL params (?from, ?to, ?start, ?end) keep
   state shareable and reload-safe without touching the trip/session stores.
   ──────────────────────────────────────────────────────────────────────────── */

const TODAY = () => format(new Date(), 'yyyy-MM-dd');
const FMT_DATE_LONG = (iso: string) => format(new Date(iso + 'T12:00:00'), 'EEE, MMM d, yyyy');
const FMT_DATE_TINY = (iso: string) => format(new Date(iso + 'T12:00:00'), 'MMM d');

type Preset = 'this-month' | 'next-month' | 'next-90' | 'custom';

function computePresetWindow(preset: Preset): { start: string; end: string } {
  const today = new Date();
  switch (preset) {
    case 'this-month':
      return {
        start: format(today, 'yyyy-MM-dd'),
        end: format(endOfMonth(today), 'yyyy-MM-dd'),
      };
    case 'next-month': {
      const nextMonthStart = startOfMonth(addMonths(today, 1));
      return {
        start: format(nextMonthStart, 'yyyy-MM-dd'),
        end: format(endOfMonth(nextMonthStart), 'yyyy-MM-dd'),
      };
    }
    case 'next-90':
      return {
        start: format(today, 'yyyy-MM-dd'),
        end: format(addDays(today, 90), 'yyyy-MM-dd'),
      };
    case 'custom':
      // Caller keeps existing range.
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
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="w-6 h-6 rounded-full bg-surface-2 border border-border flex items-center justify-center text-text-muted hover:text-text-primary"
              aria-label={`Clear ${label}`}
            >
              <X size={11} />
            </button>
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

      {/* Absolute dropdown — overlay, no layout shift (matches Home pattern) */}
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

/* ── Window picker ────────────────────────────────────────────────────────── */

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
    <div className="space-y-2.5">
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

      {preset === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="input-field flex items-center gap-2 px-3 rounded-2xl" style={{ height: '44px' }}>
            <CalendarDays size={14} className="text-text-xmuted shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[9px] uppercase tracking-wide text-text-muted font-bold">From</div>
              <div className="text-xs font-semibold text-text-primary truncate">
                {start ? FMT_DATE_TINY(start) : '—'}
              </div>
            </div>
            <input
              type="date"
              value={start}
              min={TODAY()}
              onChange={(e) => e.target.value && onCustomChange(e.target.value, end)}
              className="absolute inset-0 opacity-0 cursor-pointer"
              aria-label="Window start"
            />
          </label>
          <label className="input-field flex items-center gap-2 px-3 rounded-2xl" style={{ height: '44px' }}>
            <CalendarDays size={14} className="text-text-xmuted shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[9px] uppercase tracking-wide text-text-muted font-bold">To</div>
              <div className="text-xs font-semibold text-text-primary truncate">
                {end ? FMT_DATE_TINY(end) : '—'}
              </div>
            </div>
            <input
              type="date"
              value={end}
              min={start || TODAY()}
              onChange={(e) => e.target.value && onCustomChange(start, e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
              aria-label="Window end"
            />
          </label>
        </div>
      )}

      {preset !== 'custom' && start && end && (
        <div className="text-xs text-text-muted px-1">
          Searching <span className="font-semibold text-text-secondary">{FMT_DATE_TINY(start)}</span>
          {' → '}
          <span className="font-semibold text-text-secondary">{FMT_DATE_TINY(end)}</span>
        </div>
      )}
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
}

function ResultCard({ loading, error, result, origin, destination, onCtaClick }: ResultCardProps) {
  // Empty state — no input yet
  if (!origin || !destination) {
    return (
      <div className="section-shell p-8 text-center">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-indigo-soft border border-indigo-border items-center justify-center mb-4">
          <Sparkles size={22} className="text-indigo" />
        </div>
        <h3 className="text-lg font-bold text-text-primary mb-1.5">Pick a route to start</h3>
        <p className="text-sm text-text-muted max-w-sm mx-auto">
          Choose where you&rsquo;re flying from, where you&rsquo;d like to land, and how flexible you can be —
          we&rsquo;ll show you the single cheapest day in that window.
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

  const cheapest = result?.cheapest ?? null;
  const noFlights = result && !cheapest;

  if (noFlights) {
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

  return (
    <div className="section-shell relative overflow-hidden">
      {loading && (
        <div className="absolute inset-0 bg-white/55 backdrop-blur-[1px] z-10 flex items-start justify-center pt-6">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-border shadow-sm text-xs text-text-secondary">
            <Loader2 size={13} className="animate-spin text-indigo" />
            Finding the cheapest day…
          </div>
        </div>
      )}

      <div className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown size={14} className="text-emerald" />
          <span className="text-xs font-bold text-emerald uppercase tracking-wide">
            Cheapest day {result && result.cacheStatus === 'hit' ? '· cached' : ''}
          </span>
        </div>

        {cheapest ? (
          <>
            <div className="flex items-baseline gap-3 flex-wrap mb-1">
              <div className="text-2xl font-black text-text-primary tracking-tight">
                {FMT_DATE_LONG(cheapest.date)}
              </div>
            </div>
            <div className="text-4xl font-black text-indigo tracking-tight mb-4">
              ${Math.round(cheapest.priceUsd)}
              <span className="text-base font-bold text-text-muted ml-1">{cheapest.currency}</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-text-muted mb-5">
              <span className="font-semibold text-text-secondary">{origin}</span>
              <ArrowRight size={11} />
              <span className="font-semibold text-text-secondary">{destination}</span>
              <span className="mx-1">·</span>
              <span>one-way</span>
            </div>

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
            ) : (
              <Link
                to={`/?from=${origin}&date=${cheapest.date}`}
                onClick={onCtaClick}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-indigo text-white text-sm font-bold hover:bg-indigo/90 transition-all active:scale-[0.98]"
                style={{ boxShadow: '0 10px 28px rgba(55,48,163,0.28)' }}
              >
                Search this trip
                <ArrowRight size={14} />
              </Link>
            )}

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
                      <a
                        key={d.date}
                        href={d.bookingUrl ?? '#'}
                        target={d.bookingUrl ? '_blank' : undefined}
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-2 border border-border hover:border-indigo-border transition-all text-xs"
                      >
                        <span className="font-semibold text-text-primary">
                          {FMT_DATE_TINY(d.date)}
                        </span>
                        <span className="text-text-muted">${Math.round(d.priceUsd)}</span>
                      </a>
                    ))}
                </div>
              </div>
            )}
          </>
        ) : (
          // Skeleton placeholder while first fetch is in flight
          <>
            <div className="h-7 w-48 bg-surface-2 rounded-lg animate-pulse mb-2" />
            <div className="h-10 w-32 bg-surface-2 rounded-lg animate-pulse mb-4" />
            <div className="h-4 w-40 bg-surface-2 rounded-lg animate-pulse mb-5" />
            <div className="h-12 w-full bg-surface-2 rounded-2xl animate-pulse" />
          </>
        )}
      </div>
    </div>
  );
}

/* ── Main screen ──────────────────────────────────────────────────────────── */

export function WhenToGoScreen() {
  const [params, setParams] = useSearchParams();

  const fromIata = (params.get('from') ?? '').toUpperCase();
  const toIata = (params.get('to') ?? '').toUpperCase();
  const startParam = params.get('start') ?? '';
  const endParam = params.get('end') ?? '';

  // Derive a preset that matches the current window, falling back to 'next-month'.
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
  const abortRef = useRef<AbortController | null>(null);

  /* URL sync — write whenever inputs change. */
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (fromIata) next.set('from', fromIata);
    else next.delete('from');
    if (toIata) next.set('to', toIata);
    else next.delete('to');
    if (start) next.set('start', start);
    if (end) next.set('end', end);
    setParams(next, { replace: true });
    // We intentionally exclude `params` from deps — the setter is a fresh
    // reference each render. The other deps capture the meaningful change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromIata, toIata, start, end]);

  /* Auto-search whenever all four inputs are committed. */
  useEffect(() => {
    if (!fromIata || !toIata || !start || !end) return;
    if (fromIata === toIata) {
      setError('Origin and destination must differ.');
      setResult(null);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    track(AnalyticsEvent.WhenToGoSearch, {
      from: fromIata,
      to: toIata,
      start,
      end,
      preset,
    });

    fetchCheapestDay(fromIata, toIata, start, end, ctrl.signal)
      .then((res) => {
        if (ctrl.signal.aborted) return;
        setResult(res);
        setError(null);
      })
      .catch((err: unknown) => {
        if (axios.isCancel(err)) return;
        const message =
          err instanceof Error ? err.message : 'Something went wrong fetching the calendar.';
        setError(message);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });

    return () => ctrl.abort();
    // preset is included so analytics carries the latest selection but it
    // doesn't independently trigger a refetch since start/end change with it.
  }, [fromIata, toIata, start, end, preset]);

  /* ── Handlers ── */

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
    }
  }
  function handleCustomChange(s: string, e: string) {
    setStart(s);
    setEnd(e);
  }

  function handleCtaClick() {
    track(AnalyticsEvent.WhenToGoCtaClick, {
      from: fromIata,
      to: toIata,
      date: result?.cheapest?.date,
      priceUsd: result?.cheapest?.priceUsd,
    });
  }

  /* ── Render ── */

  return (
    <div className="min-h-screen bg-bg">
      <Helmet>
        <title>When To Go — find the cheapest day to fly | FlexBook</title>
        <meta
          name="description"
          content="Tell FlexBook your departure city, destination, and a flexible window — we'll show you the single cheapest day to fly."
        />
      </Helmet>

      <div className="max-w-2xl mx-auto px-4 pt-6 pb-12">
        <Link
          to="/tools"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary mb-5"
        >
          <ArrowLeft size={14} /> Tools
        </Link>

        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-soft border border-indigo-border mb-3">
            <Sparkles size={12} className="text-indigo" />
            <span className="text-[11px] font-bold text-indigo tracking-wide uppercase">
              When To Go
            </span>
          </div>
          <h1
            className="font-black text-text-primary leading-[0.95]"
            style={{ fontSize: 'clamp(2rem, 4.4vw, 3rem)', letterSpacing: '-0.045em' }}
          >
            When&rsquo;s it <span className="text-indigo">cheap</span> to fly?
          </h1>
          <p className="mt-3 text-sm text-text-muted leading-relaxed max-w-md">
            Pick a route and a window — we&rsquo;ll find the single cheapest day. Change anything and the
            answer updates live.
          </p>
        </div>

        <div className="section-shell p-5 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,1fr] gap-2 items-end mb-4">
            <CityPicker label="From" iata={fromIata} onSelect={setFrom} onClear={clearFrom} />
            <button
              type="button"
              onClick={swap}
              disabled={!fromIata || !toIata}
              className="self-center sm:self-end w-10 h-10 rounded-full bg-surface-2 border border-border flex items-center justify-center text-text-secondary hover:text-indigo hover:border-indigo-border transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Swap origin and destination"
              style={{ marginBottom: '0px' }}
            >
              <ArrowLeftRight size={14} />
            </button>
            <CityPicker label="To" iata={toIata} onSelect={setTo} onClear={clearTo} />
          </div>

          <div className="pt-3 border-t border-border/60">
            <div className="text-[10px] uppercase tracking-wide text-text-muted font-bold mb-2">
              Window
            </div>
            <WindowPicker
              preset={preset}
              start={start}
              end={end}
              onPresetChange={handlePresetChange}
              onCustomChange={handleCustomChange}
            />
          </div>
        </div>

        <ResultCard
          loading={loading}
          error={error}
          result={result}
          origin={fromIata}
          destination={toIata}
          onCtaClick={handleCtaClick}
        />

        <p className="text-[11px] text-text-muted/70 text-center mt-5">
          Prices are sampled from Kiwi.com and cached for 7 days. We don&rsquo;t add markups.
        </p>
      </div>
    </div>
  );
}
