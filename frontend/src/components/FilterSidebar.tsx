import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarSearch, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { addDays, parseISO } from 'date-fns';
import { FlightFilters, type FilterBounds, type FlightFilterState } from './FlightFilters';
import { formatYMD } from '../utils/date.utils';

interface Props {
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

export function FilterSidebar({
  bounds,
  value,
  onChange,
  fromMarker,
  toMarker,
  fromCity,
  toCity,
  centerDate,
}: Props) {
  // Mobile collapse: closed by default. Desktop ignores this — `lg:block`
  // overrides the hidden state.
  const [mobileOpen, setMobileOpen] = useState(false);
  const window = whenToFlyWindow(centerDate);
  const whenToGoHref =
    `/when-to-go?from=${encodeURIComponent(fromMarker)}` +
    `&to=${encodeURIComponent(toMarker)}` +
    `&start=${window.start}&end=${window.end}`;

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      {/* Mobile toggle — collapses everything below by default. On lg+ we
          hide this button and always show the content. */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        aria-expanded={mobileOpen}
        aria-controls="filter-sidebar-body"
        className="lg:hidden w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl border border-border bg-surface text-sm font-semibold text-text-primary mb-3"
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
        className={`space-y-4 ${mobileOpen ? '' : 'hidden'} lg:block`}
      >
        <FlightFilters bounds={bounds} value={value} onChange={onChange} />

        {fromMarker && toMarker && (
          <Link
            to={whenToGoHref}
            className="block group rounded-2xl border border-indigo-border bg-gradient-to-br from-indigo-soft to-surface p-4 transition-shadow hover:shadow-[0_12px_28px_-12px_rgba(79,70,229,0.35)]"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-mid text-white flex items-center justify-center shrink-0">
                <CalendarSearch size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider font-bold text-indigo-mid">
                  Flexible on dates?
                </p>
                <p className="text-sm font-bold text-text-primary leading-tight mt-0.5">
                  Find the cheapest day to fly
                </p>
                <p className="text-[11px] text-text-muted mt-1 truncate">
                  {fromCity} → {toCity} · ±{WHEN_TO_FLY_WINDOW_DAYS} days
                </p>
              </div>
            </div>
          </Link>
        )}
      </div>
    </aside>
  );
}
