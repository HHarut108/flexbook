import { useRef, useState } from 'react';
import axios from 'axios';
import { LocationSelection, selectionLabel, selectionToMarker } from '@fast-travel/shared';
import { format, addDays, addMonths, endOfMonth, startOfMonth } from 'date-fns';
import { ArrowRight, CalendarDays, ExternalLink, Loader2, PlaneTakeoff, TrendingDown } from 'lucide-react';
import { MarketingShellV2 } from '../components/MarketingShellV2';
import { AirportSearchInput } from '../components/AirportSearchInput';
import { TripMapColumn } from '../components/TripMapColumn';
import { V2ToolHero } from '../components/V2ToolHero';
import { MobileViewToggle, type MobileView } from '../components/MobileViewToggle';
import { DateRangePicker } from '../components/DateRangePicker';
import { formatYMD } from '../utils/date.utils';
import { fetchCheapestDay, CheapestDayResponse, CalendarDay } from '../api/whenToGo.api';
import { track, AnalyticsEvent } from '../lib/analytics';

interface Props {
  onMenuOpen?: () => void;
}

type RangePresetId = 'this-month' | 'next-month' | 'next-90' | 'custom';

interface DateRange {
  id: RangePresetId;
  label: string;
  start: string;
  end: string;
}

function buildPresetRange(id: Exclude<RangePresetId, 'custom'>): DateRange {
  const today = new Date();
  if (id === 'this-month') {
    return {
      id,
      label: 'This month',
      start: formatYMD(today),
      end: formatYMD(endOfMonth(today)),
    };
  }
  if (id === 'next-month') {
    const next = addMonths(today, 1);
    return {
      id,
      label: 'Next month',
      start: formatYMD(startOfMonth(next)),
      end: formatYMD(endOfMonth(next)),
    };
  }
  return {
    id,
    label: 'Next 90 days',
    start: formatYMD(today),
    end: formatYMD(addDays(today, 90)),
  };
}

const PRESETS = [
  buildPresetRange('this-month'),
  buildPresetRange('next-month'),
  buildPresetRange('next-90'),
];

function fmtRange(start: string, end: string): string {
  try {
    const s = format(new Date(start + 'T12:00:00'), 'MMM d');
    const e = format(new Date(end + 'T12:00:00'), 'MMM d');
    return `${s} – ${e}`;
  } catch {
    return `${start} – ${end}`;
  }
}

const FMT_DATE_LONG = (iso: string) => format(new Date(iso + 'T12:00:00'), 'EEE, MMM d, yyyy');
const FMT_DATE_TINY = (iso: string) => format(new Date(iso + 'T12:00:00'), 'MMM d');

function fmtTime(iso: string): string {
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

export function WhenToGoScreenV2({ onMenuOpen }: Props) {
  const [destQuery, setDestQuery] = useState('');
  const [destination, setDestination] = useState<LocationSelection | null>(null);
  const [origin, setOrigin] = useState<LocationSelection | null>(null);
  const [originQuery, setOriginQuery] = useState('');
  const [range, setRange] = useState<DateRange>(PRESETS[2]); // default: Next 90 days
  const [customStart, setCustomStart] = useState(formatYMD(new Date()));
  const [customEnd, setCustomEnd] = useState(formatYMD(addDays(new Date(), 30)));
  const [mobileView, setMobileView] = useState<MobileView>('list');
  const [result, setResult] = useState<CheapestDayResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function selectPreset(p: DateRange) {
    setRange(p);
  }

  function selectCustom() {
    setRange({
      id: 'custom',
      label: 'Custom range',
      start: customStart,
      end: customEnd,
    });
  }

  async function handleSearch() {
    if (!origin || !destination) return;
    const originMarker = selectionToMarker(origin);
    const destMarker = selectionToMarker(destination);
    if (originMarker === destMarker) {
      setError('Origin and destination must differ.');
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    track(AnalyticsEvent.WhenToGoSearch, {
      from: originMarker,
      to: destMarker,
      start: range.start,
      end: range.end,
      preset: range.id,
    });
    try {
      const res = await fetchCheapestDay(originMarker, destMarker, range.start, range.end, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setResult(res);
    } catch (err: unknown) {
      if (axios.isCancel(err)) return;
      const message = err instanceof Error ? err.message : 'Something went wrong fetching the calendar.';
      setError(message);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  function handleCtaClick() {
    track(AnalyticsEvent.WhenToGoCtaClick, {
      from: origin ? selectionToMarker(origin) : '',
      to: destination ? selectionToMarker(destination) : '',
      date: result?.cheapest?.date,
      priceUsd: result?.cheapest?.priceUsd,
    });
  }

  function pickDay(day: CalendarDay) {
    if (!result) return;
    setResult({ ...result, cheapest: day });
  }

  return (
    <MarketingShellV2
      active="when"
      title="When to Go"
      description="Find the cheapest day to fly between any two cities."
      onMenuOpen={onMenuOpen}
    >
      <section className="max-w-6xl xl:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 pt-6 md:pt-14 pb-10">
        {/* Two-column on lg+: [hero + map] left, form right */}
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 lg:gap-10">
          {/* LEFT: hero + (mobile toggle) + map */}
          <div>
            <V2ToolHero
              toolName="When to Go"
              titleLine1="Find the cheapest"
              titleAccent="time"
              subhead="Pick where you want to go — we'll surface the single cheapest day to fly. Change anything and the answer updates live."
            />

            <div className="md:hidden mb-5">
              <MobileViewToggle value={mobileView} onChange={setMobileView} />
            </div>

            <div className={`${mobileView === 'map' ? '' : 'hidden'} md:block`}>
              <TripMapColumn
                origin={origin}
                destination={destination}
              />
            </div>
          </div>

          {/* RIGHT: form card */}
          <div
            className={`bg-surface rounded-[24px] border border-border/60 p-5 md:p-6 ${mobileView === 'list' ? '' : 'hidden'} md:block`}
            style={{ boxShadow: '0 20px 50px -20px rgba(15,23,42,0.18)' }}
          >
            <FieldLabel>From</FieldLabel>
            <div className="mb-4">
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
                placeholder="Origin city or airport"
                ariaLabel="Origin"
              />
            </div>

            <FieldLabel>I want to go to</FieldLabel>
            <div className="mb-6">
              <AirportSearchInput
                value={destQuery}
                onChange={(v) => {
                  setDestQuery(v);
                  if (destination) setDestination(null);
                }}
                onSelect={(s) => {
                  setDestination(s);
                  setDestQuery(selectionLabel(s));
                }}
                placeholder="Destination city or airport"
                ariaLabel="Destination"
              />
            </div>

            <FieldLabel>Date range</FieldLabel>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPreset(p)}
                  className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-all border ${
                    range.id === p.id
                      ? 'bg-text-primary text-bg border-text-primary'
                      : 'bg-surface text-text-secondary border-border hover:bg-surface-2 hover:text-text-primary'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={selectCustom}
                className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-all border ${
                  range.id === 'custom'
                    ? 'bg-text-primary text-bg border-text-primary'
                    : 'bg-surface text-text-secondary border-border hover:bg-surface-2 hover:text-text-primary'
                }`}
              >
                Custom range
              </button>
            </div>

            {range.id === 'custom' ? (
              <div className="mb-5">
                <DateRangePicker
                  dateFrom={customStart}
                  dateTo={customEnd}
                  today={formatYMD(new Date())}
                  label=""
                  fromLabel="Earliest"
                  toLabel="Latest"
                  onChangeFrom={(v) => {
                    setCustomStart(v);
                    setRange((r) => ({ ...r, start: v }));
                  }}
                  onChangeTo={(v) => {
                    setCustomEnd(v);
                    setRange((r) => ({ ...r, end: v }));
                  }}
                />
              </div>
            ) : (
              <p className="text-[11px] text-text-muted mb-5 px-1">
                Searching {fmtRange(range.start, range.end)}
              </p>
            )}

            <button
              type="button"
              onClick={handleSearch}
              disabled={!origin || !destination || loading}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-full bg-orange text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-orange-dark transition-all"
              style={{ boxShadow: '0 14px 32px -10px rgba(249,115,22,0.5)' }}
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Searching…
                </>
              ) : (
                <>
                  Find cheapest dates
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>

        </div>

        {/* Result / empty state */}
        <div className="mt-10">
          <ResultBlock
            loading={loading}
            error={error}
            result={result}
            hasInputs={!!origin && !!destination}
            onCtaClick={handleCtaClick}
            onPickDay={pickDay}
          />
        </div>
      </section>
    </MarketingShellV2>
  );
}

interface ResultBlockProps {
  loading: boolean;
  error: string | null;
  result: CheapestDayResponse | null;
  hasInputs: boolean;
  onCtaClick: () => void;
  onPickDay: (day: CalendarDay) => void;
}

function ResultBlock({ loading, error, result, hasInputs, onCtaClick, onPickDay }: ResultBlockProps) {
  if (error) {
    return (
      <div className="max-w-xl mx-auto bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
        <p className="text-sm font-semibold text-red-700">Couldn&rsquo;t fetch prices</p>
        <p className="text-xs text-red-600/80 mt-1">{error}</p>
      </div>
    );
  }

  if (loading && !result) {
    return (
      <div className="max-w-xl mx-auto bg-surface border border-border/60 rounded-3xl p-6">
        <div className="h-5 w-32 bg-surface-2 rounded animate-pulse mb-3" />
        <div className="h-8 w-56 bg-surface-2 rounded animate-pulse mb-2" />
        <div className="h-12 w-32 bg-surface-2 rounded animate-pulse mb-4" />
        <div className="h-12 w-full bg-surface-2 rounded-2xl animate-pulse" />
      </div>
    );
  }

  const cheapest = result?.cheapest ?? null;
  if (result && !cheapest) {
    return (
      <div className="max-w-xl mx-auto bg-surface border border-border/60 rounded-3xl p-6 text-center">
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
    return (
      <div className="flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-2xl bg-surface border border-border/60 flex items-center justify-center mb-3">
          <CalendarDays size={20} className="text-text-muted" />
        </div>
        <p className="text-sm text-text-muted">
          {hasInputs
            ? 'Hit Find cheapest dates — we’ll fetch live prices.'
            : 'Pick an origin and destination to find the cheapest day.'}
        </p>
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
    <div className="max-w-xl mx-auto bg-surface border border-border/60 rounded-3xl p-6 relative overflow-hidden">
      {loading && (
        <div className="absolute inset-0 bg-white/55 backdrop-blur-[1px] z-10 flex items-start justify-center pt-6">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-border shadow-sm text-xs text-text-secondary">
            <Loader2 size={13} className="animate-spin text-indigo" />
            Refreshing…
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 mb-3">
        <TrendingDown size={14} className="text-emerald" />
        <span className="text-xs font-bold text-emerald uppercase tracking-wide">
          Cheapest day
        </span>
        {it?.airlineName && (
          <span className="ml-auto text-[11px] font-semibold text-text-muted">
            {it.airlineName}
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

      {it && (
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
              <div className="text-base font-bold text-text-primary">{fmtTime(it.arrivalDatetime)}</div>
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
      )}

      {cheapest.bookingUrl && (
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
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
      {children}
    </div>
  );
}

// DateField removed — custom range now uses the shared DateRangePicker
// (same single-month calendar Budget Planner uses).
