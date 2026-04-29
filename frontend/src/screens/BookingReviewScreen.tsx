import { lazy, Suspense, useEffect, useMemo, useState, useCallback } from 'react';
import { TripLeg } from '@fast-travel/shared';
import { useTripStore } from '../store/trip.store';
import { useSessionStore } from '../store/session.store';
import { fetchAirlineLogos } from '../api/airlines.api';
import { formatDate, formatTime, durationLabel } from '../utils/date.utils';
import { formatPrice, totalPrice } from '../utils/price.utils';
import { MapErrorBoundary } from '../components/MapErrorBoundary';
import { GoHomeLogo } from '../components/GoHomeLogo';
import {
  ArrowLeft,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Map,
  Clock,
  Plane,
  PlaneTakeoff,
  PlaneLanding,
  CalendarDays,
  ShieldCheck,
  Luggage,
  CheckCircle2,
  Menu,
} from 'lucide-react';

const TripMap = lazy(() => import('../components/TripMap').then((m) => ({ default: m.TripMap })));

/* ── helpers ── */

const AIRLINE_STOP_WORDS = new Set([
  'air', 'airline', 'airlines', 'airways', 'lines', 'express', 'europe', 'group',
]);

function airlineBadge(name: string) {
  const words = name
    .split(/\s+/)
    .map((p) => p.replace(/[^a-z]/gi, ''))
    .filter(Boolean)
    .filter((p) => !AIRLINE_STOP_WORDS.has(p.toLowerCase()));
  const source = words.length > 0 ? words : [name.replace(/[^a-z]/gi, '')];
  return source.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('').slice(0, 2);
}

function formatTravelWindow(legs: TripLeg[]) {
  if (legs.length === 0) return null;
  return `${formatDate(legs[0].departureDatetime)} – ${formatDate(legs[legs.length - 1].arrivalDatetime)}`;
}

function uniqueBookingUrls(legs: TripLeg[]) {
  return Array.from(new Set(legs.map((l) => l.bookingUrl).filter(Boolean)));
}

function totalDurationMinutes(legs: TripLeg[]) {
  return legs.reduce((sum, l) => sum + l.durationMinutes, 0);
}

/* ── Journey Timeline (horizontal) ── */

function JourneyTimeline({ legs, origin }: { legs: TripLeg[]; origin: string }) {
  const cities = [origin, ...legs.map((l) => l.destinationCity)];
  return (
    <div
      className="flex items-center gap-0 overflow-x-auto pb-2 -mx-1 px-1"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      role="list"
      aria-label="Journey route"
    >
      {cities.map((city, i) => {
        const isFirst = i === 0;
        const isLast = i === cities.length - 1;
        const leg = i > 0 ? legs[i - 1] : null;
        return (
          <div key={i} className="flex items-center shrink-0" role="listitem">
            {/* connector line + duration */}
            {i > 0 && (
              <div className="flex flex-col items-center mx-1">
                <span className="text-[9px] text-text-muted font-mono mb-0.5">
                  {leg ? durationLabel(leg.durationMinutes) : ''}
                </span>
                <div className="flex items-center">
                  <div className="w-6 h-[2px] bg-indigo/20 rounded-full" />
                  <Plane size={10} className="text-indigo -mx-0.5" />
                  <div className="w-6 h-[2px] bg-indigo/20 rounded-full" />
                </div>
              </div>
            )}
            {/* city node */}
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={`w-3 h-3 rounded-full border-2 ${
                  isFirst
                    ? 'bg-indigo border-indigo'
                    : isLast && legs[legs.length - 1]?.isReturn
                      ? 'bg-orange border-orange'
                      : isLast
                        ? 'bg-indigo border-indigo'
                        : 'bg-white border-indigo/50'
                }`}
              />
              <span
                className={`text-[10px] font-semibold whitespace-nowrap ${
                  isFirst || isLast ? 'text-text-primary' : 'text-text-muted'
                }`}
              >
                {city}
              </span>
              {leg && (
                <span className="text-[9px] font-mono text-orange font-semibold">
                  {formatPrice(leg.priceUsd)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Expandable Flight Leg Row ── */

function FlightLegRow({
  leg,
  index,
  isReturn,
  logoUrl,
  defaultExpanded,
}: {
  leg: TripLeg;
  index: number;
  isReturn: boolean;
  logoUrl?: string;
  defaultExpanded: boolean;
}) {
  const badge = airlineBadge(leg.airlineName);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [imageFailed, setImageFailed] = useState(false);
  const showLogo = Boolean(logoUrl) && !imageFailed;

  const routeIatas = leg.stops > 0 && leg.viaIatas?.length
    ? [leg.originIata, ...leg.viaIatas, leg.destinationIata]
    : [leg.originIata, leg.destinationIata];

  return (
    <div
      className="relative"
      role="region"
      aria-label={`${isReturn ? 'Return flight' : `Flight ${index}`}: ${leg.originCity} to ${leg.destinationCity}`}
    >
      {/* ── Collapsed row ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className={`w-full text-left rounded-2xl border transition-all duration-200 ${
          expanded
            ? 'bg-white border-indigo-border shadow-md'
            : 'bg-white/80 border-border hover:border-indigo-border hover:shadow-sm'
        }`}
        style={{ minHeight: '44px' }}
        aria-expanded={expanded}
        aria-controls={`flight-detail-${leg.stopIndex}`}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          {/* Airline logo / badge */}
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${
              isReturn
                ? 'bg-orange-soft border border-orange/20'
                : 'bg-indigo-soft border border-indigo-border'
            }`}
          >
            {showLogo ? (
              <img
                src={logoUrl}
                alt={`${leg.airlineName} logo`}
                className="h-6 w-8 object-contain"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <span className={`font-bold text-xs ${isReturn ? 'text-orange' : 'text-indigo'}`}>
                {badge}
              </span>
            )}
          </div>

          {/* Route + airline name */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isReturn ? 'text-orange' : 'text-indigo'}`}>
                {isReturn ? 'Return' : `Leg ${index}`}
              </span>
              <span className={leg.stops === 0 ? 'pill-success !py-0 !px-1.5 !text-[9px]' : 'pill-default !py-0 !px-1.5 !text-[9px]'}>
                {leg.stops === 0 ? 'Direct' : `${leg.stops} stop`}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              {routeIatas.map((iata, idx) => (
                <span key={idx} className="flex items-center gap-0.5">
                  <span
                    className={`font-mono text-sm font-bold ${
                      idx === 0 || idx === routeIatas.length - 1
                        ? 'text-text-primary'
                        : 'text-indigo-mid'
                    }`}
                  >
                    {iata}
                  </span>
                  {idx < routeIatas.length - 1 && (
                    <span className="text-text-xmuted text-[10px]">—</span>
                  )}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-text-muted mt-0.5 truncate">
              {leg.airlineName} · {durationLabel(leg.durationMinutes)}
            </p>
          </div>

          {/* Price + expand toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono font-bold text-text-primary">
              {formatPrice(leg.priceUsd)}
            </span>
            <div className="w-6 h-6 rounded-lg bg-surface-2 flex items-center justify-center">
              {expanded ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
            </div>
          </div>
        </div>
      </button>

      {/* ── Expanded detail panel ── */}
      <div
        id={`flight-detail-${leg.stopIndex}`}
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          expanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
        aria-hidden={!expanded}
      >
        <div className="px-4 pt-0 pb-4 mx-[1px]">
          <div className="bg-white rounded-b-2xl border border-t-0 border-border px-4 pt-3 pb-4 -mt-2 shadow-sm">
            {/* Flight timeline visual */}
            <div className="flex items-stretch gap-3 mb-4">
              {/* Time column */}
              <div className="flex flex-col justify-between items-end shrink-0 py-0.5">
                <span className="font-mono text-sm font-bold text-text-primary">{formatTime(leg.departureDatetime)}</span>
                <span className="text-[10px] text-text-muted font-mono">{durationLabel(leg.durationMinutes)}</span>
                <span className="font-mono text-sm font-bold text-text-primary">{formatTime(leg.arrivalDatetime)}</span>
              </div>

              {/* Visual bar */}
              <div className="flex flex-col items-center py-1">
                <div className={`w-2.5 h-2.5 rounded-full border-2 ${isReturn ? 'border-orange bg-orange' : 'border-indigo bg-indigo'}`} />
                <div className={`w-[2px] flex-1 ${isReturn ? 'bg-orange/25' : 'bg-indigo/25'}`} />
                <div className={`w-2.5 h-2.5 rounded-full border-2 ${isReturn ? 'border-orange' : 'border-indigo'} bg-white`} />
              </div>

              {/* City + date column */}
              <div className="flex flex-col justify-between flex-1 min-w-0 py-0.5">
                <div>
                  <p className="font-semibold text-sm text-text-primary">{leg.originCity}</p>
                  <p className="text-[11px] text-text-muted">{leg.originIata} · {formatDate(leg.departureDatetime)}</p>
                </div>
                <div>
                  <p className="font-semibold text-sm text-text-primary">{leg.destinationCity}</p>
                  <p className="text-[11px] text-text-muted">{leg.destinationIata} · {formatDate(leg.arrivalDatetime)}</p>
                </div>
              </div>
            </div>

            {/* Detail grid */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-xl bg-[#F8FAFF] border border-border/60 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-text-muted text-[10px] uppercase tracking-wider mb-0.5">
                  <CalendarDays size={11} /> Date
                </div>
                <p className="text-text-primary font-semibold text-sm">{formatDate(leg.departureDatetime)}</p>
              </div>
              <div className="rounded-xl bg-[#F8FAFF] border border-border/60 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-text-muted text-[10px] uppercase tracking-wider mb-0.5">
                  <Clock size={11} /> Duration
                </div>
                <p className="text-text-primary font-semibold text-sm">{durationLabel(leg.durationMinutes)}</p>
              </div>
              <div className="rounded-xl bg-[#F8FAFF] border border-border/60 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-text-muted text-[10px] uppercase tracking-wider mb-0.5">
                  <PlaneTakeoff size={11} /> Departs
                </div>
                <p className="text-text-primary font-semibold text-sm">{formatTime(leg.departureDatetime)}</p>
              </div>
              <div className="rounded-xl bg-[#F8FAFF] border border-border/60 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-text-muted text-[10px] uppercase tracking-wider mb-0.5">
                  <PlaneLanding size={11} /> Arrives
                </div>
                <p className="text-text-primary font-semibold text-sm">{formatTime(leg.arrivalDatetime)}</p>
              </div>
            </div>

            {/* Pills */}
            <div className="flex items-center flex-wrap gap-1.5 mb-3">
              <span className="pill-brand !text-[10px] !py-0.5">{leg.airlineName}</span>
              {!leg.isReturn && leg.stayDurationDays > 0 && (
                <span className="pill-warning !text-[10px] !py-0.5">
                  {leg.stayDurationDays} {leg.stayDurationDays === 1 ? 'day' : 'days'} in {leg.destinationCity}
                </span>
              )}
            </div>

            {/* Individual book CTA */}
            <a
              href={leg.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-xl border border-border bg-surface-2 py-2.5 text-sm font-semibold text-text-primary hover:border-indigo-border hover:text-indigo transition-all active:scale-[0.98]"
              style={{ minHeight: '44px' }}
              aria-label={`Book ${leg.originCity} to ${leg.destinationCity} flight on ${leg.airlineName}`}
            >
              Book this flight <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Price Breakdown Strip ── */

function PriceBreakdown({ legs }: { legs: TripLeg[] }) {
  const total = totalPrice(legs);
  return (
    <div className="rounded-2xl border border-border bg-white/80 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-semibold mb-2">
        Price breakdown
      </p>
      <div className="space-y-1.5">
        {legs.map((leg, i) => (
          <div key={leg.flightId} className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white ${leg.isReturn ? 'bg-orange' : 'bg-indigo'}`}>
                {leg.isReturn ? 'R' : i + 1}
              </span>
              <span className="text-sm text-text-muted truncate">
                {leg.originIata} → {leg.destinationIata}
              </span>
            </div>
            <span className="font-mono text-sm font-semibold text-text-primary shrink-0">
              {formatPrice(leg.priceUsd)}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-border/60 mt-2.5 pt-2.5 flex items-center justify-between">
        <span className="text-sm font-semibold text-text-primary">Estimated total</span>
        <span className="font-mono text-lg font-bold text-orange">{formatPrice(total)}</span>
      </div>
    </div>
  );
}

/* ── Main Screen ── */

export function BookingReviewScreen({ partial = false, onMenuOpen }: { partial?: boolean; onMenuOpen?: () => void } = {}) {
  const origin = useTripStore((s) => s.origin);
  const allLegs = useTripStore((s) => s.legs);
  const setScreen = useSessionStore((s) => s.setScreen);
  const [bulkStarted, setBulkStarted] = useState(false);
  const [bookingConfirm, setBookingConfirm] = useState(false);
  const [airlineLogos, setAirlineLogos] = useState<Record<string, string>>({});

  const relevantLegs = partial ? allLegs.filter((l) => !l.isReturn) : allLegs;

  const orderedLegs = useMemo(
    () => [...relevantLegs].sort((a, b) => a.stopIndex - b.stopIndex),
    [relevantLegs],
  );
  const total = totalPrice(orderedLegs);
  const uniqueUrls = useMemo(() => uniqueBookingUrls(orderedLegs), [orderedLegs]);
  const tripCities = [origin?.city.name, ...orderedLegs.map((l) => l.destinationCity)].filter(Boolean);
  const travelWindow = formatTravelWindow(orderedLegs);
  const totalFlightTime = totalDurationMinutes(orderedLegs);

  const backScreen = partial ? 'decision' : 'itinerary';

  useEffect(() => {
    let cancelled = false;
    const codes = orderedLegs
      .map((leg) => leg.airlineCode?.trim().toUpperCase())
      .filter((code): code is string => Boolean(code));
    fetchAirlineLogos(codes)
      .then((logos) => { if (!cancelled) setAirlineLogos(logos); })
      .catch(() => { if (!cancelled) setAirlineLogos({}); });
    return () => { cancelled = true; };
  }, [orderedLegs]);

  const handleBookAll = useCallback(() => {
    if (!bookingConfirm) {
      setBookingConfirm(true);
      return;
    }
    setBulkStarted(true);
    uniqueUrls.forEach((url) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  }, [bookingConfirm, uniqueUrls]);

  return (
    <div className="pb-8">
      {/* ── Top brand header ── */}
      <div
        className="sticky top-0 z-50 px-4 py-2.5 flex items-center justify-between"
        style={{
          background: 'rgba(55,48,163,0.97)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.10)',
        }}
      >
        <GoHomeLogo size="sm" variant="dark" />
        <button
          onClick={onMenuOpen}
          className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-white hover:bg-white/25 transition-all active:scale-95"
          aria-label="Open menu"
        >
          <Menu size={16} />
        </button>
      </div>

      {/* ── Hero header ── */}
      <div className="px-4 pt-4 pb-3">
        <div className="hero-panel">
          {/* Back + title */}
          <div className="flex items-start gap-3 mb-4">
            <button
              onClick={() => setScreen(backScreen)}
              className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white border border-border hover:bg-indigo-soft hover:border-indigo-border transition-all text-text-muted shrink-0"
              style={{ minHeight: '44px', minWidth: '44px' }}
              aria-label={partial ? 'Back to trip planning' : 'Back to trip overview'}
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-indigo-mid font-mono mb-1">
                {partial ? 'Tickets so far' : 'Ready to book'}
              </p>
              <h2 className="text-xl font-bold text-text-primary leading-tight">
                {partial ? 'Book your flights so far' : 'Your trip plan, ready to book'}
              </h2>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-xl bg-white border border-border px-3 py-2.5 text-center">
              <p className="text-[9px] uppercase tracking-[0.16em] text-text-muted mb-0.5">Flights</p>
              <p className="text-text-primary font-bold text-sm">{orderedLegs.length}</p>
            </div>
            <div className="rounded-xl bg-white border border-border px-3 py-2.5 text-center">
              <p className="text-[9px] uppercase tracking-[0.16em] text-text-muted mb-0.5">Cities</p>
              <p className="text-text-primary font-bold text-sm">{tripCities.length}</p>
            </div>
            <div className="rounded-xl bg-white border border-border px-3 py-2.5 text-center">
              <p className="text-[9px] uppercase tracking-[0.16em] text-text-muted mb-0.5">Air time</p>
              <p className="text-text-primary font-bold text-sm">{durationLabel(totalFlightTime)}</p>
            </div>
          </div>

          {/* Travel window */}
          {travelWindow && (
            <div className="rounded-xl bg-white/70 border border-border/60 px-3 py-2 flex items-center gap-2 mb-3">
              <CalendarDays size={13} className="text-indigo shrink-0" />
              <span className="text-sm text-text-muted">{travelWindow}</span>
            </div>
          )}

          {/* Journey timeline */}
          {origin && (
            <JourneyTimeline legs={orderedLegs} origin={origin.city.name} />
          )}
        </div>
      </div>

      {/* ── Route map ── */}
      {origin && (
        <div className="px-4 mb-3">
          <div className="section-shell px-3 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Map size={13} className="text-indigo" />
              <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-semibold">
                {partial ? 'Your route so far' : 'Full route'}
              </p>
            </div>
            <div style={{ height: '200px' }} className="rounded-2xl overflow-hidden">
              <MapErrorBoundary>
                <Suspense fallback={<div className="h-full bg-surface rounded-2xl animate-pulse" />}>
                  <TripMap origin={origin} legs={relevantLegs} />
                </Suspense>
              </MapErrorBoundary>
            </div>
          </div>
        </div>
      )}

      {/* ── Price breakdown ── */}
      <div className="px-4 mb-3">
        <PriceBreakdown legs={orderedLegs} />
      </div>

      {/* ── Primary CTA: Book this itinerary ── */}
      <div className="px-4 mb-4">
        <div className="section-shell px-4 py-4">
          {!bookingConfirm ? (
            <>
              <button
                className="btn-primary flex items-center justify-center gap-2"
                onClick={handleBookAll}
                style={{ minHeight: '48px' }}
                aria-label={`Book entire itinerary for ${formatPrice(total)}`}
              >
                <ExternalLink size={16} />
                Book this itinerary · {formatPrice(total)}
              </button>
              <p className="text-[11px] text-text-muted text-center mt-2 leading-relaxed">
                Opens {uniqueUrls.length} booking page{uniqueUrls.length > 1 ? 's' : ''} in new tabs.
                Check final prices before completing each purchase.
              </p>
            </>
          ) : (
            /* Confirmation step */
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl bg-[#FFF7ED] border border-orange/20 px-3 py-3">
                <ShieldCheck size={18} className="text-orange shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-text-primary mb-0.5">Ready to open booking pages?</p>
                  <p className="text-xs text-text-muted leading-relaxed">
                    This will open {uniqueUrls.length} tab{uniqueUrls.length > 1 ? 's' : ''} with the airlines' booking pages.
                    Check final prices, baggage rules, and layover details on each page.
                  </p>
                </div>
              </div>
              <button
                className="btn-primary flex items-center justify-center gap-2"
                onClick={handleBookAll}
                style={{ minHeight: '48px' }}
              >
                {bulkStarted ? (
                  <>
                    <CheckCircle2 size={16} /> Booking pages opened
                  </>
                ) : (
                  <>
                    <ExternalLink size={16} /> Confirm — open all booking pages
                  </>
                )}
              </button>
              {!bulkStarted && (
                <button
                  className="w-full text-center text-sm text-text-muted py-2 hover:text-text-primary transition-colors"
                  onClick={() => setBookingConfirm(false)}
                >
                  Cancel
                </button>
              )}
              {bulkStarted && (
                <p className="text-xs text-text-muted text-center flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={12} className="text-emerald-500" />
                  Opened {uniqueUrls.length} booking page{uniqueUrls.length > 1 ? 's' : ''} in new tabs
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Flight legs (expandable) ── */}
      <div className="px-4">
        <div className="flex items-center gap-2 mb-2">
          <Luggage size={13} className="text-text-muted" />
          <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-semibold">
            Flight details
          </p>
          <span className="text-[10px] text-text-muted">
            — tap to expand
          </span>
        </div>

        <div className="space-y-2">
          {orderedLegs.map((leg, index) => (
            <FlightLegRow
              key={`${leg.stopIndex}-${leg.flightId}`}
              leg={leg}
              index={index + 1}
              isReturn={leg.isReturn}
              logoUrl={leg.airlineCode ? airlineLogos[leg.airlineCode.toUpperCase()] : undefined}
              defaultExpanded={orderedLegs.length <= 2}
            />
          ))}
        </div>
      </div>

      {/* ── Bottom nav ── */}
      <div className="px-4 mt-5">
        <button
          className="btn-outline"
          onClick={() => setScreen(backScreen)}
          style={{ minHeight: '44px' }}
        >
          {partial ? 'Back to trip planning' : 'Back to trip overview'}
        </button>
      </div>
    </div>
  );
}
