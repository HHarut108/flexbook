import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  ArrowLeft,
  CheckCircle2,
  CircleDot,
  Clock,
  ExternalLink,
  Plane,
  RotateCcw,
  SkipForward,
  Sparkles,
} from 'lucide-react';
import { MarketingShellV2 } from '../components/MarketingShellV2';
import { loadSelectedTrip, SelectedTrip } from '../lib/selectedTrip';
import {
  bookedCount,
  currentLegIndex,
  initialConciergeState,
  isComplete,
  loadConciergeState,
  saveConciergeState,
  skippedCount,
  type ConciergeState,
  type LegBookingStatus,
} from '../lib/conciergeState';
import { formatPrice } from '../utils/price.utils';
import { durationLabel } from '../utils/date.utils';

interface Props {
  onMenuOpen?: () => void;
}

/** /book/concierge/:tripId — the Booking Concierge stepper.
 *
 *  Trip data is loaded from sessionStorage (same key the /trip/:id screen
 *  uses). Per-leg booking status is its own sessionStorage entry so the user
 *  can close the tab, come back to the same URL, and pick up where they left
 *  off. Booking happens off-site on Kiwi — we just sequence the redirects and
 *  let the user check items off the list. */
export function BookingConciergeScreen({ onMenuOpen }: Props) {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<SelectedTrip | null>(() => loadSelectedTrip(tripId));
  const [state, setState] = useState<ConciergeState>(() =>
    trip ? loadConciergeState(tripId ?? '', trip.flights.length) : initialConciergeState(0),
  );
  const [confirmingIndex, setConfirmingIndex] = useState<number | null>(null);

  // If a refresh dropped the trip from sessionStorage we won't be able to
  // build the checklist. Rerun the load once on mount (covers the case where
  // the user opened the URL in a new tab without going through TripDetails).
  useEffect(() => {
    if (trip || !tripId) return;
    const fresh = loadSelectedTrip(tripId);
    if (fresh) {
      setTrip(fresh);
      setState(loadConciergeState(tripId, fresh.flights.length));
    }
  }, [trip, tripId]);

  // Persist the checklist on every change. Cheap (single localStorage write
  // per click), keeps "resume after reload" simple.
  useEffect(() => {
    if (tripId) saveConciergeState(tripId, state);
  }, [tripId, state]);

  const currentIdx = currentLegIndex(state);
  const complete = trip ? isComplete(state) : false;

  const totalBooked = useMemo(() => {
    if (!trip) return 0;
    return trip.flights.reduce(
      (sum, f, i) => (state.statuses[i] === 'booked' ? sum + f.priceUsd : sum),
      0,
    );
  }, [trip, state.statuses]);

  const totalRemaining = useMemo(() => {
    if (!trip) return 0;
    return trip.flights.reduce(
      (sum, f, i) => (state.statuses[i] === 'pending' ? sum + f.priceUsd : sum),
      0,
    );
  }, [trip, state.statuses]);

  if (!trip) {
    return (
      <MarketingShellV2
        active="search"
        title="Booking checklist"
        description="Step-by-step ticket booking."
        onMenuOpen={onMenuOpen}
      >
        <Helmet><title>Booking checklist — Flexbook</title></Helmet>
        <div className="max-w-2xl mx-auto px-5 md:px-8 pt-8 pb-16 text-center">
          <p className="text-base font-bold text-text-primary mb-1">
            We couldn't find that trip.
          </p>
          <p className="text-sm text-text-muted mb-4">
            Booking context lives in your browser session — refreshing too late or
            switching browsers can lose it. Start a new search and try again.
          </p>
          <Link
            to="/quick-search"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo text-white text-sm font-bold hover:bg-indigo/90 transition-all"
          >
            New search
          </Link>
        </div>
      </MarketingShellV2>
    );
  }

  function setStatus(index: number, status: LegBookingStatus) {
    setState((prev) => {
      const next = [...prev.statuses];
      next[index] = status;
      return { statuses: next };
    });
    setConfirmingIndex(null);
  }

  function handleOpenBooking(index: number, url: string) {
    if (!url) return;
    // Open the existing per-leg Kiwi deep-link — lands the user on the unified
    // /booking/?token= checkout for that single ticket. New tab so they don't
    // lose the checklist.
    window.open(url, '_blank', 'noopener,noreferrer');
    setConfirmingIndex(index);
  }

  function handleResetLeg(index: number) {
    setStatus(index, 'pending');
  }

  function handleStartOver() {
    if (!tripId || !trip) return;
    const fresh = initialConciergeState(trip.flights.length);
    setState(fresh);
    setConfirmingIndex(null);
    saveConciergeState(tripId, fresh);
  }

  const booked = bookedCount(state);
  const skipped = skippedCount(state);
  const total = trip.flights.length;

  return (
    <MarketingShellV2
      active="search"
      title="Booking checklist"
      description="Walk through every ticket on Kiwi, one at a time."
      onMenuOpen={onMenuOpen}
    >
      <Helmet><title>Booking checklist — Flexbook</title></Helmet>

      <div className="max-w-3xl xl:max-w-4xl mx-auto px-4 md:px-6 lg:px-8 pt-4 md:pt-6 pb-12 space-y-5">
        {/* ── Header / progress panel ──────────────────────────────────────── */}
        <div className="rounded-3xl bg-indigo-soft border border-indigo-border/70 p-4 md:p-5">
          <div className="flex items-start gap-3 mb-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-10 h-10 flex items-center justify-center rounded-2xl bg-surface border border-border hover:bg-indigo-soft hover:border-indigo-border transition-all text-text-muted shrink-0"
              style={{ minHeight: '44px', minWidth: '44px' }}
              aria-label="Back to trip review"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-indigo-mid font-mono mb-1">
                {complete ? "All set" : `${booked} of ${total} booked`}
              </p>
              <h1 className="text-xl md:text-2xl font-bold text-text-primary leading-tight">
                {complete ? "You're done — safe travels" : 'Booking checklist'}
              </h1>
            </div>
          </div>

          {/* Progress pips */}
          <div className="flex items-center gap-1.5 mb-3">
            {trip.flights.map((_, i) => {
              const status = state.statuses[i];
              const isCurrent = i === currentIdx && !complete;
              return (
                <div
                  key={i}
                  className={`h-2 flex-1 rounded-full transition-colors ${
                    status === 'booked'
                      ? 'bg-emerald-500'
                      : status === 'skipped'
                        ? 'bg-amber-400'
                        : isCurrent
                          ? 'bg-indigo'
                          : 'bg-border'
                  }`}
                  aria-label={`Ticket ${i + 1}: ${status}`}
                />
              );
            })}
          </div>

          {/* Totals row */}
          <div className="rounded-xl bg-white/70 border border-border/60 px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap text-xs">
            <span className="text-text-muted">
              <strong className="text-emerald-700 font-mono">
                {formatPrice(totalBooked)}
              </strong>{' '}
              booked
              {skipped > 0 && (
                <span className="text-amber-700 ml-2">· {skipped} skipped</span>
              )}
            </span>
            {totalRemaining > 0 && (
              <span className="text-text-muted">
                <strong className="text-orange font-mono">{formatPrice(totalRemaining)}</strong>{' '}
                to go
              </span>
            )}
          </div>
        </div>

        {/* ── Completion banner ────────────────────────────────────────────── */}
        {complete && (
          <div className="rounded-3xl bg-emerald-50 border border-emerald-200 p-4 md:p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500 flex items-center justify-center shrink-0">
                <CheckCircle2 size={22} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-700 font-mono mb-1">
                  Trip booked
                </p>
                <h2 className="text-lg font-bold text-text-primary leading-tight">
                  {booked} ticket{booked === 1 ? '' : 's'} booked · {formatPrice(totalBooked)}
                </h2>
                {skipped > 0 && (
                  <p className="text-xs text-amber-700 mt-1">
                    {skipped} leg{skipped === 1 ? '' : 's'} skipped — you can come back any time.
                  </p>
                )}
              </div>
            </div>
            <p className="text-xs text-text-muted leading-relaxed mb-3">
              Your booking confirmations and e-tickets are in your email. We don't
              store payment info — refer to Kiwi for changes, cancellations, or
              support on each ticket.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/quick-search"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo text-white text-xs font-bold hover:bg-indigo/90 transition-all"
              >
                Plan another trip
              </Link>
              <button
                type="button"
                onClick={handleStartOver}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border text-xs font-semibold text-text-secondary hover:border-indigo-border hover:text-indigo transition-all"
              >
                <RotateCcw size={12} /> Restart checklist
              </button>
            </div>
          </div>
        )}

        {/* ── Per-leg list ─────────────────────────────────────────────────── */}
        <div className="space-y-3">
          {trip.flights.map((leg, i) => {
            const status = state.statuses[i];
            const isCurrent = i === currentIdx && !complete;
            const booking = trip.bookings[i];
            const isConfirming = confirmingIndex === i && status === 'pending';
            return (
              <LegCard
                key={`${i}-${leg.originIata}-${leg.destinationIata}`}
                index={i}
                total={total}
                leg={leg}
                status={status}
                isCurrent={isCurrent}
                isConfirming={isConfirming}
                bookingUrl={booking?.url ?? ''}
                bookingLabel={booking?.label}
                onOpen={() => handleOpenBooking(i, booking?.url ?? '')}
                onMarkBooked={() => setStatus(i, 'booked')}
                onMarkSkipped={() => setStatus(i, 'skipped')}
                onNotYet={() => setConfirmingIndex(null)}
                onResetLeg={() => handleResetLeg(i)}
              />
            );
          })}
        </div>

        {/* ── Footer reassurance ───────────────────────────────────────────── */}
        {!complete && (
          <div className="rounded-2xl bg-surface border border-border/70 px-4 py-3 flex items-start gap-2.5">
            <Sparkles size={14} className="text-indigo shrink-0 mt-0.5" />
            <p className="text-[12px] text-text-muted leading-relaxed">
              Take your time. Your progress saves automatically — close the tab and
              come back whenever you're ready to book the next ticket.
            </p>
          </div>
        )}
      </div>
    </MarketingShellV2>
  );
}

/* ── Per-leg card ───────────────────────────────────────────────────────── */

interface LegCardProps {
  index: number;
  total: number;
  leg: SelectedTrip['flights'][number];
  status: LegBookingStatus;
  isCurrent: boolean;
  isConfirming: boolean;
  bookingUrl: string;
  bookingLabel?: string;
  onOpen: () => void;
  onMarkBooked: () => void;
  onMarkSkipped: () => void;
  onNotYet: () => void;
  onResetLeg: () => void;
}

function LegCard({
  index,
  total,
  leg,
  status,
  isCurrent,
  isConfirming,
  bookingUrl,
  bookingLabel,
  onOpen,
  onMarkBooked,
  onMarkSkipped,
  onNotYet,
  onResetLeg,
}: LegCardProps) {
  const depDate = safeFormat(leg.departureDatetime, 'EEE, MMM d');
  const depTime = safeFormat(leg.departureDatetime, 'HH:mm');
  const arrTime = safeFormat(leg.arrivalDatetime, 'HH:mm');

  // Visual emphasis is driven by status. Current = orange highlight; booked =
  // green check; skipped = muted amber; pending-not-current = quiet card.
  const wrapperClass = (() => {
    if (status === 'booked') return 'bg-emerald-50 border-emerald-200';
    if (status === 'skipped') return 'bg-amber-50 border-amber-200';
    if (isCurrent) return 'bg-surface border-orange/40 shadow-[0_12px_30px_-18px_rgba(249,115,22,0.4)]';
    return 'bg-surface border-border';
  })();

  return (
    <div className={`rounded-3xl border p-4 md:p-5 transition-all ${wrapperClass}`}>
      <div className="flex items-start gap-3 mb-3">
        <StatusBadge status={status} isCurrent={isCurrent} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-mono mb-0.5">
            Ticket {index + 1} of {total}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-base text-text-primary">{leg.originCity}</span>
            <Plane size={12} className="rotate-90 text-text-xmuted" />
            <span className="font-bold text-base text-text-primary">{leg.destinationCity}</span>
            <span className="text-[11px] text-text-muted font-mono">
              · {leg.originIata}→{leg.destinationIata}
            </span>
          </div>
        </div>
        <p className="font-mono font-black text-orange text-lg shrink-0">
          {formatPrice(leg.priceUsd)}
        </p>
      </div>

      {/* Flight meta */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <Meta label="Date" value={depDate} />
        <Meta label="Departs" value={depTime} />
        <Meta label="Arrives" value={arrTime} />
        <Meta label="Air time" value={durationLabel(leg.durationMinutes ?? 0)} />
      </div>

      {/* CTA row — depends on status */}
      {status === 'booked' ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 size={14} /> Marked as booked
          </span>
          <button
            type="button"
            onClick={onResetLeg}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-text-muted hover:text-indigo transition-colors"
          >
            <RotateCcw size={11} /> Undo
          </button>
        </div>
      ) : status === 'skipped' ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <SkipForward size={14} /> Skipped — come back any time
          </span>
          <button
            type="button"
            onClick={onResetLeg}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-text-muted hover:text-indigo transition-colors"
          >
            <RotateCcw size={11} /> Undo
          </button>
        </div>
      ) : isConfirming ? (
        <div className="space-y-2.5">
          <p className="text-[12px] font-semibold text-text-primary">
            Did you complete this booking on Kiwi?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onMarkBooked}
              className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-all active:scale-[0.98]"
            >
              <CheckCircle2 size={13} /> Yes, booked
            </button>
            <button
              type="button"
              onClick={onNotYet}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface border border-border text-xs font-semibold text-text-secondary hover:border-indigo-border hover:text-indigo transition-colors"
            >
              <Clock size={12} /> Not yet
            </button>
            <button
              type="button"
              onClick={onMarkSkipped}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface border border-border text-xs font-semibold text-text-muted hover:border-amber-400 hover:text-amber-700 transition-colors"
            >
              <SkipForward size={12} /> Skip
            </button>
          </div>
        </div>
      ) : isCurrent ? (
        <button
          type="button"
          onClick={onOpen}
          disabled={!bookingUrl}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-orange text-white text-sm font-bold hover:bg-orange-dark transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ boxShadow: '0 14px 30px -10px rgba(249,115,22,0.45)' }}
        >
          <ExternalLink size={14} />
          Book this ticket on Kiwi
        </button>
      ) : (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs text-text-muted">Next up after the current ticket.</span>
          <button
            type="button"
            onClick={onOpen}
            disabled={!bookingUrl}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-border text-[11px] font-semibold text-text-secondary hover:border-indigo-border hover:text-indigo transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={bookingLabel}
          >
            <ExternalLink size={11} /> Open out of order
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, isCurrent }: { status: LegBookingStatus; isCurrent: boolean }) {
  if (status === 'booked') {
    return (
      <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center shrink-0">
        <CheckCircle2 size={18} className="text-white" />
      </div>
    );
  }
  if (status === 'skipped') {
    return (
      <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
        <SkipForward size={16} className="text-amber-700" />
      </div>
    );
  }
  if (isCurrent) {
    return (
      <div className="w-10 h-10 rounded-2xl bg-orange flex items-center justify-center shrink-0">
        <CircleDot size={16} className="text-white" />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-2xl bg-surface border border-border flex items-center justify-center shrink-0">
      <span className="text-sm font-mono font-bold text-text-muted">…</span>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/60 border border-border/40 px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.16em] text-text-muted mb-0.5">{label}</p>
      <p className="text-text-primary font-semibold text-xs truncate">{value}</p>
    </div>
  );
}

function safeFormat(iso: string, pattern: string): string {
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return '—';
  }
}
