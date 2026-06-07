import { useEffect, useMemo, useState } from 'react';
import { FlightOption } from '@fast-travel/shared';
import { X, Plane, AlertTriangle, Check, CalendarClock } from 'lucide-react';
import { addDays, format, parseISO, differenceInCalendarDays } from 'date-fns';
import { searchFlights } from '../api/flights.api';
import { formatPrice } from '../utils/price.utils';
import { formatDateLong } from '../utils/date.utils';

// Cap the search fan-out so an absurd stay (the schema allows up to 90 days)
// never spawns dozens of parallel /flights requests.
const MAX_WINDOW_DAYS = 14;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  fromIata: string;
  fromCity: string;
  toIata: string;
  toCity: string;
  /** ISO datetime when the user arrived at the last destination. */
  arrivalDatetime: string;
  /** YYYY-MM-DD when the user planned to leave the last destination. */
  nextDepartureDate: string;
  passengers: number;
  /** Called when the user accepts the cheapest flight; receives the FlightOption. */
  onSelect: (flight: FlightOption) => void;
  /** Optional escape hatch — when present, modal shows a "See more options"
   *  button that lets the user open the full return-flights picker instead of
   *  one-tap booking the cheapest. */
  onSeeMoreOptions?: () => void;
}

function buildDateWindow(arrivalDatetime: string, nextDepartureDate: string): string[] {
  // Spec: window starts the day after arrival, ends 5 days after the planned
  // stay finishes. Covers the planned stay plus a 5-day flex tail.
  const start = addDays(parseISO(arrivalDatetime.slice(0, 10)), 1);
  const end = addDays(parseISO(nextDepartureDate), 5);
  const out: string[] = [];
  let cursor = start;
  while (cursor <= end && out.length < MAX_WINDOW_DAYS) {
    out.push(format(cursor, 'yyyy-MM-dd'));
    cursor = addDays(cursor, 1);
  }
  return out;
}

export function WhenToFlyHomeModal({
  isOpen,
  onClose,
  fromIata,
  fromCity,
  toIata,
  toCity,
  arrivalDatetime,
  nextDepartureDate,
  passengers,
  onSelect,
  onSeeMoreOptions,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [cheapest, setCheapest] = useState<FlightOption | null>(null);
  /** Cheapest flight that departs on the user's originally planned wrap-up
   *  date (= nextDepartureDate). Used to message whether their plan is
   *  already optimal or whether shifting saves money. */
  const [plannedDayCheapest, setPlannedDayCheapest] = useState<FlightOption | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dates = useMemo(
    () => (isOpen ? buildDateWindow(arrivalDatetime, nextDepartureDate) : []),
    [isOpen, arrivalDatetime, nextDepartureDate],
  );

  useEffect(() => {
    if (!isOpen) return;
    if (dates.length === 0) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCheapest(null);
    setPlannedDayCheapest(null);

    Promise.allSettled(
      dates.map((d) =>
        searchFlights(fromIata, d, { destination: toIata, passengers, deduplicate: false }),
      ),
    )
      .then((settled) => {
        if (cancelled) return;
        const all: FlightOption[] = [];
        for (const r of settled) {
          if (r.status === 'fulfilled') all.push(...r.value);
        }
        if (all.length === 0) {
          const firstReject = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected');
          setError(
            firstReject
              ? firstReject.reason instanceof Error
                ? firstReject.reason.message
                : 'Could not load flights'
              : `No flights found from ${fromCity} to ${toCity} in this window.`,
          );
          setCheapest(null);
          setPlannedDayCheapest(null);
        } else {
          all.sort((a, b) => a.priceUsd - b.priceUsd);
          setCheapest(all[0]);
          // Cheapest flight that actually departs on the user's planned
          // wrap-up day. May be undefined if there are no flights that day —
          // the modal handles that as a separate messaging branch.
          const onPlannedDay = all.find(
            (f) => f.departureDatetime.slice(0, 10) === nextDepartureDate,
          );
          setPlannedDayCheapest(onPlannedDay ?? null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, dates, fromIata, toIata, passengers, fromCity, toCity, nextDepartureDate]);

  if (!isOpen) return null;

  const windowLabel =
    dates.length > 0
      ? `${formatDateLong(dates[0])} – ${formatDateLong(dates[dates.length - 1])}`
      : '';

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-[440px] bg-white rounded-3xl overflow-hidden animate-fade-in"
        style={{ boxShadow: '0 24px 64px rgba(15,23,42,0.20)' }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-surface border border-border flex items-center justify-center text-text-muted hover:text-text-primary transition-all active:scale-95 z-10"
          aria-label="Close"
        >
          <X size={14} />
        </button>

        <div className="px-6 pt-7 pb-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-soft border border-indigo-border flex items-center justify-center">
              <Plane size={18} className="text-indigo" />
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-text-muted">
                When to fly
              </p>
              <h3 className="text-lg font-bold text-text-primary leading-tight">
                Cheapest flight home
              </h3>
            </div>
          </div>
          <p className="text-sm text-text-muted leading-relaxed">
            We checked every day from <span className="text-text-primary font-semibold">{fromCity}</span> to{' '}
            <span className="text-text-primary font-semibold">{toCity}</span> across {windowLabel}.
          </p>
        </div>

        <div className="px-6 pb-6">
          {loading && (
            <div className="rounded-2xl border border-border bg-surface-2/40 px-4 py-5 animate-pulse">
              <div className="h-3 w-24 bg-surface-2 rounded mb-3" />
              <div className="h-5 w-44 bg-surface-2 rounded mb-2" />
              <div className="h-4 w-32 bg-surface-2 rounded" />
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900 leading-snug">{error}</p>
            </div>
          )}

          {!loading && !error && cheapest && (() => {
            const cheapestDate = cheapest.departureDatetime.slice(0, 10);
            const isOnPlannedDay = cheapestDate === nextDepartureDate;
            const dayDelta = differenceInCalendarDays(
              parseISO(cheapestDate),
              parseISO(nextDepartureDate),
            );
            const savingsVsPlanned =
              plannedDayCheapest && !isOnPlannedDay
                ? Math.max(0, plannedDayCheapest.priceUsd - cheapest.priceUsd)
                : 0;
            const cardLabel = isOnPlannedDay
              ? 'Your planned departure'
              : savingsVsPlanned > 0
                ? 'Cheaper nearby'
                : 'Cheapest in window';

            return (
              <>
                {/* Contextual banner. Three branches:
                    1. Cheapest IS the planned day → reassure ("you picked well")
                    2. Cheapest is a different day AND beats planned-day price →
                       suggest the shift + show the savings.
                    3. Planned day has no flights at all → nudge toward the
                       nearby cheapest as the next-best option. */}
                {isOnPlannedDay && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 mb-4 flex items-start gap-2.5">
                    <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-emerald-900 leading-snug">
                      Good pick — your planned departure on{' '}
                      <strong>{formatDateLong(nextDepartureDate)}</strong> is the cheapest day in
                      this window. No need to shuffle dates.
                    </p>
                  </div>
                )}
                {!isOnPlannedDay && plannedDayCheapest && savingsVsPlanned > 0 && (
                  <div className="rounded-2xl border border-indigo-border bg-indigo-soft/60 px-4 py-3 mb-4 flex items-start gap-2.5">
                    <CalendarClock size={16} className="text-indigo shrink-0 mt-0.5" />
                    <p className="text-sm text-indigo-900 leading-snug">
                      You can save{' '}
                      <strong className="font-mono">{formatPrice(savingsVsPlanned)}</strong>{' '}
                      by flying {dayDelta < 0 ? `${Math.abs(dayDelta)} day${Math.abs(dayDelta) === 1 ? '' : 's'} earlier` : `${dayDelta} day${dayDelta === 1 ? '' : 's'} later`}{' '}
                      than your planned{' '}
                      <strong>{formatDateLong(nextDepartureDate)}</strong>. Want to shift your
                      come-home date?
                    </p>
                  </div>
                )}
                {!isOnPlannedDay && !plannedDayCheapest && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 mb-4 flex items-start gap-2.5">
                    <CalendarClock size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-900 leading-snug">
                      No flights on your planned{' '}
                      <strong>{formatDateLong(nextDepartureDate)}</strong>. The closest cheap
                      option is {dayDelta < 0 ? `${Math.abs(dayDelta)} day${Math.abs(dayDelta) === 1 ? '' : 's'} earlier` : `${dayDelta} day${dayDelta === 1 ? '' : 's'} later`}.
                    </p>
                  </div>
                )}

                <div
                  className="rounded-2xl border border-indigo-border bg-indigo-soft/40 px-5 py-4 mb-4"
                  style={{ boxShadow: '0 4px 12px rgba(79,70,229,0.10)' }}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-indigo">
                        {cardLabel}
                      </p>
                      <p className="text-text-primary font-bold text-base leading-tight mt-1">
                        {formatDateLong(cheapestDate)}
                      </p>
                    </div>
                    <p className="font-mono text-orange text-xl font-bold shrink-0">
                      {formatPrice(cheapest.priceUsd)}
                    </p>
                  </div>
                  <p className="text-sm text-text-secondary">
                    {cheapest.airlineName} ·{' '}
                    {cheapest.stops === 0
                      ? 'Direct'
                      : `${cheapest.stops} ${cheapest.stops === 1 ? 'stop' : 'stops'}`}
                  </p>
                  <p className="text-[12px] text-text-muted mt-1">
                    {cheapest.originIata} → {cheapest.destinationIata}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onSelect(cheapest)}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full bg-orange text-white text-sm font-bold hover:bg-orange-dark transition-all"
                  style={{ boxShadow: '0 12px 24px -8px rgba(249,115,22,0.45)' }}
                >
                  Book this flight home
                </button>
              </>
            );
          })()}

          {onSeeMoreOptions && (
            <button
              type="button"
              onClick={onSeeMoreOptions}
              className="w-full mt-3 inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-surface border border-border text-sm font-semibold text-indigo hover:bg-indigo-soft hover:border-indigo-border transition-all"
            >
              See more flight options
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full mt-3 inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-surface border border-border text-sm font-semibold text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
