import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { FlightOption, TripLeg } from '@fast-travel/shared';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useTripStore } from '../store/trip.store';
import { useReturnOptions } from '../hooks/useReturnOptions';
import { DatePickerOverlay } from '../components/DatePickerOverlay';
import { ReturnFlightCard, ReturnFlightCardSkeleton } from '../components/ReturnFlightCard';
import { TripTimeline } from '../components/TripTimeline';
import { MapErrorBoundary } from '../components/MapErrorBoundary';
import { formatDate } from '../utils/date.utils';
import { formatPrice, totalPrice } from '../utils/price.utils';
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar, RefreshCw } from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';

const TripMap = lazy(() =>
  import('../components/TripMap').then((m) => ({ default: m.TripMap })),
);

export function ReturnFlightsScreen() {
  const origin = useTripStore((s) => s.origin);
  const legs = useTripStore((s) => s.legs);
  const addLeg = useTripStore((s) => s.addLeg);
  const finalize = useTripStore((s) => s.finalize);

  // Stable primitives — no new object refs in useEffect deps
  const outboundLegs = legs.filter((l) => !l.isReturn);
  const lastOutboundLeg = outboundLegs.at(-1);
  const currentIata = lastOutboundLeg?.destinationIata ?? origin?.iata ?? '';
  const currentCityName = lastOutboundLeg?.destinationCity ?? origin?.city.name ?? '';
  const nextDeparture = lastOutboundLeg?.nextDepartureDate ?? null;
  const originIata = origin?.iata ?? '';
  const originCityName = origin?.city.name ?? '';
  const tripTotal = totalPrice(outboundLegs);

  const navigate = useNavigate();
  const { flights: pendingFlights, isLoading: isSearchingFlights, error: flightError, search } = useReturnOptions();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [localDate, setLocalDate] = useState(
    nextDeparture ?? format(addDays(new Date(), 1), 'yyyy-MM-dd'),
  );
  const [showCalendar, setShowCalendar] = useState(false);

  // Fetch 3 nearby days in parallel so the user sees real return-flight choices,
  // not just whatever Kiwi happens to surface for a single date.
  useEffect(() => {
    if (!currentIata || !originIata || !localDate) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(currentIata, originIata, localDate);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [currentIata, originIata, localDate, search]);

  function shiftDate(delta: number) {
    const newDate = format(addDays(parseISO(localDate), delta), 'yyyy-MM-dd');
    setLocalDate(newDate);
  }

  function handleSelect(flight: FlightOption) {
    const stopIndex = outboundLegs.length + 1;
    addLeg({
      ...flight,
      stopIndex,
      stayDurationDays: 0,
      nextDepartureDate: '',
      isReturn: true,
    });
    finalize();
    navigate('/itinerary');
  }

  // Preview the cheapest return option as a dashed arc back to origin so the user
  // sees the "loop closing" visually on the map. Falls back to outbound-only if
  // results haven't loaded yet.
  const mapLegs = useMemo<TripLeg[]>(() => {
    const cheapestReturn = pendingFlights[0];
    if (!cheapestReturn) return outboundLegs;
    const previewLeg: TripLeg = {
      ...cheapestReturn,
      stopIndex: outboundLegs.length + 1,
      stayDurationDays: 0,
      nextDepartureDate: '',
      isReturn: true,
    };
    return [...outboundLegs, previewLeg];
  }, [outboundLegs, pendingFlights]);

  return (
    <div className="flex flex-col min-h-screen md:flex-row md:min-h-0 md:flex-1">
      <Helmet><title>Fly home from {currentCityName} · FlexBook</title></Helmet>
      {/* Left panel: controls */}
      <div className="px-4 pt-4 pb-3 md:w-[340px] lg:w-[380px] md:flex-shrink-0 md:border-r md:border-border/50 md:overflow-y-auto md:pb-8">
        {/* Minimal header: back + pill + tight route line */}
        <div className="flex items-center gap-2.5 mb-3">
          <button
            onClick={() => navigate('/review')}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-border hover:bg-indigo-soft hover:border-indigo-border transition-all text-text-muted shrink-0"
            aria-label="Back to trip decisions"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="pill-warning">Way home</span>
          <div className="min-w-0 flex-1 text-right">
            <span className="font-mono text-orange text-xs font-bold">{formatPrice(tripTotal)}</span>
          </div>
        </div>

        <h1 className="text-xl md:text-2xl font-bold text-text-primary leading-tight mb-3">
          {currentCityName} <span className="text-text-muted font-normal">→</span> {originCityName}
        </h1>

        {/* Outbound trip timeline (compact) */}
        <div className="mb-4 pb-3 border-b border-border/50">
          <TripTimeline legs={legs} highlightLast={false} />
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftDate(-1)}
            className="w-12 h-12 flex items-center justify-center rounded-xl bg-surface border border-border hover:border-indigo-mid hover:text-indigo text-text-muted transition-colors active:scale-95 shrink-0"
            aria-label="Previous day"
          >
            <ChevronLeft size={20} />
          </button>

          {/* Mobile: single date button */}
          <button
            onClick={() => setShowCalendar(true)}
            className="flex-1 flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3 hover:border-indigo-mid transition-colors group md:hidden"
          >
            <Calendar size={15} className="text-text-muted group-hover:text-indigo transition-colors shrink-0" />
            <div className="text-left min-w-0">
              <div className="text-xs text-text-muted">Departing home</div>
              <div className="text-text-primary font-medium truncate">
                {localDate ? formatDate(localDate) : 'Pick a date'}
              </div>
            </div>
          </button>

          {/* Desktop: 4-day strip */}
          <div className="hidden md:flex flex-1 gap-2">
            {[-1, 0, 1, 2].map((offset) => {
              const d = format(addDays(parseISO(localDate), offset), 'yyyy-MM-dd');
              const isActive = d === localDate;
              return (
                <button
                  key={offset}
                  onClick={() => setLocalDate(d)}
                  className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo text-white border border-indigo'
                      : 'bg-surface border border-border text-text-muted hover:border-indigo-mid hover:text-indigo'
                  }`}
                >
                  {format(addDays(parseISO(localDate), offset), 'EEE d')}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => shiftDate(1)}
            className="w-12 h-12 flex items-center justify-center rounded-xl bg-surface border border-border hover:border-indigo-mid hover:text-indigo text-text-muted transition-colors active:scale-95 shrink-0"
            aria-label="Next day"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Right panel: results */}
      <div className="flex-1 flex flex-col min-h-0 md:overflow-y-auto">
      <div className="flex-1 px-4 pb-8 pt-3 md:pt-4">
        {/* Trip map — outbound chain + dashed preview arc back to origin */}
        {origin && outboundLegs.length > 0 && (
          <div className="md:sticky md:top-0 md:z-20 -mx-4 px-4 pb-3 md:bg-bg/95 md:backdrop-blur-sm">
            <div className="relative h-[200px] sm:h-[240px] md:h-[280px] rounded-2xl overflow-hidden border border-border bg-surface-2/30 shadow-[0_4px_16px_rgba(15,23,42,0.08)]">
              <MapErrorBoundary>
                <Suspense
                  fallback={
                    <div className="h-full flex items-center justify-center text-text-muted text-xs animate-pulse">
                      Loading map…
                    </div>
                  }
                >
                  <TripMap origin={origin} legs={mapLegs} />
                </Suspense>
              </MapErrorBoundary>
            </div>
          </div>
        )}

        {/* Sub-header */}
        {!isSearchingFlights && pendingFlights.length > 0 && (
          <p className="text-xs text-text-muted mb-3 px-1">
            {pendingFlights.length} cheapest option{pendingFlights.length > 1 ? 's' : ''} back to {originCityName} across the next few days
          </p>
        )}

        {/* Error */}
        {flightError && !isSearchingFlights && (
          <div className="card mb-4 text-center">
            <p className="text-text-muted text-sm mb-3">Couldn&apos;t load return flights.</p>
            <button
              onClick={() => search(currentIata, originIata, localDate)}
              className="flex items-center gap-2 mx-auto text-indigo-mid text-sm hover:underline"
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        {/* No results */}
        {!isSearchingFlights && !flightError && pendingFlights.length === 0 && (
          <div className="card mb-4 text-center">
            <p className="text-text-muted text-sm mb-3">
              No good route home showed up in the next few days.
            </p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => shiftDate(-1)} className="btn-outline py-2 px-4 text-sm w-auto">← Day before</button>
              <button onClick={() => shiftDate(1)} className="btn-outline py-2 px-4 text-sm w-auto">Day after →</button>
            </div>
          </div>
        )}

        {/* Ticket cards — 3 max, route-focused design */}
        <div className="space-y-3">
          {isSearchingFlights
            ? Array.from({ length: 3 }).map((_, i) => <ReturnFlightCardSkeleton key={i} />)
            : pendingFlights.map((flight) => (
                <ReturnFlightCard
                  key={flight.flightId}
                  flight={flight}
                  onSelect={handleSelect}
                />
              ))}
        </div>

        {/* Try next day nudge */}
        {!isSearchingFlights && pendingFlights.length > 0 && (
          <button
            onClick={() => shiftDate(1)}
            className="w-full mt-4 py-3 flex items-center justify-center gap-2 text-text-muted text-sm hover:text-indigo transition-colors"
          >
            <span>Want a better finish?</span>
            <span className="text-orange font-medium flex items-center gap-1">
              Try next day <ChevronRight size={14} />
            </span>
          </button>
        )}
      </div>

      {/* Back */}
      <div className="px-4 pb-6">
        <button className="btn-outline" onClick={() => navigate('/review')}>
          ← Back to trip
        </button>
      </div>
      </div>{/* end right panel */}

      {showCalendar && (
        <DatePickerOverlay
          currentDate={localDate}
          legs={legs}
          onConfirm={(date) => { setLocalDate(date); setShowCalendar(false); }}
          onClose={() => setShowCalendar(false)}
        />
      )}
    </div>
  );
}
