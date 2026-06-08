import { useEffect, useMemo, useRef } from 'react';
import { FlightOption, RoundTripOption, MultiCityOption } from '@fast-travel/shared';
import { durationLabel } from '../utils/date.utils';
import { formatPrice } from '../utils/price.utils';

export type StopsBucket = 'direct' | '1stop' | '2plus';
export type DepartureBucket = 'morning' | 'afternoon' | 'evening';

export interface FlightFilterState {
  stops: Set<StopsBucket>;
  maxPrice: number;
  maxDurationMinutes: number;
  departure: Set<DepartureBucket>;
}

export interface FilterBounds {
  minPrice: number;
  maxPrice: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  availableStops: Set<StopsBucket>;
}

export function computeBounds(flights: FlightOption[]): FilterBounds {
  if (flights.length === 0) {
    return {
      minPrice: 0,
      maxPrice: 0,
      minDurationMinutes: 0,
      maxDurationMinutes: 0,
      availableStops: new Set(),
    };
  }
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let minDur = Infinity;
  let maxDur = -Infinity;
  const availableStops = new Set<StopsBucket>();
  for (const f of flights) {
    if (f.priceUsd < minPrice) minPrice = f.priceUsd;
    if (f.priceUsd > maxPrice) maxPrice = f.priceUsd;
    if (f.durationMinutes < minDur) minDur = f.durationMinutes;
    if (f.durationMinutes > maxDur) maxDur = f.durationMinutes;
    availableStops.add(stopsBucketOf(f.stops));
  }
  return {
    minPrice: Math.floor(minPrice),
    maxPrice: Math.ceil(maxPrice),
    minDurationMinutes: minDur,
    maxDurationMinutes: maxDur,
    availableStops,
  };
}

export function stopsBucketOf(stops: number): StopsBucket {
  if (stops === 0) return 'direct';
  if (stops === 1) return '1stop';
  return '2plus';
}

export function departureBucketOf(iso: string): DepartureBucket {
  const hour = new Date(iso).getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

export function applyFilters(
  flights: FlightOption[],
  filters: FlightFilterState,
): FlightOption[] {
  return flights.filter((f) => {
    if (filters.stops.size > 0 && !filters.stops.has(stopsBucketOf(f.stops))) return false;
    if (f.priceUsd > filters.maxPrice) return false;
    if (f.durationMinutes > filters.maxDurationMinutes) return false;
    if (filters.departure.size > 0 && !filters.departure.has(departureBucketOf(f.departureDatetime))) {
      return false;
    }
    return true;
  });
}

/* ── Round-trip variants ─────────────────────────────────────────────────
   Treat the pair as one item: combined price, MAX leg duration (worst single
   leg), departure bucket from the outbound flight, and the stops filter
   passes only when BOTH legs are in the selected buckets. Same FilterState. */

function maxLegDuration(legs: FlightOption[]): number {
  return legs.reduce((m, l) => Math.max(m, l.durationMinutes), 0);
}

export function computeRoundTripBounds(pairs: RoundTripOption[]): FilterBounds {
  if (pairs.length === 0) {
    return {
      minPrice: 0,
      maxPrice: 0,
      minDurationMinutes: 0,
      maxDurationMinutes: 0,
      availableStops: new Set(),
    };
  }
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let minDur = Infinity;
  let maxDur = -Infinity;
  const availableStops = new Set<StopsBucket>();
  for (const p of pairs) {
    if (p.priceUsd < minPrice) minPrice = p.priceUsd;
    if (p.priceUsd > maxPrice) maxPrice = p.priceUsd;
    const worstLeg = maxLegDuration([p.outbound, p.inbound]);
    if (worstLeg < minDur) minDur = worstLeg;
    if (worstLeg > maxDur) maxDur = worstLeg;
    availableStops.add(stopsBucketOf(p.outbound.stops));
    availableStops.add(stopsBucketOf(p.inbound.stops));
  }
  return {
    minPrice: Math.floor(minPrice),
    maxPrice: Math.ceil(maxPrice),
    minDurationMinutes: minDur,
    maxDurationMinutes: maxDur,
    availableStops,
  };
}

export function applyRoundTripFilters(
  pairs: RoundTripOption[],
  filters: FlightFilterState,
): RoundTripOption[] {
  return pairs.filter((p) => {
    if (filters.stops.size > 0) {
      const outBucket = stopsBucketOf(p.outbound.stops);
      const inBucket = stopsBucketOf(p.inbound.stops);
      if (!filters.stops.has(outBucket) || !filters.stops.has(inBucket)) return false;
    }
    if (p.priceUsd > filters.maxPrice) return false;
    if (maxLegDuration([p.outbound, p.inbound]) > filters.maxDurationMinutes) return false;
    if (
      filters.departure.size > 0 &&
      !filters.departure.has(departureBucketOf(p.outbound.departureDatetime))
    ) {
      return false;
    }
    return true;
  });
}

/* ── Multi-city variants ─────────────────────────────────────────────────
   Like round-trip but for N legs. Departure bucket = first leg. Stops filter
   passes only when EVERY leg sits in a selected bucket. */

export function computeMultiCityBounds(trips: MultiCityOption[]): FilterBounds {
  if (trips.length === 0) {
    return {
      minPrice: 0,
      maxPrice: 0,
      minDurationMinutes: 0,
      maxDurationMinutes: 0,
      availableStops: new Set(),
    };
  }
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let minDur = Infinity;
  let maxDur = -Infinity;
  const availableStops = new Set<StopsBucket>();
  for (const t of trips) {
    if (t.priceUsd < minPrice) minPrice = t.priceUsd;
    if (t.priceUsd > maxPrice) maxPrice = t.priceUsd;
    const worstLeg = maxLegDuration(t.legs);
    if (worstLeg < minDur) minDur = worstLeg;
    if (worstLeg > maxDur) maxDur = worstLeg;
    for (const l of t.legs) availableStops.add(stopsBucketOf(l.stops));
  }
  return {
    minPrice: Math.floor(minPrice),
    maxPrice: Math.ceil(maxPrice),
    minDurationMinutes: minDur,
    maxDurationMinutes: maxDur,
    availableStops,
  };
}

export function applyMultiCityFilters(
  trips: MultiCityOption[],
  filters: FlightFilterState,
): MultiCityOption[] {
  return trips.filter((t) => {
    if (filters.stops.size > 0) {
      const ok = t.legs.every((l) => filters.stops.has(stopsBucketOf(l.stops)));
      if (!ok) return false;
    }
    if (t.priceUsd > filters.maxPrice) return false;
    if (maxLegDuration(t.legs) > filters.maxDurationMinutes) return false;
    if (
      filters.departure.size > 0 &&
      t.legs[0] &&
      !filters.departure.has(departureBucketOf(t.legs[0].departureDatetime))
    ) {
      return false;
    }
    return true;
  });
}

export function defaultFilters(bounds: FilterBounds): FlightFilterState {
  return {
    stops: new Set(),
    maxPrice: bounds.maxPrice,
    maxDurationMinutes: bounds.maxDurationMinutes,
    departure: new Set(),
  };
}

const STOP_OPTIONS: { value: StopsBucket; label: string }[] = [
  { value: 'direct', label: 'Direct' },
  { value: '1stop', label: '1 stop' },
  { value: '2plus', label: '2+ stops' },
];

const DEPARTURE_OPTIONS: { value: DepartureBucket; label: string }[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
];

interface Props {
  bounds: FilterBounds;
  value: FlightFilterState;
  onChange: (next: FlightFilterState) => void;
}

export function FlightFilters({ bounds, value, onChange }: Props) {
  // Whenever the flight set updates, snap the slider ceilings up to the new
  // bounds. We widen if (a) the user's value matches the previous ceiling
  // (so they hadn't manually narrowed) OR (b) the value is still at the
  // "no data yet" default of 0 — the latter happens when the parent
  // initialized filters during loading, before any flights arrived.
  const lastBoundsRef = useRef(bounds);
  useEffect(() => {
    const prev = lastBoundsRef.current;
    lastBoundsRef.current = bounds;
    const patch: Partial<FlightFilterState> = {};
    if (
      (value.maxPrice === prev.maxPrice || value.maxPrice === 0) &&
      bounds.maxPrice !== value.maxPrice
    ) {
      patch.maxPrice = bounds.maxPrice;
    }
    if (
      (value.maxDurationMinutes === prev.maxDurationMinutes || value.maxDurationMinutes === 0) &&
      bounds.maxDurationMinutes !== value.maxDurationMinutes
    ) {
      patch.maxDurationMinutes = bounds.maxDurationMinutes;
    }
    if (Object.keys(patch).length > 0) {
      onChange({ ...value, ...patch });
    }
  }, [bounds, value, onChange]);

  function toggle<T>(set: Set<T>, item: T): Set<T> {
    const next = new Set(set);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    return next;
  }

  const priceMin = bounds.minPrice;
  const priceMax = Math.max(bounds.maxPrice, priceMin + 1);
  const durMin = bounds.minDurationMinutes;
  const durMax = Math.max(bounds.maxDurationMinutes, durMin + 1);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm font-bold text-text-primary mb-3">Stops</p>
        <div className="flex flex-wrap gap-2">
          {STOP_OPTIONS.map((opt) => {
            const active = value.stops.has(opt.value);
            const available = bounds.availableStops.has(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                disabled={!available}
                onClick={() => onChange({ ...value, stops: toggle(value.stops, opt.value) })}
                className={
                  'px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ' +
                  (active
                    ? 'bg-indigo text-white border-indigo'
                    : available
                    ? 'bg-surface text-text-secondary border-border hover:border-indigo-border hover:text-text-primary'
                    : 'bg-surface-2 text-text-xmuted border-border cursor-not-allowed')
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          <p className="text-sm font-bold text-text-primary mb-2">Max price</p>
          <RangeSlider
            min={priceMin}
            max={priceMax}
            value={Math.max(priceMin, Math.min(value.maxPrice, priceMax))}
            onChange={(v) => onChange({ ...value, maxPrice: v })}
          />
          <div className="flex items-center justify-between mt-1.5 text-[11px]">
            <span className="text-text-muted">{formatPrice(priceMin)}</span>
            <span className="font-mono font-bold text-orange">{formatPrice(value.maxPrice)}</span>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-sm font-bold text-text-primary mb-2">Max trip duration</p>
          <RangeSlider
            min={durMin}
            max={durMax}
            value={Math.max(durMin, Math.min(value.maxDurationMinutes, durMax))}
            onChange={(v) => onChange({ ...value, maxDurationMinutes: v })}
          />
          <div className="flex items-center justify-between mt-1.5 text-[11px]">
            <span className="text-text-muted">{durationLabel(durMin)}</span>
            <span className="font-mono font-bold text-orange">
              {durationLabel(value.maxDurationMinutes)}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm font-bold text-text-primary mb-3">Departure</p>
        <div className="flex flex-wrap gap-2">
          {DEPARTURE_OPTIONS.map((opt) => {
            const active = value.departure.has(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ ...value, departure: toggle(value.departure, opt.value) })}
                className={
                  'px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ' +
                  (active
                    ? 'bg-indigo text-white border-indigo'
                    : 'bg-surface text-text-secondary border-border hover:border-indigo-border hover:text-text-primary')
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RangeSlider({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const pct = useMemo(() => {
    if (max === min) return 100;
    return Math.round(((value - min) / (max - min)) * 100);
  }, [min, max, value]);

  return (
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="flexbook-range w-full h-1.5 rounded-full appearance-none cursor-pointer"
      style={{
        background: `linear-gradient(to right, rgb(249 115 22) 0%, rgb(249 115 22) ${pct}%, rgb(226 232 240) ${pct}%, rgb(226 232 240) 100%)`,
      }}
    />
  );
}
