import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { FlightOption } from '@fast-travel/shared';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useTripStore } from '../store/trip.store';
import { useSessionStore } from '../store/session.store';
import { useFlightsStore, flightsUiKey, DEFAULT_UI } from '../store/flights.store';
import { useFlightResults } from '../hooks/useFlightResults';
import { useWeatherBatch } from '../hooks/useWeatherBatch';
import { FlightCardSkeleton } from '../components/FlightCard';
import { DatePickerOverlay } from '../components/DatePickerOverlay';
import { MapErrorBoundary } from '../components/MapErrorBoundary';
import { buildDirectDestinations, type DirectDestination } from '../components/FlightFanMap';
import { CountryGroup } from '../components/CountryGroup';
import { formatDate } from '../utils/date.utils';
import { formatPrice } from '../utils/price.utils';
import { countryDisplayName } from '../utils/country.utils';
import { ChevronLeft, ChevronRight, RefreshCw, ArrowLeft } from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';

const FlightFanMap = lazy(() =>
  import('../components/FlightFanMap').then((m) => ({ default: m.FlightFanMap })),
);

export function FlightResultsScreen() {
  const navigate = useNavigate();
  const origin = useTripStore((s) => s.origin);
  const legs = useTripStore((s) => s.legs);
  const { selectedDate, setSelectedDate, setSelectedFlight } = useSessionStore();
  const { flights: pendingFlights, isLoading: isSearchingFlights, error: flightError, search, refetch } = useFlightResults();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [localDate, setLocalDate] = useState(selectedDate ?? format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [showCalendar, setShowCalendar] = useState(false);

  const lastOutboundLeg = legs.filter((l) => !l.isReturn).at(-1);
  const currentIata = lastOutboundLeg?.destinationIata ?? origin?.iata ?? '';
  const currentCityName = lastOutboundLeg?.destinationCity ?? origin?.city.name ?? '';

  useWeatherBatch(pendingFlights, localDate);

  useEffect(() => {
    if (!currentIata || !localDate) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(currentIata, localDate);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [currentIata, localDate, search]);

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

  const groupRefs = useRef<Record<string, HTMLElement | null>>({});
  const mainRef = useRef<HTMLElement | null>(null);

  // UI state (expanded country, popup pin, "user touched" flag) lives in the
  // store keyed by (iata, date) so it survives screen remounts and date
  // toggles back to a previously-visited combination.
  const uiKey = currentIata && localDate ? flightsUiKey(currentIata, localDate) : null;
  const ui = useFlightsStore((s) => (uiKey ? s.ui[uiKey] ?? DEFAULT_UI : DEFAULT_UI));
  const updateUi = useFlightsStore((s) => s.updateUi);
  const setUi = (patch: Partial<typeof DEFAULT_UI>) => {
    if (uiKey) updateUi(uiKey, patch);
  };
  const expandedCountry = ui.expandedCountry;

  const outboundLegs = legs.filter((l) => !l.isReturn);
  const stopCount = outboundLegs.length;
  const isFirstStop = stopCount === 0;

  // Direct destinations (one pin per IATA) for the map.
  const directDestinations = useMemo<DirectDestination[]>(
    () => buildDirectDestinations(pendingFlights.filter((f) => f.stops === 0)),
    [pendingFlights],
  );

  // Resolve the popup pin from the stored IATA against the current dataset.
  // Stale entries (e.g. iata not in the new direct list) gracefully resolve to null.
  const popupDest = useMemo<DirectDestination | null>(() => {
    if (!ui.popupDestIata) return null;
    return directDestinations.find((d) => d.iata === ui.popupDestIata) ?? null;
  }, [ui.popupDestIata, directDestinations]);
  const setPopupDest = (d: DirectDestination | null) =>
    setUi({ popupDestIata: d?.iata ?? null });

  // Group flights by destination country; sort each group by price; sort groups
  // by their cheapest flight ascending so the overall best deal leads.
  const countryGroups = useMemo(() => {
    const buckets = new Map<string, FlightOption[]>();
    for (const f of pendingFlights) {
      const key = countryDisplayName(f.destinationCountry?.trim() || '') || 'Other';
      const list = buckets.get(key) ?? [];
      list.push(f);
      buckets.set(key, list);
    }
    const groups = Array.from(buckets.entries()).map(([country, flights]) => {
      const sorted = [...flights].sort((a, b) => a.priceUsd - b.priceUsd);
      const cities = new Set(sorted.map((f) => f.destinationIata));
      return {
        country,
        flights: sorted,
        minPrice: sorted[0].priceUsd,
        cityCount: cities.size,
      };
    });
    return groups.sort((a, b) => {
      if (a.country === 'Other' && b.country !== 'Other') return 1;
      if (b.country === 'Other' && a.country !== 'Other') return -1;
      return a.minPrice - b.minPrice;
    });
  }, [pendingFlights]);

  const cheapestCountry = countryGroups[0]?.country ?? null;
  const globalMinPrice = countryGroups[0]?.minPrice ?? null;

  // Track the cheapest country until the user manually toggles. Re-anchors
  // when new data shifts which country is cheapest.
  useEffect(() => {
    if (!uiKey) return;
    if (ui.userTouched) return;
    if (!cheapestCountry) return;
    if (ui.expandedCountry === cheapestCountry) return;
    updateUi(uiKey, { expandedCountry: cheapestCountry });
  }, [cheapestCountry, uiKey, ui.userTouched, ui.expandedCountry, updateUi]);

  function scrollMainToCountry(country: string) {
    const node = groupRefs.current[country];
    const main = mainRef.current;
    if (!node || !main) return;
    const target = node.offsetTop - 8;
    const prefersReduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    main.scrollTo({ top: target, behavior: prefersReduce ? 'auto' : 'smooth' });
  }

  // Country accordion cycle: collapsed → expanded+highlighted → expanded+popup → collapsed.
  // Popup pin is the cheapest IATA within the country (lookup below).
  function toggleCountry(country: string) {
    if (expandedCountry !== country) {
      setUi({ expandedCountry: country, popupDestIata: null, userTouched: true });
      return;
    }
    if (!popupDest || popupDest.country !== country) {
      const inCountry = directDestinations.filter((d) => d.country === country);
      const cheapestInCountry = inCountry.length === 0
        ? null
        : inCountry.reduce((a, b) => (a.minPriceUsd <= b.minPriceUsd ? a : b));
      setUi({ popupDestIata: cheapestInCountry?.iata ?? null, userTouched: true });
      return;
    }
    setUi({ expandedCountry: null, popupDestIata: null, userTouched: true });
  }

  function handleSelectDestination(dest: DirectDestination) {
    const country = dest.country || 'Other';
    // Tapping a pin shows the popup for THAT specific city — not the cheapest
    // city in its country — so multi-city countries (Italy, Türkiye) don't
    // mis-attribute the price.
    setUi({ expandedCountry: country, popupDestIata: dest.iata, userTouched: true });
    requestAnimationFrame(() => scrollMainToCountry(country));
  }

  function cheapestDirectFor(iata: string): FlightOption | null {
    let best: FlightOption | null = null;
    for (const f of pendingFlights) {
      if (f.stops !== 0) continue;
      if (f.destinationIata !== iata) continue;
      if (!best || f.priceUsd < best.priceUsd) best = f;
    }
    return best;
  }

  // Popup CTA → commit directly. No intermediate confirm modal; the popup
  // *is* the confirmation surface.
  function handleChooseDestination(dest: DirectDestination) {
    const flight = cheapestDirectFor(dest.iata);
    if (!flight) return;
    setPopupDest(null);
    handleSelect(flight);
  }

  function handleBack() {
    navigate(isFirstStop ? '/' : '/review');
  }

  const title = isFirstStop
    ? `Flights from ${currentCityName} · FlexBook`
    : `Next hop from ${currentCityName} · FlexBook`;

  const backLabel = isFirstStop ? 'Change search' : 'Back to plan';
  const eyebrow = isFirstStop ? 'Cheapest flights from' : 'Next hop from';

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden">
      <Helmet><title>{title}</title></Helmet>

      <aside className="shrink-0 lg:w-[440px] xl:w-[500px] flex flex-col border-b lg:border-b-0 lg:border-r border-border min-h-0">
        <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-3 shrink-0">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-indigo transition-colors mb-2 min-h-[32px]"
          >
            <ArrowLeft size={14} />
            <span>{backLabel}</span>
          </button>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-mid mb-1">
            {eyebrow}
          </p>
          <h1 className="text-lg lg:text-xl font-black tracking-[-0.02em] text-text-primary leading-tight">
            Cheapest flights from {currentCityName}
          </h1>

          {/* Context strip */}
          <div className="mt-3 flex items-stretch gap-2">
            <div className="flex-1 min-w-0 rounded-xl border border-border bg-white px-3 py-2">
              <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted">From</div>
              <div className="flex items-baseline gap-1.5 min-w-0">
                <span className="font-mono text-sm font-black text-indigo">{currentIata}</span>
                <span className="text-xs text-text-secondary truncate">{currentCityName}</span>
              </div>
            </div>

            <div className="shrink-0 inline-flex items-stretch rounded-xl border border-border bg-white overflow-hidden">
              <button
                onClick={() => shiftDate(-1)}
                className="w-11 sm:w-9 flex items-center justify-center text-text-muted hover:text-indigo hover:bg-indigo-soft transition-colors min-h-[44px]"
                aria-label="Previous day"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setShowCalendar(true)}
                className="px-2.5 flex flex-col items-center justify-center border-x border-border min-h-[44px] hover:bg-indigo-soft/50 transition-colors"
              >
                <span className="text-[9px] uppercase tracking-[0.16em] text-text-muted leading-none">Date</span>
                <span className="text-xs font-semibold text-text-primary mt-0.5 whitespace-nowrap">
                  {localDate ? formatDate(localDate) : 'Pick'}
                </span>
              </button>
              <button
                onClick={() => shiftDate(1)}
                className="w-11 sm:w-9 flex items-center justify-center text-text-muted hover:text-indigo hover:bg-indigo-soft transition-colors min-h-[44px]"
                aria-label="Next day"
              >
                <ChevronRight size={16} />
              </button>
            </div>

          </div>

          {/* Direct-routes count for this (origin, date) pair. Lives next to
              the date strip — same context, no longer floating over the map. */}
          {directDestinations.length > 0 && (
            <p className="mt-2 text-[11px] text-text-muted">
              <span className="font-semibold text-indigo">{directDestinations.length}</span>{' '}
              direct {directDestinations.length === 1 ? 'route' : 'routes'} on{' '}
              <span className="text-text-secondary">{formatDate(localDate)}</span>
            </p>
          )}
        </div>

        {/* Map region */}
        <div className="mx-4 mb-4 h-[220px] lg:flex-1 lg:min-h-0 lg:mx-6 lg:mb-6 rounded-2xl border border-border overflow-hidden bg-[#EEF1F8]">
          {origin && directDestinations.length > 0 ? (
            <MapErrorBoundary>
              <Suspense
                fallback={
                  <div className="h-full flex items-center justify-center text-text-muted text-xs animate-pulse">
                    Loading map…
                  </div>
                }
              >
                <FlightFanMap
                  origin={{ ...origin, city: { ...origin.city, name: currentCityName } }}
                  destinations={directDestinations}
                  onSelectDestination={handleSelectDestination}
                  onChooseDestination={handleChooseDestination}
                  highlightedCountry={expandedCountry}
                  popupDest={popupDest}
                  onPopupClose={() => setPopupDest(null)}
                />
              </Suspense>
            </MapErrorBoundary>
          ) : (
            <div className="h-full flex items-center justify-center text-text-muted text-xs">
              {isSearchingFlights ? 'Mapping routes…' : 'No direct routes to plot yet.'}
            </div>
          )}
        </div>
      </aside>

      <main
        ref={mainRef}
        className="flex-1 min-w-0 overflow-y-auto px-4 lg:px-6 py-4 lg:py-6"
      >
        {/* Sub-header captions */}
        {!isSearchingFlights && countryGroups.length > 0 && (
          <div className="flex items-baseline justify-between mb-3 px-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              Destinations · {countryGroups.length} countr{countryGroups.length === 1 ? 'y' : 'ies'}
            </p>
            {globalMinPrice != null && (
              <p className="text-[11px] text-text-muted">
                From{' '}
                <span className="font-mono text-orange font-bold">
                  {formatPrice(globalMinPrice)}
                </span>
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {flightError && !isSearchingFlights && (
          <div className="card mb-4">
            <p className="text-text-primary font-semibold text-sm mb-1">Hmm, something went wrong</p>
            <p className="text-text-muted text-sm mb-4 leading-6">
              Couldn&apos;t reach the flights service. Check your connection and try again — deals are still out there!
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => currentIata && refetch(currentIata, localDate)}
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

        {/* Loading skeletons */}
        {isSearchingFlights && (
          <>
            <p className="text-center text-sm text-text-muted mb-3 animate-pulse">
              Finding your next adventure...
            </p>
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <FlightCardSkeleton key={i} />)}
            </div>
          </>
        )}

        {/* Country accordions */}
        {!isSearchingFlights && countryGroups.length > 0 && (
          <div className="space-y-3">
            {countryGroups.map((group) => (
              <CountryGroup
                key={group.country}
                ref={(el) => { groupRefs.current[group.country] = el; }}
                country={group.country}
                flights={group.flights}
                minPrice={group.minPrice}
                cityCount={group.cityCount}
                expanded={expandedCountry === group.country}
                onToggle={() => toggleCountry(group.country)}
                onSelectFlight={handleSelect}
              />
            ))}
          </div>
        )}

        {/* Try next day nudge */}
        {!isSearchingFlights && pendingFlights.length > 0 && (
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
      </main>

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
