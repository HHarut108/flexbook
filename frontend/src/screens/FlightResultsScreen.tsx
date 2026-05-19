import { useEffect, useRef, useState } from 'react';
import { FlightOption } from '@fast-travel/shared';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useTripStore } from '../store/trip.store';
import { useSessionStore } from '../store/session.store';
import { useFlightResults } from '../hooks/useFlightResults';
import { useWeatherBatch } from '../hooks/useWeatherBatch';
import { FlightCard, FlightCardSkeleton } from '../components/FlightCard';
import { DatePickerOverlay } from '../components/DatePickerOverlay';
import { TripTimeline } from '../components/TripTimeline';
import { formatDate } from '../utils/date.utils';
import { formatPrice, totalPrice } from '../utils/price.utils';
import { ChevronLeft, ChevronRight, Calendar, RefreshCw, ArrowLeft, Home, Users, ChevronDown } from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';

export function FlightResultsScreen() {
  const navigate = useNavigate();
  const origin = useTripStore((s) => s.origin);
  const legs = useTripStore((s) => s.legs);
  const passengers = useTripStore((s) => s.passengers);
  const setPassengers = useTripStore((s) => s.setPassengers);
  const { selectedDate, weatherMap, setSelectedDate, setSelectedFlight } = useSessionStore();
  const { flights: pendingFlights, isLoading: isSearchingFlights, error: flightError, search, reset: resetFlights } = useFlightResults();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [localDate, setLocalDate] = useState(selectedDate ?? format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [showCalendar, setShowCalendar] = useState(false);

  // Compute stable origin primitives (no new object refs in deps)
  const lastOutboundLeg = legs.filter((l) => !l.isReturn).at(-1);
  const currentIata = lastOutboundLeg?.destinationIata ?? origin?.iata ?? '';
  const currentCityName = lastOutboundLeg?.destinationCity ?? origin?.city.name ?? '';

  useWeatherBatch(pendingFlights, localDate);

  // Trigger flight search whenever origin or date changes (debounced 400ms)
  useEffect(() => {
    if (!currentIata || !localDate) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(currentIata, localDate);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [currentIata, localDate, search]);

  // Clear stale results and reset filter when changing origin city
  useEffect(() => {
    resetFlights();
    setStopsFilter(0);
    setCountryExpandOverrides({});
  }, [currentIata, resetFlights]);

  // Reset filter when date changes
  useEffect(() => {
    setStopsFilter(0);
    setCountryExpandOverrides({});
  }, [localDate]);

  function shiftDate(delta: number) {
    const newDate = format(addDays(parseISO(localDate), delta), 'yyyy-MM-dd');
    setLocalDate(newDate);
    setSelectedDate(newDate);
  }

  function handleDateConfirm(date: string) {
    setLocalDate(date);
    setSelectedDate(date);
    setShowCalendar(false);
  }

  function handleSelect(flight: FlightOption) {
    setSelectedFlight(flight);
    navigate('/stay');
  }

  const [stopsFilter, setStopsFilter] = useState<number | null>(0);
  // Explicit per-country expansion overrides. Missing entries fall back to the
  // default: only the cheapest country (first group) is expanded.
  const [countryExpandOverrides, setCountryExpandOverrides] = useState<Record<string, boolean>>({});

  const outboundLegs = legs.filter((l) => !l.isReturn);
  const stopCount = outboundLegs.length;
  const isFirstStop = stopCount === 0;
  const tripTotal = totalPrice(outboundLegs);

  // Stops-based filter buckets
  const directFlights = pendingFlights.filter((f) => f.stops === 0);
  const oneStopFlights = pendingFlights.filter((f) => f.stops === 1);

  const minPrice = (list: FlightOption[]) =>
    list.length > 0 ? Math.min(...list.map((f) => f.priceUsd)) : null;

  const filterTabs: { label: string; value: number | null; count: number; minPrice: number | null }[] = [
    { label: 'Direct', value: 0, count: directFlights.length, minPrice: minPrice(directFlights) },
    { label: '1 stop', value: 1, count: oneStopFlights.length, minPrice: minPrice(oneStopFlights) },
  ];

  const flightsAfterStopsFilter = stopsFilter === null
    ? pendingFlights
    : pendingFlights.filter((f) => f.stops === stopsFilter);

  // Group flights by destination country. Each group is sorted internally by price
  // (cheapest first), and the groups themselves are ordered by their cheapest flight
  // ascending — so the country containing the overall best deal appears first.
  // Flights without a country fall into a single "Other" bucket at the end.
  const countryGroups: { country: string; flights: FlightOption[]; minPrice: number }[] = (() => {
    const buckets = new Map<string, FlightOption[]>();
    for (const f of flightsAfterStopsFilter) {
      const key = (f.destinationCountry?.trim() || 'Other');
      const list = buckets.get(key) ?? [];
      list.push(f);
      buckets.set(key, list);
    }
    const groups = Array.from(buckets.entries()).map(([country, flights]) => {
      const sorted = [...flights].sort((a, b) => a.priceUsd - b.priceUsd);
      return { country, flights: sorted, minPrice: sorted[0].priceUsd };
    });
    return groups.sort((a, b) => {
      if (a.country === 'Other' && b.country !== 'Other') return 1;
      if (b.country === 'Other' && a.country !== 'Other') return -1;
      return a.minPrice - b.minPrice;
    });
  })();

  const isCountryExpanded = (country: string, index: number) => {
    if (Object.prototype.hasOwnProperty.call(countryExpandOverrides, country)) {
      return countryExpandOverrides[country];
    }
    return index === 0;
  };

  const toggleCountryExpanded = (country: string, index: number) => {
    setCountryExpandOverrides((prev) => ({
      ...prev,
      [country]: !isCountryExpanded(country, index),
    }));
  };

  const totalFlights = flightsAfterStopsFilter.length;

  function handleBack() {
    navigate(isFirstStop ? '/' : '/review');
  }

  const title = isFirstStop
    ? `Flights from ${currentCityName} · FlexBook`
    : `Next hop from ${currentCityName} · FlexBook`;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden lg:flex-row">
      <Helmet><title>{title}</title></Helmet>
      {/* Left panel: controls */}
      <div className="px-4 pt-4 pb-3 shrink-0 lg:w-[380px] lg:flex-shrink-0 lg:border-r lg:border-border/50 lg:overflow-y-auto lg:pb-8">
        <div className="hero-panel mb-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={handleBack}
            className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white border border-border hover:bg-indigo-soft hover:border-indigo-border transition-all text-text-muted"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-indigo-mid font-mono mb-1">
              {isFirstStop ? 'First stop' : 'Keep the trip going'}
            </p>
            <h2 className="text-xl font-bold text-text-primary leading-tight">
              {isFirstStop ? 'Cheapest flights from' : 'Cheapest next hop from'}
            </h2>
            <div className="flex items-center gap-2">
              <span className="pill-brand font-mono text-xs font-bold">{currentIata}</span>
              <span className="text-text-muted text-sm">{currentCityName}</span>
            </div>
          </div>
        </div>

        {/* Date navigation row — arrows are primary actions, calendar tap for exact date */}
        <div className="flex items-center gap-1.5 min-w-0">
          {/* ← Previous day */}
          <button
            onClick={() => shiftDate(-1)}
            className="w-10 h-11 flex items-center justify-center rounded-2xl bg-white/75 border border-white/80 hover:border-indigo-mid hover:text-indigo-mid text-text-muted transition-colors active:scale-95 shrink-0 shadow-[0_4px_12px_rgba(23,50,77,0.05)]"
            aria-label="Previous day"
          >
            <ChevronLeft size={18} />
          </button>

          {/* Mobile: single date button */}
          <button
            onClick={() => setShowCalendar(true)}
            className="flex-1 min-w-0 flex items-center gap-3 bg-white/75 border border-white/80 rounded-2xl px-4 py-3 hover:border-indigo-mid transition-colors group shadow-[0_10px_20px_rgba(23,50,77,0.05)] lg:hidden"
          >
            <Calendar size={15} className="text-text-muted group-hover:text-indigo transition-colors shrink-0" />
            <div className="text-left min-w-0">
              <div className="text-xs text-text-muted">Departing</div>
              <div className="text-text-primary font-medium truncate">
                {localDate ? formatDate(localDate) : 'Pick a date'}
              </div>
            </div>
          </button>

          {/* Desktop: 3-day ribbon centred on the active date — fits the narrow panel */}
          <div className="hidden lg:flex flex-1 min-w-0 gap-1.5">
            {[-1, 0, 1].map((offset) => {
              const d = format(addDays(parseISO(localDate), offset), 'yyyy-MM-dd');
              const isActive = offset === 0;
              return (
                <button
                  key={offset}
                  onClick={() => { setLocalDate(d); setSelectedDate(d); }}
                  className={`flex-1 min-w-0 rounded-2xl px-1.5 py-2 transition-all shadow-[0_4px_12px_rgba(23,50,77,0.05)] flex flex-col items-center justify-center leading-tight ${
                    isActive
                      ? 'bg-indigo text-white border border-indigo'
                      : 'bg-white/75 border border-white/80 text-text-muted hover:border-indigo-mid hover:text-indigo-mid'
                  }`}
                  aria-label={format(addDays(parseISO(localDate), offset), 'EEEE, MMM d')}
                >
                  <span className={`text-[10px] uppercase tracking-wide ${isActive ? 'text-white/80' : 'text-text-muted'}`}>
                    {format(addDays(parseISO(localDate), offset), 'EEE')}
                  </span>
                  <span className="text-sm font-bold tabular-nums">
                    {format(addDays(parseISO(localDate), offset), 'd')}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Calendar shortcut — desktop only, opens overlay */}
          <button
            onClick={() => setShowCalendar(true)}
            className="hidden lg:flex w-10 h-11 items-center justify-center rounded-2xl bg-white/75 border border-white/80 hover:border-indigo-mid hover:text-indigo-mid text-text-muted transition-colors active:scale-95 shrink-0 shadow-[0_4px_12px_rgba(23,50,77,0.05)]"
            aria-label="Pick a different date"
          >
            <Calendar size={16} />
          </button>

          {/* → Next day */}
          <button
            onClick={() => shiftDate(1)}
            className="w-10 h-11 flex items-center justify-center rounded-2xl bg-white/75 border border-white/80 hover:border-indigo-mid hover:text-indigo-mid text-text-muted transition-colors active:scale-95 shrink-0 shadow-[0_4px_12px_rgba(23,50,77,0.05)]"
            aria-label="Next day"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Traveler count stepper */}
        <div className="mt-3 flex items-center gap-2">
          <Users size={13} className="shrink-0 text-text-muted" />
          <div className="flex items-center rounded-2xl border border-border bg-white/75 shadow-[0_4px_12px_rgba(23,50,77,0.06)] overflow-hidden">
            <button
              onClick={() => setPassengers(passengers - 1)}
              disabled={passengers <= 1}
              className="w-11 h-10 flex items-center justify-center text-text-muted hover:text-indigo hover:bg-indigo-soft disabled:opacity-25 transition-colors active:scale-95 text-lg font-light"
            >
              −
            </button>
            <span className="px-3 text-sm font-medium text-text-primary tabular-nums select-none border-x border-border">
              {passengers} {passengers === 1 ? 'traveler' : 'travelers'}
            </span>
            <button
              onClick={() => setPassengers(passengers + 1)}
              disabled={passengers >= 9}
              className="w-11 h-10 flex items-center justify-center text-text-muted hover:text-indigo hover:bg-indigo-soft disabled:opacity-25 transition-colors active:scale-95 text-lg font-light"
            >
              +
            </button>
          </div>
        </div>
        </div>

      {/* Trip progress strip — visible once the user has at least 1 leg */}
      {stopCount > 0 && (
        <div className="px-4 pb-3 border-b border-border/50 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] text-text-muted uppercase tracking-wide">Trip so far</p>
            <span className="font-mono text-orange text-xs font-bold">{formatPrice(tripTotal)}</span>
          </div>
          <TripTimeline legs={legs} highlightLast />
        </div>
      )}

      {/* Stops filter tabs */}
      {!isSearchingFlights && pendingFlights.length > 0 && (
        <div className="px-4 pb-3 shrink-0">
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {filterTabs.map((tab) =>
              tab.count === 0 ? null : (
                <button
                  key={tab.label}
                  onClick={() => setStopsFilter(tab.value)}
                  className={`shrink-0 flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-semibold transition-all border ${
                    stopsFilter === tab.value
                      ? 'bg-indigo text-white border-indigo shadow-[0_4px_12px_rgba(55,48,163,0.25)]'
                      : 'bg-white/80 text-text-secondary border-border hover:border-indigo-border hover:text-indigo'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.minPrice !== null && (
                    <span className={`font-mono text-[11px] ${stopsFilter === tab.value ? 'text-white/80' : 'text-orange'}`}>
                      from {formatPrice(tab.minPrice)}
                    </span>
                  )}
                </button>
              )
            )}
          </div>
        </div>
      )}

      </div>{/* end left panel */}

      {/* Right panel: results */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-8 lg:px-6">
        {/* Error */}
        {flightError && !isSearchingFlights && (
          <div className="card mb-4">
            <p className="text-text-primary font-semibold text-sm mb-1">Hmm, something went wrong</p>
            <p className="text-text-muted text-sm mb-4 leading-6">
              Couldn&apos;t reach the flights service. Check your connection and try again — deals are still out there!
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => currentIata && search(currentIata, localDate)}
                className="btn-primary py-2.5 px-4 text-sm flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} /> Try again
              </button>
              <button onClick={handleBack} className="btn-outline py-2.5 px-4 text-sm w-auto">
                Go back
              </button>
            </div>
          </div>
        )}

        {/* No results */}
        {!isSearchingFlights && !flightError && pendingFlights.length === 0 && (
          <div className="card mb-4">
            <p className="text-text-primary font-semibold text-sm mb-1">No flights on this date — rare!</p>
            <p className="text-text-muted text-sm mb-4 leading-6">
              The best deals often hide mid-week. Try shifting a day — you might be surprised.
            </p>
            <div className="flex gap-2">
              <button onClick={() => shiftDate(-1)} className="btn-outline py-2.5 px-4 text-sm w-auto flex-1">
                ← Day before
              </button>
              <button onClick={() => shiftDate(1)} className="btn-primary py-2.5 px-4 text-sm flex-1">
                Day after →
              </button>
            </div>
          </div>
        )}

        {/* Filter yields no results — stops filter */}
        {!isSearchingFlights && totalFlights === 0 && pendingFlights.length > 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-text-muted mb-2">No {stopsFilter === 0 ? 'direct' : '1-stop'} flights on this date.</p>
            <button
              onClick={() => setStopsFilter(stopsFilter === 0 ? 1 : 0)}
              className="text-sm text-indigo font-medium hover:underline"
            >
              Try {stopsFilter === 0 ? '1-stop' : 'direct'} flights instead
            </button>
          </div>
        )}

        {/* Few results notice */}
        {!isSearchingFlights && totalFlights > 0 && totalFlights < 3 && (
          <p className="text-xs text-text-muted mb-3 px-1">
            Only {totalFlights} {stopsFilter === 0 ? 'direct ' : '1-stop '}option{totalFlights > 1 ? 's' : ''} on this date. Try a different day for more.
          </p>
        )}

        {/* Loading hint */}
        {isSearchingFlights && (
          <p className="text-center text-sm text-text-muted mb-3 animate-pulse">
            Finding your next adventure...
          </p>
        )}

        {/* Loading skeletons */}
        {isSearchingFlights && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <FlightCardSkeleton key={i} />)}
          </div>
        )}

        {/* Grouped results by country (cheapest country first, expanded by default) */}
        {!isSearchingFlights && countryGroups.length > 0 && (
          <div className="space-y-3">
            {countryGroups.map((group, index) => {
              const expanded = isCountryExpanded(group.country, index);
              const headerId = `country-${group.country.replace(/\s+/g, '-')}-header`;
              const panelId = `country-${group.country.replace(/\s+/g, '-')}-panel`;
              return (
                <section
                  key={group.country}
                  className="bg-surface border border-border rounded-2xl overflow-hidden shadow-[0_4px_12px_rgba(15,23,42,0.05)]"
                >
                  <button
                    id={headerId}
                    type="button"
                    onClick={() => toggleCountryExpanded(group.country, index)}
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-indigo-soft/40 transition-colors"
                  >
                    <ChevronDown
                      size={18}
                      className={`text-text-muted shrink-0 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`}
                    />
                    <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
                      <span className="text-base font-bold text-text-primary truncate">
                        {group.country}
                      </span>
                      <span className="text-xs text-text-muted">
                        {group.flights.length} flight{group.flights.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[10px] uppercase tracking-wide text-text-muted leading-none">from</div>
                      <div className="font-mono text-orange font-bold text-base leading-tight">
                        {formatPrice(group.minPrice)}
                      </div>
                    </div>
                  </button>

                  {expanded && (
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={headerId}
                      className="px-2 pb-2 pt-1 space-y-2 border-t border-border/60 bg-surface-2/30"
                    >
                      {group.flights.map((flight) => (
                        <FlightCard
                          key={flight.flightId}
                          flight={flight}
                          weather={weatherMap[flight.destinationIata]}
                          onSelect={handleSelect}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {/* "Try next day" nudge shown after results load */}
        {!isSearchingFlights && totalFlights > 0 && (
          <button
            onClick={() => shiftDate(1)}
            className="w-full mt-4 py-3 flex items-center justify-center gap-2 text-text-muted text-sm hover:text-indigo transition-colors"
          >
            <span>Nothing fitting?</span>
            <span className="text-orange font-medium flex items-center gap-1">
              Try next day <ChevronRight size={14} />
            </span>
          </button>
        )}

        {/* Head home — available from the 2nd stop onwards */}
        {stopCount > 0 && (
          <div className="mt-6 pt-5 border-t border-border/50">
            <button
              onClick={() => navigate('/return')}
              className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-white/86 border border-border hover:border-indigo-border hover:bg-indigo-soft group shadow-[0_10px_22px_rgba(23,50,77,0.05)] transition-all"
            >
              <div className="text-left">
                <p className="text-sm font-medium text-text-primary group-hover:text-indigo transition-colors">
                  Head home
                </p>
                <p className="text-xs text-text-muted">Find flights back · trip total {formatPrice(tripTotal)}</p>
              </div>
              <Home size={18} className="text-text-muted group-hover:text-indigo transition-colors shrink-0" />
            </button>
          </div>
        )}
      </div>

      {/* Calendar overlay */}
      {showCalendar && (
        <DatePickerOverlay
          currentDate={localDate}
          legs={legs}
          onConfirm={handleDateConfirm}
          onClose={() => setShowCalendar(false)}
        />
      )}
    </div>
  );
}
