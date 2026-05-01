import { useEffect, useRef, useState } from 'react';
import { FlightOption } from '@fast-travel/shared';
import { useTripStore } from '../store/trip.store';
import { useSessionStore } from '../store/session.store';
import { useFlightSearch } from '../hooks/useFlightSearch';
import { DatePickerOverlay } from '../components/DatePickerOverlay';
import { ReturnFlightCard, ReturnFlightCardSkeleton } from '../components/ReturnFlightCard';
import { TripTimeline } from '../components/TripTimeline';
import { formatDate } from '../utils/date.utils';
import { formatPrice, totalPrice } from '../utils/price.utils';
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar, RefreshCw, Home } from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';

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

  const { pendingFlights, isSearchingFlights, flightError, setScreen } = useSessionStore();
  const { search } = useFlightSearch();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [localDate, setLocalDate] = useState(
    nextDeparture ?? format(addDays(new Date(), 1), 'yyyy-MM-dd'),
  );
  const [showCalendar, setShowCalendar] = useState(false);

  // Fetch return flights — limit 3, not deduplicated (all on same route)
  useEffect(() => {
    if (!currentIata || !originIata || !localDate) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(currentIata, localDate, { destination: originIata, deduplicate: false, limit: 3 });
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
    setScreen('itinerary');
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="hero-panel-return mb-4">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => setScreen('decision')}
              className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white border border-border hover:bg-indigo-soft hover:border-indigo-border transition-all text-text-muted shrink-0"
              aria-label="Back to trip decisions"
            >
              <ArrowLeft size={18} />
            </button>
            <span className="pill-warning">Way home</span>
          </div>
          <h2 className="text-2xl font-bold text-text-primary leading-tight mb-1">
            Ready to close the loop?
          </h2>
          <p className="text-sm leading-6 text-text-muted mb-4">
            Here are the cheapest ways to fly from {currentCityName} back to {originCityName} and
            finish the adventure.
          </p>
          <div className="rounded-2xl bg-orange-soft/70 border border-orange/20 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted mb-1">
              Route back
            </p>
            <p className="text-text-primary font-semibold">
              {currentCityName} to {originCityName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-surface-2 flex items-center justify-center shrink-0">
            <Home size={16} className="text-indigo" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-primary leading-tight">Return options</h2>
            <p className="text-text-muted text-sm">
              {currentCityName} → {originCityName}
            </p>
          </div>
        </div>

        {/* Outbound trip timeline + total */}
        <div className="mt-3 mb-4 pb-3 border-b border-border/50">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] text-text-muted uppercase tracking-wide">Outbound trip</p>
            <span className="font-mono text-orange text-xs font-bold">{formatPrice(tripTotal)}</span>
          </div>
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

          <button
            onClick={() => setShowCalendar(true)}
            className="flex-1 flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3 hover:border-indigo-mid transition-colors group"
          >
            <Calendar size={15} className="text-text-muted group-hover:text-indigo transition-colors shrink-0" />
            <div className="text-left min-w-0">
              <div className="text-xs text-text-muted">Departing home</div>
              <div className="text-text-primary font-medium truncate">
                {localDate ? formatDate(localDate) : 'Pick a date'}
              </div>
            </div>
          </button>

          <button
            onClick={() => shiftDate(1)}
            className="w-12 h-12 flex items-center justify-center rounded-xl bg-surface border border-border hover:border-indigo-mid hover:text-indigo text-text-muted transition-colors active:scale-95 shrink-0"
            aria-label="Next day"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 px-4 pb-8">
        {/* Sub-header */}
        {!isSearchingFlights && pendingFlights.length > 0 && (
          <p className="text-xs text-text-muted mb-3 px-1">
            {pendingFlights.length} cheapest option{pendingFlights.length > 1 ? 's' : ''} back to {originCityName} ready to compare
          </p>
        )}

        {/* Error */}
        {flightError && !isSearchingFlights && (
          <div className="card mb-4 text-center">
            <p className="text-text-muted text-sm mb-3">Couldn&apos;t load return flights.</p>
            <button
              onClick={() => search(currentIata, localDate, { destination: originIata, deduplicate: false, limit: 3 })}
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
              No good route home showed up on this date.
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
        <button className="btn-outline" onClick={() => setScreen('decision')}>
          ← Back to trip
        </button>
      </div>

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
