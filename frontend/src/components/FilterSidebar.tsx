import { useState } from 'react';
import { ChevronDown, ExternalLink, Sparkles, SlidersHorizontal } from 'lucide-react';
import { addDays, parseISO } from 'date-fns';
import { FlightFilters, type FilterBounds, type FlightFilterState } from './FlightFilters';
import { formatYMD } from '../utils/date.utils';

interface SidebarProps {
  bounds: FilterBounds;
  value: FlightFilterState;
  onChange: (next: FlightFilterState) => void;
  /** Trip endpoints used by the "When to fly" CTA. Markers are URL-safe
   *  identifiers ("EVN" or "@rome_it") — pass them straight through. Names
   *  feed the visible CTA label ("from {fromCity} to {toCity}"). */
  fromMarker: string;
  toMarker: string;
  fromCity: string;
  toCity: string;
  /** Anchor date for the ±4-day When-to-fly window. For round-trip / multi
   *  callers should pass the OUTBOUND departure date so the window stays
   *  meaningful. */
  centerDate: string;
}

const WHEN_TO_FLY_WINDOW_DAYS = 4;

/** Compute the ±4-day window around `centerDate`. Clamps the start to today
 *  so we never propose a search starting in the past. */
function whenToFlyWindow(centerDate: string): { start: string; end: string } {
  const today = formatYMD(new Date());
  let start: string;
  let end: string;
  try {
    const center = parseISO(centerDate);
    start = formatYMD(addDays(center, -WHEN_TO_FLY_WINDOW_DAYS));
    end = formatYMD(addDays(center, WHEN_TO_FLY_WINDOW_DAYS));
  } catch {
    start = today;
    end = formatYMD(addDays(new Date(), 2 * WHEN_TO_FLY_WINDOW_DAYS));
  }
  if (start < today) start = today;
  if (end < start) end = start;
  return { start, end };
}

function buildHref(fromMarker: string, toMarker: string, centerDate: string): string {
  const w = whenToFlyWindow(centerDate);
  return (
    `/when-to-go?from=${encodeURIComponent(fromMarker)}` +
    `&to=${encodeURIComponent(toMarker)}` +
    `&start=${w.start}&end=${w.end}`
  );
}

/**
 * Full Saver Tip card — used in the desktop sticky sidebar where there's
 * room to read it.
 */
export function SaverTipCard({
  fromMarker,
  toMarker,
  fromCity,
  toCity,
  centerDate,
}: {
  fromMarker: string;
  toMarker: string;
  fromCity: string;
  toCity: string;
  centerDate: string;
}) {
  if (!fromMarker || !toMarker) return null;
  const href = buildHref(fromMarker, toMarker, centerDate);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block group rounded-2xl border border-orange/30 p-4 transition-all hover:border-orange/60 hover:shadow-[0_14px_30px_-14px_rgba(249,115,22,0.45)] hover:-translate-y-0.5"
      style={{ background: 'linear-gradient(135deg, #FFF7ED 0%, #FFFBF5 55%, #FFFFFF 100%)' }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-2xl text-white flex items-center justify-center shrink-0 text-lg leading-none"
          style={{
            background: 'linear-gradient(135deg, #F97316 0%, #EA6C0A 100%)',
            boxShadow: '0 8px 18px -8px rgba(249,115,22,0.55)',
          }}
          aria-hidden
        >
          ✨
        </div>
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-orange-dark">
            <Sparkles size={10} /> Saver tip
          </p>
          <p className="text-sm font-bold text-text-primary leading-snug mt-0.5">
            Could you save by flying a different day?
          </p>
          <p className="text-[11px] text-text-muted mt-1 leading-snug">
            Peek the cheapest day{' '}
            <span className="font-semibold text-text-secondary">{fromCity}</span>
            {' → '}
            <span className="font-semibold text-text-secondary">{toCity}</span>{' '}
            within ±{WHEN_TO_FLY_WINDOW_DAYS} days
          </p>
          <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-orange-dark">
            Open When-to-Go
            <ExternalLink size={11} />
          </p>
        </div>
      </div>
    </a>
  );
}

/**
 * Slim single-line CTA — used pinned above the results list on mobile so it
 * stays visible whether or not the user has tapped Filters. Wraps to two
 * rows if the city names are long; otherwise everything sits on one line.
 */
export function SaverTipPill({
  fromMarker,
  toMarker,
  fromCity,
  toCity,
  centerDate,
}: {
  fromMarker: string;
  toMarker: string;
  fromCity: string;
  toCity: string;
  centerDate: string;
}) {
  if (!fromMarker || !toMarker) return null;
  const href = buildHref(fromMarker, toMarker, centerDate);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 rounded-xl border border-orange/30 px-3 py-2 transition-all hover:border-orange/60 hover:shadow-[0_8px_18px_-10px_rgba(249,115,22,0.45)] active:scale-[0.99]"
      style={{ background: 'linear-gradient(135deg, #FFF7ED 0%, #FFFBF5 100%)' }}
    >
      <span
        className="w-7 h-7 rounded-lg text-white flex items-center justify-center shrink-0 text-sm leading-none"
        style={{
          background: 'linear-gradient(135deg, #F97316 0%, #EA6C0A 100%)',
          boxShadow: '0 4px 10px -4px rgba(249,115,22,0.5)',
        }}
        aria-hidden
      >
        ✨
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold text-text-primary leading-tight truncate">
          Cheapest day to fly {fromCity} → {toCity}?
        </p>
        <p className="text-[10px] text-text-muted leading-tight mt-0.5 truncate">
          See ±{WHEN_TO_FLY_WINDOW_DAYS} days · opens in a new tab
        </p>
      </div>
      <ExternalLink size={13} className="text-orange-dark shrink-0" />
    </a>
  );
}

/**
 * Desktop: sticky stack [filters card → Saver tip card].
 * Mobile: only the Filters toggle (closed by default). The slim Saver tip
 * lives above the results — render <SaverTipPill> there.
 */
export function FilterSidebar({
  bounds,
  value,
  onChange,
  fromMarker,
  toMarker,
  fromCity,
  toCity,
  centerDate,
}: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      {/* Mobile toggle — collapses the filter panel by default. On lg+ we
          hide the toggle and always show the body below. */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        aria-expanded={mobileOpen}
        aria-controls="filter-sidebar-body"
        className="lg:hidden w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl border border-border bg-surface text-sm font-semibold text-text-primary"
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-indigo-mid" />
          Filters
        </span>
        <ChevronDown
          size={16}
          className={`text-text-muted transition-transform ${mobileOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        id="filter-sidebar-body"
        className={`space-y-4 mt-3 lg:mt-0 ${mobileOpen ? '' : 'hidden'} lg:block`}
      >
        <FlightFilters bounds={bounds} value={value} onChange={onChange} />
        {/* Desktop-only: full Saver tip card. Mobile renders a slim pinned
            <SaverTipPill> above the results so it's always visible. */}
        <div className="hidden lg:block">
          <SaverTipCard
            fromMarker={fromMarker}
            toMarker={toMarker}
            fromCity={fromCity}
            toCity={toCity}
            centerDate={centerDate}
          />
        </div>
      </div>
    </aside>
  );
}
