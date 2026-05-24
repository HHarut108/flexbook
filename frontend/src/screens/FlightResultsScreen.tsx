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
import { VisaCheckPopup } from '../components/visa/VisaCheckPopup';
import { useCurrentPassport } from '../hooks/useCurrentPassport';
import { useVisaCountries, resolveCountryCode } from '../hooks/useVisaCountries';
import { useVisaRequirements } from '../hooks/useVisaRequirements';
import { useAuthStore } from '../store/auth.store';
import { formatDate } from '../utils/date.utils';
import { formatPrice } from '../utils/price.utils';
import { countryDisplayName } from '../utils/country.utils';
import { ChevronLeft, ChevronRight, RefreshCw, ArrowLeft, List as ListIcon, Map as MapIcon, ShieldCheck } from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';

const VIEW_TAB_KEY = 'flexbook.flightResults.view';

type ViewTab = 'list' | 'map';

function readStoredView(): ViewTab {
  if (typeof window === 'undefined') return 'list';
  try {
    const v = window.localStorage.getItem(VIEW_TAB_KEY);
    return v === 'map' ? 'map' : 'list';
  } catch {
    return 'list';
  }
}

function persistView(tab: ViewTab) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(VIEW_TAB_KEY, tab);
  } catch {
    /* localStorage unavailable */
  }
}

const ORDINALS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
  'eleventh',
  'twelfth',
  'thirteenth',
  'fourteenth',
  'fifteenth',
];

function ordinalLabel(stopCount: number): string {
  // stopCount = 0 → leg #1 ("first"); stopCount = n → leg #n+1.
  const idx = Math.min(stopCount, ORDINALS.length - 1);
  return ORDINALS[idx];
}

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
  const [view, setView] = useState<ViewTab>(() => readStoredView());
  // null = closed; otherwise the initial step to open the popup on. The
  // expiry-reminder's "Create an account" link jumps straight into 'signup',
  // the rest start at 'pick'.
  const [visaPopupMode, setVisaPopupMode] = useState<'pick' | 'signup' | null>(null);

  function switchView(next: ViewTab) {
    setView(next);
    persistView(next);
  }

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
  // Cities are keyed by normalized name (a city can have multiple airports —
  // Istanbul = IST + SAW, Rome = FCO + CIA — and we don't want to double-count).
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
      const cities = new Set(sorted.map((f) => f.destinationCity.trim().toLowerCase()));
      const airports = new Set(sorted.map((f) => f.destinationIata));
      return {
        country,
        flights: sorted,
        minPrice: sorted[0].priceUsd,
        cityCount: cities.size,
        airportCount: airports.size,
      };
    });
    return groups.sort((a, b) => {
      if (a.country === 'Other' && b.country !== 'Other') return 1;
      if (b.country === 'Other' && a.country !== 'Other') return -1;
      return a.minPrice - b.minPrice;
    });
  }, [pendingFlights]);

  // Top-level totals across the whole results page. Cities are scoped by
  // country so that same-name cities in different countries (e.g. Springfield
  // US vs UK) don't accidentally merge.
  const totals = useMemo(() => {
    const cities = new Set<string>();
    const airports = new Set<string>();
    const countries = new Set<string>();
    for (const f of pendingFlights) {
      const country = countryDisplayName(f.destinationCountry?.trim() || '') || 'Other';
      cities.add(`${country}|${f.destinationCity.trim().toLowerCase()}`);
      airports.add(f.destinationIata);
      countries.add(country);
    }
    return { cityCount: cities.size, airportCount: airports.size, countryCount: countries.size };
  }, [pendingFlights]);

  const cheapestCountry = countryGroups[0]?.country ?? null;
  const globalMinPrice = countryGroups[0]?.minPrice ?? null;

  // Visa requirements: load the supported-countries list once (so we can map
  // each accordion's display name back to an ISO-2 code), then fetch the
  // requirement per (passport, destination). Both the proxy and this hook
  // cache, so repeated renders are cheap.
  const { loaded: visaCountriesLoaded } = useVisaCountries();
  const { passport, source: passportSource, sessionExpiresAt } = useCurrentPassport();
  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.loading);
  const hasPassport = !!passport && passportSource !== 'none';
  // Guest with a live session passport → show the "saved for Xh, sign up to
  // keep it" nudge below the tabs/CTA row. Use a dummy tick to force a
  // re-render every minute; reading Date.now() directly during render keeps
  // the displayed hour count in sync with the actual remaining time without
  // depending on a stale captured-at-mount timestamp.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!sessionExpiresAt) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, [sessionExpiresAt]);
  const sessionHoursLeft = sessionExpiresAt
    ? Math.max(0, Math.ceil((sessionExpiresAt - Date.now()) / 3_600_000))
    : null;
  const showGuestExpiryNote =
    !isAuthLoading &&
    !user &&
    passportSource === 'session' &&
    sessionHoursLeft !== null &&
    sessionHoursLeft > 0;
  const countryCodes = useMemo(
    () =>
      visaCountriesLoaded
        ? countryGroups.map((g) => (g.country === 'Other' ? null : resolveCountryCode(g.country)))
        : countryGroups.map(() => null),
    [countryGroups, visaCountriesLoaded],
  );
  const visaResults = useVisaRequirements(passport, countryCodes);

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
  // Per-leg ordinal note rendered as a small label in the aside (replaces the
  // step label that used to live in the global ProgressBar header).
  const legOrdinal = ordinalLabel(stopCount);
  const legNote = isFirstStop
    ? 'Choosing your first destination'
    : `Choosing your ${legOrdinal} destination`;
  // Headline above the From card. On leg 1 we drop the city name entirely
  // (the From card itself shows it). On later legs we keep a tight
  // "Next hop · cheapest flights" — the city is again redundant.
  const headline = isFirstStop
    ? 'Cheapest flights'
    : 'Next hop · cheapest flights';

  // Visa CTA shows only when we can plausibly look up requirements (countries
  // list loaded, results in view) AND the user hasn't picked a passport yet.
  // We don't show it while auth is still resolving because the user might be
  // about to be recognized as signed in with a profile passport.
  const showVisaCta =
    !isAuthLoading &&
    !hasPassport &&
    !isSearchingFlights &&
    countryGroups.length > 0;

  // Resolve the visa requirement for the country the map popup is open on, so
  // the popup can render the same VisaPill the list shows.
  const popupVisaCode = popupDest?.country && visaCountriesLoaded
    ? resolveCountryCode(popupDest.country)
    : null;
  const popupVisaEntry = popupVisaCode ? visaResults[popupVisaCode] : undefined;
  const popupVisa = popupVisaEntry?.status === 'ok' ? popupVisaEntry.data : undefined;
  const popupVisaLoading = !!passport && popupVisaEntry?.status === 'loading';

  // Map block reused in both the desktop aside and the mobile Map tab — same
  // wiring, different containers.
  const mapBlock = (
    <>
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
              popupVisa={popupVisa}
              popupVisaLoading={popupVisaLoading}
            />
          </Suspense>
        </MapErrorBoundary>
      ) : (
        <div className="h-full flex items-center justify-center text-text-muted text-xs">
          {isSearchingFlights ? 'Mapping routes…' : 'No direct routes to plot yet.'}
        </div>
      )}
    </>
  );

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
          {/* Per-leg ordinal note (was previously the global progress-bar label) */}
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-mid mb-1">
            {legNote}
          </p>
          <h1 className="text-lg lg:text-xl font-black tracking-[-0.02em] text-text-primary leading-tight">
            {headline}
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

          {/* Single dynamic sentence summarising what's on offer for this
              (origin, date) pair: lowest price, plus city / airport / country
              coverage. Cities and airports are tracked separately because a
              single city can have multiple airports (Istanbul = IST + SAW) —
              collapsing them into one "destinations" number inflates the
              count whenever a route is served by two airports. Reads cleanly
              at mobile widths (one short line) and on desktop (sits under
              the date stepper), so we don't repeat "From $X" elsewhere. */}
          {totals.cityCount > 0 && (
            <p className="mt-2 text-[11px] text-text-muted">
              {globalMinPrice != null && (
                <>
                  From{' '}
                  <span className="font-mono text-orange font-bold text-sm">
                    {formatPrice(globalMinPrice)}
                  </span>
                  {' · '}
                </>
              )}
              <span className="font-semibold text-indigo">{totals.cityCount}</span>{' '}
              {totals.cityCount === 1 ? 'city' : 'cities'} ·{' '}
              <span className="text-text-secondary">{totals.airportCount}</span>{' '}
              {totals.airportCount === 1 ? 'airport' : 'airports'} ·{' '}
              <span className="text-text-secondary">{totals.countryCount}</span>{' '}
              {totals.countryCount === 1 ? 'country' : 'countries'}
            </p>
          )}
        </div>

        {/* Desktop map — restored to the aside so the list and map are visible
            side-by-side without needing the mobile tabs UX. Hidden on mobile;
            mobile uses the List/Map tabs in <main> instead. */}
        <div className="hidden lg:block flex-1 min-h-0 mx-6 mb-6 rounded-2xl border border-border overflow-hidden bg-[#EEF1F8]">
          {mapBlock}
        </div>
      </aside>

      <main
        ref={mainRef}
        className="flex-1 min-w-0 overflow-y-auto px-4 lg:px-6 py-4 lg:py-6"
      >
        {/* Tabs row: mobile-only. Desktop shows the map in the aside, so the
            list is the only thing in <main> and the toggle is unnecessary.
            Price + coverage now live in the single aside sentence, so no
            "From $X" duplicate rides along here. */}
        {!isSearchingFlights && countryGroups.length > 0 && (
          <div className="lg:hidden flex items-center justify-start gap-3 mb-3 px-0.5">
            <div
              role="tablist"
              aria-label="Result view"
              className="inline-flex items-center rounded-full border border-border bg-surface p-0.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={view === 'list'}
                onClick={() => switchView('list')}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors min-h-[36px] ${
                  view === 'list'
                    ? 'bg-indigo text-white shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <ListIcon size={13} /> List view
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'map'}
                onClick={() => switchView('map')}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors min-h-[36px] ${
                  view === 'map'
                    ? 'bg-indigo text-white shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <MapIcon size={13} /> Map view
              </button>
            </div>
          </div>
        )}

        {/* Visa CTA / status — guests & logged-in-without-citizenship see the
            CTA that opens the popup; once a passport is set the per-route
            chips render on the country accordions below. */}
        {showVisaCta && (
          <button
            type="button"
            onClick={() => setVisaPopupMode('pick')}
            className="w-full mb-3 inline-flex items-center justify-between gap-3 rounded-2xl border border-indigo-border bg-indigo-soft/40 hover:bg-indigo-soft/60 transition-colors px-3.5 py-2.5 text-left"
          >
            <span className="inline-flex items-center gap-2 min-w-0">
              <span className="w-7 h-7 rounded-full bg-indigo/10 flex items-center justify-center shrink-0">
                <ShieldCheck size={14} className="text-indigo" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-text-primary leading-tight">
                  Check visa requirements
                </span>
                <span className="block text-[11px] text-text-muted leading-tight">
                  Pick your citizenship to see visa status per route.
                </span>
              </span>
            </span>
            <ChevronRight size={16} className="text-indigo shrink-0" />
          </button>
        )}

        {/* Guest expiry reminder — the session passport TTL is the conversion
            hook. We surface how much time is left and pair it with a sign-up
            link framed around personalisation, not "keeping" anything (the
            user obviously doesn't lose their actual citizenship). Signed-in
            users never see this (their profile is the source of truth). */}
        {showGuestExpiryNote && (
          <div className="w-full mb-3 inline-flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 dark:bg-amber-900/20 dark:border-amber-700/40">
            <span className="inline-flex items-center gap-2 min-w-0">
              <span className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-800/40 flex items-center justify-center shrink-0">
                <ShieldCheck size={14} className="text-amber-700 dark:text-amber-300" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-text-primary leading-tight">
                  Saved for {sessionHoursLeft}h
                </span>
                <span className="block text-[11px] text-text-muted leading-tight">
                  <button
                    type="button"
                    onClick={() => setVisaPopupMode('signup')}
                    className="text-indigo font-semibold hover:underline"
                  >
                    Sign up
                  </button>
                  {' '}for personalized recommendations.
                </span>
              </span>
            </span>
            <button
              type="button"
              onClick={() => setVisaPopupMode('pick')}
              className="text-[11px] font-semibold text-text-muted hover:text-indigo shrink-0"
            >
              change
            </button>
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

        {/* List view — country accordions. Always shown on desktop; on mobile
            only when the List tab is active. */}
        {!isSearchingFlights && countryGroups.length > 0 && (
          <div className={`space-y-3 ${view === 'list' ? '' : 'hidden'} lg:block`}>
            {countryGroups.map((group, idx) => {
              const code = countryCodes[idx];
              const entry = code ? visaResults[code] : undefined;
              const visa = entry?.status === 'ok' ? entry.data : undefined;
              const visaLoading = !!passport && entry?.status === 'loading';
              return (
                <CountryGroup
                  key={group.country}
                  ref={(el) => {
                    groupRefs.current[group.country] = el;
                  }}
                  country={group.country}
                  flights={group.flights}
                  minPrice={group.minPrice}
                  cityCount={group.cityCount}
                  airportCount={group.airportCount}
                  expanded={expandedCountry === group.country}
                  onToggle={() => toggleCountry(group.country)}
                  onSelectFlight={handleSelect}
                  visa={visa}
                  visaLoading={visaLoading}
                />
              );
            })}
          </div>
        )}

        {/* Map view — mobile-only. Desktop renders the map in the aside. */}
        {!isSearchingFlights && view === 'map' && countryGroups.length > 0 && (
          <div className="lg:hidden rounded-2xl border border-border overflow-hidden bg-[#EEF1F8] h-[60vh] min-h-[360px]">
            {mapBlock}
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

      {/* Visa-requirements popup */}
      {visaPopupMode && (
        <VisaCheckPopup
          onClose={() => setVisaPopupMode(null)}
          initialMode={visaPopupMode}
        />
      )}
    </div>
  );
}
