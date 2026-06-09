import { useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ExternalLink,
  Plane,
  Ticket,
} from 'lucide-react';
import { FlightOption } from '@fast-travel/shared';
import { MarketingShellV2 } from '../components/MarketingShellV2';
import { LegRow } from '../components/FlightCardDetailed';
import { loadSelectedTrip, SelectedTrip } from '../lib/selectedTrip';
import { formatPrice } from '../utils/price.utils';
import { durationLabel } from '../utils/date.utils';
import { buildKiwiMultiCitySearchUrl } from '../utils/kiwi.utils';

interface Props {
  onMenuOpen?: () => void;
}

function tripTypeLabel(t: SelectedTrip['type']): string {
  if (t === 'oneway') return 'One-way';
  if (t === 'return') return 'Round trip';
  return 'Multi-city';
}

function buildCityChain(flights: FlightOption[]): string[] {
  if (flights.length === 0) return [];
  const cities: string[] = [flights[0].originCity];
  for (const f of flights) cities.push(f.destinationCity);
  return cities;
}

function totalDurationMinutes(flights: FlightOption[]): number {
  return flights.reduce((sum, f) => sum + (f.durationMinutes ?? 0), 0);
}

function travelWindow(flights: FlightOption[]): string | null {
  if (flights.length === 0) return null;
  const start = flights[0].departureDatetime;
  const end = flights[flights.length - 1].arrivalDatetime;
  try {
    const startStr = format(parseISO(start), 'EEE, MMM d');
    const endStr = format(parseISO(end), 'EEE, MMM d');
    return startStr === endStr ? startStr : `${startStr} – ${endStr}`;
  } catch {
    return null;
  }
}

function stayNightsBetween(arrivalIso: string, nextDepartureIso: string): number {
  try {
    const arrive = parseISO(arrivalIso);
    const depart = parseISO(nextDepartureIso);
    return Math.max(0, differenceInCalendarDays(depart, arrive));
  } catch {
    return 0;
  }
}

export function TripDetailsScreen({ onMenuOpen }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // Falls back to navigation state — we set `state.trip` on navigate so the
  // first paint doesn't have to wait on sessionStorage (and survives the
  // refresh hop via the storage entry that persistSelectedTrip wrote).
  const location = useLocation();
  const stateTrip = (location.state as { trip?: SelectedTrip } | null)?.trip ?? null;
  const trip = useMemo<SelectedTrip | null>(() => {
    if (stateTrip && stateTrip.id === id) return stateTrip;
    return loadSelectedTrip(id);
  }, [id, stateTrip]);

  if (!trip) {
    return (
      <MarketingShellV2
        active="search"
        title="Trip not found"
        description="We couldn't find the trip you were reviewing."
        onMenuOpen={onMenuOpen}
      >
        <div className="max-w-2xl mx-auto px-5 md:px-8 pt-8 pb-16 text-center">
          <p className="text-base font-bold text-text-primary mb-1">
            We couldn't find that trip.
          </p>
          <p className="text-sm text-text-muted mb-4">
            Trip context lives in your browser session — refreshing too late or
            switching browsers can lose it. Start a new search and pick again.
          </p>
          <Link
            to="/quick-search"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo text-white text-sm font-bold hover:bg-indigo/90 transition-all"
          >
            New search <ArrowRight size={14} />
          </Link>
        </div>
      </MarketingShellV2>
    );
  }

  const cities = buildCityChain(trip.flights);
  const windowStr = travelWindow(trip.flights);
  const totalDur = totalDurationMinutes(trip.flights);
  const legCountLabel = `${trip.flights.length} flight${trip.flights.length === 1 ? '' : 's'}`;

  function handleBack() {
    navigate(-1);
  }

  function openBooking(url: string) {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // Multi-city: each leg is sold as a separate ticket on Kiwi, so the per-leg
  // deep-link checkout URLs each open a different page. Previously we'd loop
  // window.open per leg, but the browser's popup blocker only lets the first
  // through — the user would land on Kiwi seeing one leg, not the whole trip.
  // Instead build a single Kiwi multi-city *search* URL with every sector
  // pre-filled and open it in one tab.
  const multiCityBookingUrl = useMemo(
    () => buildKiwiMultiCitySearchUrl(trip?.flights ?? [], trip?.passengers ?? 1),
    [trip],
  );

  function openMultiCitySearch() {
    if (!multiCityBookingUrl) return;
    window.open(multiCityBookingUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <MarketingShellV2
      active="search"
      title="Trip details"
      description="Review your selected flights before booking."
      onMenuOpen={onMenuOpen}
    >
      <Helmet>
        <title>Review trip — Flexbook</title>
      </Helmet>

      <div className="max-w-3xl xl:max-w-4xl mx-auto px-4 md:px-6 lg:px-8 pt-4 md:pt-6 pb-12 space-y-5">
        {/* ── Header / hero panel ─────────────────────────────────────────── */}
        <div className="rounded-3xl bg-indigo-soft border border-indigo-border/70 p-4 md:p-5">
          <div className="flex items-start gap-3 mb-4">
            <button
              type="button"
              onClick={handleBack}
              className="w-10 h-10 flex items-center justify-center rounded-2xl bg-surface border border-border hover:bg-indigo-soft hover:border-indigo-border transition-all text-text-muted shrink-0"
              style={{ minHeight: '44px', minWidth: '44px' }}
              aria-label="Back to results"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-indigo-mid font-mono mb-1">
                {tripTypeLabel(trip.type)} · {legCountLabel}
              </p>
              <h1 className="text-xl md:text-2xl font-bold text-text-primary leading-tight">
                Review your trip
              </h1>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Stat label="Flights" value={String(trip.flights.length)} />
            <Stat label="Cities" value={String(new Set(cities).size)} />
            <Stat label="Air time" value={durationLabel(totalDur)} />
          </div>

          {windowStr && (
            <div className="rounded-xl bg-white/70 border border-border/60 px-3 py-2 flex items-center gap-2 mb-3">
              <CalendarDays size={13} className="text-indigo shrink-0" />
              <span className="text-sm text-text-muted truncate">{windowStr}</span>
            </div>
          )}

          {/* Journey chips */}
          <div className="rounded-xl bg-white/70 border border-border/60 px-3 py-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
              {cities.map((c, i) => (
                <span key={`${c}-${i}`} className="inline-flex items-center gap-1.5">
                  {i > 0 && <Plane size={11} className="rotate-90 text-text-xmuted" />}
                  <span className="font-bold text-text-primary">{c}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Per-leg details ─────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Ticket size={13} className="text-text-muted" />
            <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-semibold">
              Flight details
            </p>
          </div>

          <div className="space-y-3">
            {trip.flights.map((flight, i) => {
              const nextFlight = trip.flights[i + 1];
              const nights = nextFlight
                ? stayNightsBetween(flight.arrivalDatetime, nextFlight.departureDatetime)
                : 0;
              const stayCity = flight.destinationCity;
              const legLabel = labelForLeg(trip.type, i, trip.flights.length);
              return (
                <div key={flight.flightId ?? `${i}-${flight.originIata}-${flight.destinationIata}`}>
                  <div className="rounded-2xl bg-surface border border-border p-3 md:p-4">
                    <LegRow leg={flight} legLabel={legLabel} />
                    <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-xs text-text-muted">
                        {format(parseISO(flight.departureDatetime), 'EEE, MMM d · HH:mm')}
                        {' '}→{' '}
                        {format(parseISO(flight.arrivalDatetime), 'HH:mm')}
                      </div>
                      <div className="font-mono font-black text-orange text-lg">
                        {formatPrice(flight.priceUsd)}
                      </div>
                    </div>
                  </div>

                  {/* Stay divider between legs */}
                  {nextFlight && (
                    <div className="my-2 flex items-center gap-2 text-[11px] text-text-muted">
                      <div className="flex-1 border-t border-border/60" />
                      <span className="font-semibold">
                        {nights > 0
                          ? `${nights} night${nights === 1 ? '' : 's'} in ${stayCity}`
                          : `Connecting via ${stayCity}`}
                      </span>
                      <div className="flex-1 border-t border-border/60" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Booking CTA panel ───────────────────────────────────────────── */}
        <div className="rounded-3xl bg-surface border border-border p-4 md:p-5 sticky bottom-2 shadow-[0_-12px_30px_-18px_rgba(15,23,42,0.18)]">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-xs text-text-muted">
              Total · {trip.passengers} traveler{trip.passengers === 1 ? '' : 's'}
            </p>
            <p className="font-mono font-black text-orange text-2xl">
              {formatPrice(trip.totalPriceUsd)}
            </p>
          </div>

          {trip.type === 'multi' ? (
            <>
              <p className="text-[11px] text-text-muted mb-3 leading-relaxed">
                Opens a Kiwi multi-city search with every leg pre-filled. Each
                leg is still sold as its own ticket — confirm prices and baggage
                rules on Kiwi before completing the booking.
              </p>
              <button
                type="button"
                onClick={openMultiCitySearch}
                disabled={!multiCityBookingUrl}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-orange text-white text-sm font-bold hover:bg-orange-dark transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ boxShadow: '0 14px 30px -10px rgba(249,115,22,0.5)' }}
              >
                <ExternalLink size={14} /> Book all flights on Kiwi
              </button>
              <div className="mt-3 space-y-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-text-xmuted font-semibold px-1">
                  Or open one leg at a time
                </p>
                {trip.bookings.map((b, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => openBooking(b.url)}
                    className="w-full inline-flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-surface border border-border text-sm font-semibold text-text-primary hover:border-indigo-border hover:text-indigo transition-colors"
                  >
                    <span className="truncate">{b.label}</span>
                    <ExternalLink size={13} className="shrink-0" />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => openBooking(trip.bookings[0]?.url ?? '')}
              disabled={!trip.bookings[0]?.url}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-orange text-white text-sm font-bold hover:bg-orange-dark transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ boxShadow: '0 14px 30px -10px rgba(249,115,22,0.5)' }}
            >
              <ExternalLink size={14} /> {trip.bookings[0]?.label ?? 'Book this trip'}
            </button>
          )}
          <p className="text-[10px] text-text-xmuted text-center mt-3">
            Opens the partner site in a new tab. Final price + baggage rules
            shown there.
          </p>
        </div>
      </div>
    </MarketingShellV2>
  );
}

function labelForLeg(
  type: SelectedTrip['type'],
  i: number,
  total: number,
): string {
  if (type === 'oneway') return 'Flight';
  if (type === 'return') return i === 0 ? 'Outbound' : 'Return';
  return `Leg ${i + 1} of ${total}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface border border-border px-3 py-2.5 text-center">
      <p className="text-[9px] uppercase tracking-[0.16em] text-text-muted mb-0.5">
        {label}
      </p>
      <p className="text-text-primary font-bold text-sm">{value}</p>
    </div>
  );
}
