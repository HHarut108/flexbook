import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAirportIndex, resolveMarkerInIndex } from '../lib/airportIndex';
import axios from 'axios';
import { FlightOption, LocationSelection, selectionLabel, selectionToMarker } from '@fast-travel/shared';
import { format, addDays, addMonths, endOfMonth, startOfMonth } from 'date-fns';
import { ArrowLeft, ArrowRight, ExternalLink, Loader2, PlaneTakeoff, TrendingDown } from 'lucide-react';
import { MarketingShellV2 } from '../components/MarketingShellV2';
import { AirportSearchInput } from '../components/AirportSearchInput';
import { V2ToolHero } from '../components/V2ToolHero';
import { MobileViewToggle, type MobileView } from '../components/MobileViewToggle';
import { persistSelectedTrip } from '../lib/selectedTrip';
import { buildKiwiRoundTripSearchUrl } from '../utils/kiwi.utils';
// Leaflet map + DateRangePicker calendar — both below-the-fold or
// conditionally rendered, both lazy so the form ships smaller.
const TripMapColumn = lazy(() =>
  import('../components/TripMapColumn').then((m) => ({ default: m.TripMapColumn })),
);
const DateRangePicker = lazy(() =>
  import('../components/DateRangePicker').then((m) => ({ default: m.DateRangePicker })),
);
import { formatYMD } from '../utils/date.utils';
import { fetchCheapestDay, CheapestDayResponse, CalendarDay } from '../api/whenToGo.api';
import { searchRoundTrip } from '../api/flights.api';
import { track, AnalyticsEvent } from '../lib/analytics';

interface Props {
  onMenuOpen?: () => void;
}

type RangePresetId = 'this-month' | 'next-month' | 'next-90' | 'custom';

interface DateRange {
  id: RangePresetId;
  label: string;
  start: string;
  end: string;
}

function buildPresetRange(id: Exclude<RangePresetId, 'custom'>): DateRange {
  const today = new Date();
  if (id === 'this-month') {
    return {
      id,
      label: 'This month',
      start: formatYMD(today),
      end: formatYMD(endOfMonth(today)),
    };
  }
  if (id === 'next-month') {
    const next = addMonths(today, 1);
    return {
      id,
      label: 'Next month',
      start: formatYMD(startOfMonth(next)),
      end: formatYMD(endOfMonth(next)),
    };
  }
  return {
    id,
    label: 'Next 90 days',
    start: formatYMD(today),
    end: formatYMD(addDays(today, 90)),
  };
}

const PRESETS = [
  buildPresetRange('this-month'),
  buildPresetRange('next-month'),
  buildPresetRange('next-90'),
];

function fmtRange(start: string, end: string): string {
  try {
    const s = format(new Date(start + 'T12:00:00'), 'MMM d');
    const e = format(new Date(end + 'T12:00:00'), 'MMM d');
    return `${s} – ${e}`;
  } catch {
    return `${start} – ${end}`;
  }
}

const FMT_DATE_LONG = (iso: string) => format(new Date(iso + 'T12:00:00'), 'EEE, MMM d, yyyy');
const FMT_DATE_TINY = (iso: string) => format(new Date(iso + 'T12:00:00'), 'MMM d');

function fmtTime(iso: string): string {
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : '';
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Adapt a When-to-Go CalendarDay to the FlightOption shape that the
 * TripDetailsScreen / persistSelectedTrip pipeline expects. The price + booking
 * URL live on CalendarDay, not on the embedded itinerary, so we lift them here.
 */
function calendarDayToFlight(day: CalendarDay): FlightOption | null {
  const it = day.itinerary;
  if (!it) return null;
  return {
    flightId: `wtg-${it.originIata}-${it.destinationIata}-${day.date}`,
    originIata: it.originIata,
    originCity: it.originCity,
    destinationIata: it.destinationIata,
    destinationCity: it.destinationCity,
    destinationCountry: it.destinationCountry,
    destinationLat: it.destinationLat,
    destinationLng: it.destinationLng,
    departureDatetime: it.departureDatetime,
    arrivalDatetime: it.arrivalDatetime,
    durationMinutes: it.durationMinutes,
    airlineName: it.airlineName,
    airlineCode: it.airlineCode,
    stops: it.stops,
    viaIatas: it.viaIatas,
    viaCoords: it.viaCoords,
    priceUsd: day.priceUsd,
    bookingUrl: day.bookingUrl ?? '',
  };
}

export function WhenToGoScreenV2({ onMenuOpen }: Props) {
  const navigate = useNavigate();
  const [destQuery, setDestQuery] = useState('');
  const [destination, setDestination] = useState<LocationSelection | null>(null);
  const [origin, setOrigin] = useState<LocationSelection | null>(null);
  const [originQuery, setOriginQuery] = useState('');
  const [range, setRange] = useState<DateRange>(PRESETS[2]); // default: Next 90 days
  const [customStart, setCustomStart] = useState(formatYMD(new Date()));
  const [customEnd, setCustomEnd] = useState(formatYMD(addDays(new Date(), 30)));
  const [mobileView, setMobileView] = useState<MobileView>('list');
  const [outboundResult, setOutboundResult] = useState<CheapestDayResponse | null>(null);
  const [outboundLoading, setOutboundLoading] = useState(false);
  const [outboundError, setOutboundError] = useState<string | null>(null);
  const [returnResult, setReturnResult] = useState<CheapestDayResponse | null>(null);
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnRangeLabel, setReturnRangeLabel] = useState<string>('');
  const [view, setView] = useState<'search' | 'result'>('search');
  const [roundTripLoading, setRoundTripLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const abortReturnRef = useRef<AbortController | null>(null);

  // URL pre-fill: ?from=EVN&to=MAD&start=2026-06-11&end=2026-06-19 (typically
  // arrived here from the search-results "When to fly" CTA). Resolves the
  // markers against the indexed airports/cities and auto-runs the search.
  const [searchParams] = useSearchParams();
  const didPrefillRef = useRef(false);
  useEffect(() => {
    if (didPrefillRef.current) return;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    if (!from || !to) return;
    didPrefillRef.current = true;
    let cancelled = false;
    getAirportIndex().then((index) => {
      if (cancelled) return;
      const o = resolveMarkerInIndex(index, from);
      const d = resolveMarkerInIndex(index, to);
      if (o) {
        const sel = o as LocationSelection;
        setOrigin(sel);
        setOriginQuery(selectionLabel(sel));
      }
      if (d) {
        const sel = d as LocationSelection;
        setDestination(sel);
        setDestQuery(selectionLabel(sel));
      }
      if (start && end) {
        setRange({ id: 'custom', label: 'Custom range', start, end });
        setCustomStart(start);
        setCustomEnd(end);
      }
      // Defer the actual search until origin + destination have been committed
      // to state — handleSearch reads them through closure, so we trigger from
      // the effect below once both are set.
    });
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  // Auto-search once both endpoints are pre-filled from URL params.
  const didAutoSearchRef = useRef(false);
  useEffect(() => {
    if (didAutoSearchRef.current) return;
    if (!didPrefillRef.current) return;
    if (!origin || !destination) return;
    didAutoSearchRef.current = true;
    void handleSearch();
    // handleSearch is stable enough for one-shot use; React's exhaustive-deps
    // would force us to wrap it in useCallback for no real benefit here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destination]);

  function selectPreset(p: DateRange) {
    setRange(p);
  }

  function selectCustom() {
    setRange({
      id: 'custom',
      label: 'Custom range',
      start: customStart,
      end: customEnd,
    });
  }

  async function handleSearch(
    searchOrigin: LocationSelection | null = origin,
    searchDest: LocationSelection | null = destination,
    searchRange: DateRange = range,
  ) {
    if (!searchOrigin || !searchDest) return;
    const originMarker = selectionToMarker(searchOrigin);
    const destMarker = selectionToMarker(searchDest);
    if (originMarker === destMarker) {
      setOutboundError('Origin and destination must differ.');
      return;
    }
    abortRef.current?.abort();
    abortReturnRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setOutboundLoading(true);
    setOutboundError(null);
    // Reset the return panel — a new outbound direction or window invalidates it.
    setReturnResult(null);
    setReturnError(null);
    setReturnLoading(false);
    setReturnRangeLabel('');
    setView('result');
    track(AnalyticsEvent.WhenToGoSearch, {
      from: originMarker,
      to: destMarker,
      start: searchRange.start,
      end: searchRange.end,
      preset: searchRange.id,
    });
    try {
      const res = await fetchCheapestDay(originMarker, destMarker, searchRange.start, searchRange.end, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setOutboundResult(res);
    } catch (err: unknown) {
      if (axios.isCancel(err)) return;
      const message = err instanceof Error ? err.message : 'Something went wrong fetching the calendar.';
      setOutboundError(message);
    } finally {
      if (!ctrl.signal.aborted) setOutboundLoading(false);
    }
  }

  async function handleReturnSearch(start: string, end: string) {
    if (!origin || !destination) return;
    // Reverse the leg for the fetch, but keep parent origin/destination as-is so
    // the outbound panel stays put — the return result renders alongside it.
    const fetchOrigin = selectionToMarker(destination);
    const fetchDest = selectionToMarker(origin);
    if (fetchOrigin === fetchDest) {
      setReturnError('Origin and destination must differ.');
      return;
    }
    abortReturnRef.current?.abort();
    const ctrl = new AbortController();
    abortReturnRef.current = ctrl;
    setReturnLoading(true);
    setReturnError(null);
    setReturnRangeLabel(fmtRange(start, end));
    track(AnalyticsEvent.WhenToGoSearch, {
      from: fetchOrigin,
      to: fetchDest,
      start,
      end,
      preset: 'custom',
      leg: 'return',
    });
    try {
      const res = await fetchCheapestDay(fetchOrigin, fetchDest, start, end, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setReturnResult(res);
    } catch (err: unknown) {
      if (axios.isCancel(err)) return;
      const message = err instanceof Error ? err.message : 'Something went wrong fetching the return calendar.';
      setReturnError(message);
    } finally {
      if (!ctrl.signal.aborted) setReturnLoading(false);
    }
  }

  function handleOutboundCtaClick() {
    track(AnalyticsEvent.WhenToGoCtaClick, {
      from: origin ? selectionToMarker(origin) : '',
      to: destination ? selectionToMarker(destination) : '',
      date: outboundResult?.cheapest?.date,
      priceUsd: outboundResult?.cheapest?.priceUsd,
      leg: 'outbound',
    });
  }

  function handleReturnCtaClick() {
    track(AnalyticsEvent.WhenToGoCtaClick, {
      from: destination ? selectionToMarker(destination) : '',
      to: origin ? selectionToMarker(origin) : '',
      date: returnResult?.cheapest?.date,
      priceUsd: returnResult?.cheapest?.priceUsd,
      leg: 'return',
    });
  }

  async function handleRoundTripCtaClick() {
    const outDay = outboundResult?.cheapest;
    const retDay = returnResult?.cheapest;
    if (!outDay || !retDay) return;
    const outFlightSeed = calendarDayToFlight(outDay);
    const retFlightSeed = calendarDayToFlight(retDay);
    if (!outFlightSeed || !retFlightSeed) return;

    track(AnalyticsEvent.WhenToGoCtaClick, {
      from: origin ? selectionToMarker(origin) : '',
      to: destination ? selectionToMarker(destination) : '',
      outboundDate: outDay.date,
      outboundPriceUsd: outDay.priceUsd,
      returnDate: retDay.date,
      returnPriceUsd: retDay.priceUsd,
      totalUsd: outFlightSeed.priceUsd + retFlightSeed.priceUsd,
      leg: 'round_trip',
    });

    setRoundTripLoading(true);

    // Try to fetch a bundled round-trip itinerary for these dates so the user
    // ends up on Kiwi's real round-trip deep-link (a single tab, both legs
    // pre-filled). The previous slash-multi-city search URL only had the
    // OUTBOUND date and IATAs parsed by Kiwi's router — From/To stayed empty.
    // Fallback: a /from/to/depart/return/ search URL, which Kiwi *does* parse
    // for the round-trip case.
    let outFlight: FlightOption = outFlightSeed;
    let retFlight: FlightOption = retFlightSeed;
    let totalPriceUsd = outFlightSeed.priceUsd + retFlightSeed.priceUsd;
    let bookingUrl: string | null = null;

    try {
      const pairs = await searchRoundTrip(
        outFlightSeed.originIata,
        outFlightSeed.destinationIata,
        outDay.date,
        retDay.date,
        { passengers: 1, limit: 5 },
      );
      if (pairs.length > 0) {
        // pairs come back sorted cheapest-first.
        const best = pairs[0];
        outFlight = best.outbound;
        retFlight = best.inbound;
        totalPriceUsd = best.priceUsd;
        bookingUrl = best.bookingUrl;
      }
    } catch {
      // Backend failure → fall through to the search-URL fallback.
    }

    if (!bookingUrl) {
      bookingUrl =
        buildKiwiRoundTripSearchUrl(
          outFlight.originIata,
          outFlight.destinationIata,
          outDay.date,
          retDay.date,
          1,
        ) ?? outFlight.bookingUrl;
    }

    const saved = persistSelectedTrip({
      type: 'return',
      passengers: 1,
      flights: [outFlight, retFlight],
      bookings: [
        {
          label: 'Book round trip on Kiwi',
          url: bookingUrl,
        },
      ],
      totalPriceUsd,
    });

    setRoundTripLoading(false);
    // Pass the trip via location state so /trip/:id paints instantly without
    // waiting on sessionStorage (it also writes there for refresh recovery).
    navigate(`/trip/${saved.id}`, { state: { trip: saved } });
  }

  function pickOutboundDay(day: CalendarDay) {
    if (!outboundResult) return;
    setOutboundResult({ ...outboundResult, cheapest: day });
  }

  function pickReturnDay(day: CalendarDay) {
    if (!returnResult) return;
    setReturnResult({ ...returnResult, cheapest: day });
  }

  function handleNewSearch() {
    abortRef.current?.abort();
    abortReturnRef.current?.abort();
    setOutboundLoading(false);
    setReturnLoading(false);
    setOutboundResult(null);
    setReturnResult(null);
    setOutboundError(null);
    setReturnError(null);
    setReturnRangeLabel('');
    setView('search');
  }

  return (
    <MarketingShellV2
      active="when"
      title="When to Go"
      description="Find the cheapest day to fly between any two cities."
      onMenuOpen={onMenuOpen}
    >
      <section className="max-w-6xl xl:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 pt-6 md:pt-14 pb-10">
        {/* Two-column on lg+: [hero + map] left, form right */}
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 lg:gap-10">
          {/* LEFT: hero + (mobile toggle) + map */}
          <div>
            <V2ToolHero
              toolName="When to Go"
              titleLine1="Find the cheapest"
              titleAccent="time"
              subhead="Pick where you want to go — we'll surface the single cheapest day to fly. Change anything and the answer updates live."
            />

            <div className="md:hidden mb-5">
              <MobileViewToggle value={mobileView} onChange={setMobileView} />
            </div>

            <div className={`${mobileView === 'map' ? '' : 'hidden'} md:block`}>
              <Suspense fallback={<div className="aspect-square w-full rounded-2xl bg-surface-muted" aria-hidden />}>
                <TripMapColumn
                  origin={origin}
                  destination={destination}
                />
              </Suspense>
            </div>
          </div>

          {/* RIGHT: form card OR result card (swaps in place) */}
          <div
            className={`bg-surface rounded-[24px] border border-border/60 p-5 md:p-6 ${mobileView === 'list' ? '' : 'hidden'} md:block`}
            style={{ boxShadow: '0 20px 50px -20px rgba(15,23,42,0.18)' }}
          >
            {view === 'search' ? (
              <>
                <FieldLabel>From</FieldLabel>
                <div className="mb-4">
                  <AirportSearchInput
                    value={originQuery}
                    onChange={(v) => {
                      setOriginQuery(v);
                      if (origin) setOrigin(null);
                    }}
                    onSelect={(s) => {
                      setOrigin(s);
                      setOriginQuery(selectionLabel(s));
                    }}
                    placeholder="Origin city or airport"
                    ariaLabel="Origin"
                  />
                </div>

                <FieldLabel>I want to go to</FieldLabel>
                <div className="mb-6">
                  <AirportSearchInput
                    value={destQuery}
                    onChange={(v) => {
                      setDestQuery(v);
                      if (destination) setDestination(null);
                    }}
                    onSelect={(s) => {
                      setDestination(s);
                      setDestQuery(selectionLabel(s));
                    }}
                    placeholder="Destination city or airport"
                    ariaLabel="Destination"
                  />
                </div>

                <FieldLabel>Date range</FieldLabel>
                <div className="flex flex-wrap gap-2 mb-3">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectPreset(p)}
                      className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-all border ${
                        range.id === p.id
                          ? 'bg-text-primary text-bg border-text-primary'
                          : 'bg-surface text-text-secondary border-border hover:bg-surface-2 hover:text-text-primary'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={selectCustom}
                    className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-all border ${
                      range.id === 'custom'
                        ? 'bg-text-primary text-bg border-text-primary'
                        : 'bg-surface text-text-secondary border-border hover:bg-surface-2 hover:text-text-primary'
                    }`}
                  >
                    Custom range
                  </button>
                </div>

                {range.id === 'custom' ? (
                  <div className="mb-5">
                    <Suspense fallback={<div className="h-[260px] rounded-2xl bg-surface-muted" aria-hidden />}>
                      <DateRangePicker
                        dateFrom={customStart}
                        dateTo={customEnd}
                        today={formatYMD(new Date())}
                        label=""
                        fromLabel="Earliest"
                        toLabel="Latest"
                        onChangeFrom={(v) => {
                          setCustomStart(v);
                          setRange((r) => ({ ...r, start: v }));
                        }}
                        onChangeTo={(v) => {
                          setCustomEnd(v);
                          setRange((r) => ({ ...r, end: v }));
                        }}
                      />
                    </Suspense>
                  </div>
                ) : (
                  <p className="text-[11px] text-text-muted mb-5 px-1">
                    Searching {fmtRange(range.start, range.end)}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => handleSearch()}
                  disabled={!origin || !destination || outboundLoading}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-full bg-orange text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-orange-dark transition-all"
                  style={{ boxShadow: '0 14px 32px -10px rgba(249,115,22,0.5)' }}
                >
                  {outboundLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Searching…
                    </>
                  ) : (
                    <>
                      Find cheapest dates
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </>
            ) : (
              <ResultPanel
                outboundLoading={outboundLoading}
                outboundError={outboundError}
                outboundResult={outboundResult}
                returnLoading={returnLoading}
                returnError={returnError}
                returnResult={returnResult}
                originLabel={origin ? selectionLabel(origin) : ''}
                destinationLabel={destination ? selectionLabel(destination) : ''}
                outboundRangeLabel={fmtRange(range.start, range.end)}
                returnRangeLabel={returnRangeLabel}
                roundTripLoading={roundTripLoading}
                onOutboundCtaClick={handleOutboundCtaClick}
                onReturnCtaClick={handleReturnCtaClick}
                onRoundTripCtaClick={handleRoundTripCtaClick}
                onPickOutboundDay={pickOutboundDay}
                onPickReturnDay={pickReturnDay}
                onNewSearch={handleNewSearch}
                onReturnSearch={handleReturnSearch}
              />
            )}
          </div>

        </div>
      </section>
    </MarketingShellV2>
  );
}

interface ResultPanelProps {
  outboundLoading: boolean;
  outboundError: string | null;
  outboundResult: CheapestDayResponse | null;
  returnLoading: boolean;
  returnError: string | null;
  returnResult: CheapestDayResponse | null;
  originLabel: string;
  destinationLabel: string;
  outboundRangeLabel: string;
  returnRangeLabel: string;
  roundTripLoading: boolean;
  onOutboundCtaClick: () => void;
  onReturnCtaClick: () => void;
  onRoundTripCtaClick: () => void;
  onPickOutboundDay: (day: CalendarDay) => void;
  onPickReturnDay: (day: CalendarDay) => void;
  onNewSearch: () => void;
  onReturnSearch: (start: string, end: string) => void;
}

function NewSearchLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-indigo transition-colors"
    >
      <ArrowLeft size={13} />
      New search
    </button>
  );
}

function ResultPanel({
  outboundLoading,
  outboundError,
  outboundResult,
  returnLoading,
  returnError,
  returnResult,
  originLabel,
  destinationLabel,
  outboundRangeLabel,
  returnRangeLabel,
  roundTripLoading,
  onOutboundCtaClick,
  onReturnCtaClick,
  onRoundTripCtaClick,
  onPickOutboundDay,
  onPickReturnDay,
  onNewSearch,
  onReturnSearch,
}: ResultPanelProps) {
  const showReturnSection = !!(returnResult || returnLoading || returnError);
  const cheapestOutboundDate = outboundResult?.cheapest?.date;
  const outboundCheapest = outboundResult?.cheapest;
  const returnCheapest = returnResult?.cheapest;
  const bothFlightsReady = !!(outboundCheapest && returnCheapest);

  return (
    <div>
      <div className="mb-5">
        <NewSearchLink onClick={onNewSearch} />
      </div>

      <DirectionPanel
        label="Outbound"
        originLabel={originLabel}
        destinationLabel={destinationLabel}
        rangeLabel={outboundRangeLabel}
        loading={outboundLoading}
        error={outboundError}
        result={outboundResult}
        onPickDay={onPickOutboundDay}
        onCtaClick={onOutboundCtaClick}
      />

      {showReturnSection && (
        <div className="mt-7 pt-6 border-t-2 border-border/70">
          <DirectionPanel
            label="Return"
            originLabel={destinationLabel}
            destinationLabel={originLabel}
            rangeLabel={returnRangeLabel}
            loading={returnLoading}
            error={returnError}
            result={returnResult}
            onPickDay={onPickReturnDay}
            onCtaClick={onReturnCtaClick}
          />
        </div>
      )}

      {/* Once both flights are picked, swap the date-picker form for a single
          round-trip CTA — the user is no longer planning, they're booking. */}
      {bothFlightsReady ? (
        <BookRoundTripButton
          outboundDate={outboundCheapest!.date}
          outboundPrice={outboundCheapest!.priceUsd}
          returnDate={returnCheapest!.date}
          returnPrice={returnCheapest!.priceUsd}
          currency={outboundCheapest!.currency || returnCheapest!.currency}
          loading={roundTripLoading}
          onClick={onRoundTripCtaClick}
        />
      ) : cheapestOutboundDate ? (
        // Defer the form until the outbound cheapest day is known so its date
        // picker can default to "after I land," not today. Re-mount on outbound
        // chip-pick so the suggested return shifts with the new outbound day.
        <ReturnTripForm
          key={`${destinationLabel}->${originLabel}-${cheapestOutboundDate}`}
          originLabel={destinationLabel}
          destinationLabel={originLabel}
          cheapestDate={cheapestOutboundDate}
          loading={returnLoading}
          onSubmit={onReturnSearch}
        />
      ) : null}
    </div>
  );
}

interface BookRoundTripButtonProps {
  outboundDate: string;
  outboundPrice: number;
  returnDate: string;
  returnPrice: number;
  currency: string;
  loading: boolean;
  onClick: () => void;
}

function BookRoundTripButton({
  outboundDate,
  outboundPrice,
  returnDate,
  returnPrice,
  currency,
  loading,
  onClick,
}: BookRoundTripButtonProps) {
  const total = Math.round(outboundPrice + returnPrice);

  return (
    <div className="mt-7 pt-6 border-t-2 border-border/70">
      <div className="text-[11px] uppercase tracking-wide text-text-muted font-bold mb-3">
        Round trip total
      </div>
      <div className="flex items-baseline gap-2 mb-4 flex-wrap">
        <span className="text-3xl font-black text-indigo tracking-tight">${total}</span>
        <span className="text-sm font-bold text-text-muted">{currency}</span>
        <span className="ml-auto text-[11px] text-text-muted">
          {FMT_DATE_TINY(outboundDate)}
          <ArrowRight size={11} className="inline mx-1 -mt-0.5" />
          {FMT_DATE_TINY(returnDate)}
        </span>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full bg-orange text-white text-sm font-bold hover:bg-orange-dark transition-all disabled:opacity-70 disabled:cursor-wait"
        style={{ boxShadow: '0 14px 32px -10px rgba(249,115,22,0.5)' }}
      >
        {loading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Finding round trip…
          </>
        ) : (
          <>
            Book round trip
            <ArrowRight size={14} />
          </>
        )}
      </button>
      <p className="text-[10px] text-text-muted mt-2 text-center">
        Review on Flexbook, then continue to Kiwi
      </p>
    </div>
  );
}

interface DirectionPanelProps {
  label: string;
  originLabel: string;
  destinationLabel: string;
  rangeLabel: string;
  loading: boolean;
  error: string | null;
  result: CheapestDayResponse | null;
  onPickDay: (day: CalendarDay) => void;
  onCtaClick: () => void;
}

function DirectionPanel({
  label,
  originLabel,
  destinationLabel,
  rangeLabel,
  loading,
  error,
  result,
  onPickDay,
  onCtaClick,
}: DirectionPanelProps) {
  const cheapest = result?.cheapest ?? null;

  const sectionHeader = (
    <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[11px] font-bold uppercase tracking-widest text-indigo">
          {label}
        </span>
        <span className="text-text-muted">·</span>
        <span className="text-[11px] text-text-secondary font-semibold truncate">
          {originLabel}
          {originLabel && destinationLabel && <span className="mx-1">→</span>}
          {destinationLabel}
        </span>
      </div>
      {rangeLabel && (
        <span className="text-[11px] text-text-muted">{rangeLabel}</span>
      )}
    </div>
  );

  if (error) {
    return (
      <div>
        {sectionHeader}
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
          <p className="text-sm font-semibold text-red-700">Couldn&rsquo;t fetch prices</p>
          <p className="text-xs text-red-600/80 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (loading && !result) {
    return (
      <div>
        {sectionHeader}
        <div className="h-5 w-32 bg-surface-2 rounded animate-pulse mb-3" />
        <div className="h-8 w-56 bg-surface-2 rounded animate-pulse mb-2" />
        <div className="h-12 w-32 bg-surface-2 rounded animate-pulse mb-4" />
        <div className="h-12 w-full bg-surface-2 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (result && !cheapest) {
    return (
      <div>
        {sectionHeader}
        <div className="text-center py-4">
          <p className="text-sm font-semibold text-text-primary mb-1">
            No flights found in this window
          </p>
          <p className="text-xs text-text-muted">
            Try widening the window or picking a different month.
          </p>
        </div>
      </div>
    );
  }

  if (!cheapest) return <div>{sectionHeader}</div>;

  const it = cheapest.itinerary;
  const stopsLabel =
    !it || it.stops === 0
      ? 'Direct'
      : it.viaIatas && it.viaIatas.length > 0
        ? `${it.stops} stop${it.stops > 1 ? 's' : ''} · via ${it.viaIatas.join(', ')}`
        : `${it.stops} stop${it.stops > 1 ? 's' : ''}`;

  const cheapestDate = cheapest.date;
  const cheapestTs = new Date(cheapestDate + 'T12:00:00').getTime();
  const DAY_MS = 86_400_000;
  const isNearby = (d: CalendarDay) => {
    if (d.date === cheapestDate) return false;
    const t = new Date(d.date + 'T12:00:00').getTime();
    const delta = Math.abs(t - cheapestTs);
    return delta > 0 && delta <= 2 * DAY_MS;
  };
  const nearbyDays = (result?.days ?? [])
    .filter(isNearby)
    .sort((a, b) => a.date.localeCompare(b.date));
  const otherCheap = (result?.days ?? [])
    .filter((d) => d.date !== cheapestDate && !isNearby(d))
    .sort((a, b) => a.priceUsd - b.priceUsd)
    .slice(0, 5);

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 bg-white/55 backdrop-blur-[1px] z-10 flex items-start justify-center pt-6 -m-1">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-border shadow-sm text-xs text-text-secondary">
            <Loader2 size={13} className="animate-spin text-indigo" />
            Refreshing…
          </div>
        </div>
      )}
      {sectionHeader}
      <div className="flex items-center gap-2 mb-3">
        <TrendingDown size={14} className="text-emerald" />
        <span className="text-xs font-bold text-emerald uppercase tracking-wide">
          Cheapest day
        </span>
        {it?.airlineName && (
          <span className="ml-auto text-[11px] font-semibold text-text-muted">
            {it.airlineName}
          </span>
        )}
      </div>
      <div className="text-2xl font-black text-text-primary tracking-tight mb-1">
        {FMT_DATE_LONG(cheapest.date)}
      </div>
      <div className="text-4xl font-black text-indigo tracking-tight mb-4">
        ${Math.round(cheapest.priceUsd)}
        <span className="text-base font-bold text-text-muted ml-1">{cheapest.currency}</span>
      </div>

      {it && (
        <div className="bg-surface-2 border border-border rounded-2xl p-4 mb-5">
          <div className="grid grid-cols-[auto,1fr,auto] gap-3 items-center">
            <div className="text-center">
              <div className="text-base font-bold text-text-primary">{fmtTime(it.departureDatetime)}</div>
              <div className="text-[11px] font-mono font-bold text-indigo-mid mt-0.5">{it.originIata}</div>
            </div>
            <div className="flex flex-col items-center min-w-0">
              <div className="text-[10px] uppercase tracking-wide font-semibold text-text-muted mb-0.5">
                {fmtDuration(it.durationMinutes)}
              </div>
              <div className="relative w-full flex items-center">
                <div className="flex-1 h-px bg-border" />
                <PlaneTakeoff size={13} className="text-indigo mx-1.5" />
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="text-[10px] text-text-muted mt-0.5 truncate max-w-full">
                {stopsLabel}
              </div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold text-text-primary">{fmtTime(it.arrivalDatetime)}</div>
              <div className="text-[11px] font-mono font-bold text-indigo-mid mt-0.5">
                {it.destinationIata}
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-1.5 text-xs text-text-muted">
            <span className="font-semibold text-text-secondary">{it.originCity}</span>
            <ArrowRight size={11} />
            <span className="font-semibold text-text-secondary">{it.destinationCity}</span>
            {it.destinationCountry && (
              <>
                <span>·</span>
                <span>{it.destinationCountry}</span>
              </>
            )}
          </div>
        </div>
      )}

      {cheapest.bookingUrl && (
        <a
          href={cheapest.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onCtaClick}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-indigo text-white text-sm font-bold hover:bg-indigo/90 transition-all active:scale-[0.98]"
          style={{ boxShadow: '0 10px 28px rgba(55,48,163,0.28)' }}
        >
          Book this flight
          <ExternalLink size={14} />
        </a>
      )}

      {nearbyDays.length > 0 && (
        <div className="mt-5 pt-5 border-t border-border/60">
          <div className="text-[11px] uppercase tracking-wide text-text-muted font-bold mb-2">
            Nearby dates
          </div>
          <div className="flex flex-wrap gap-1.5">
            {nearbyDays.map((d) => (
              <button
                key={d.date}
                type="button"
                onClick={() => onPickDay(d)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-2 border border-border hover:border-indigo-border transition-all text-xs"
              >
                <span className="font-semibold text-text-primary">{FMT_DATE_TINY(d.date)}</span>
                <span className="text-text-muted">${Math.round(d.priceUsd)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {otherCheap.length > 0 && (
        <div className="mt-5 pt-5 border-t border-border/60">
          <div className="text-[11px] uppercase tracking-wide text-text-muted font-bold mb-2">
            Other cheap dates
          </div>
          <div className="flex flex-wrap gap-1.5">
            {otherCheap.map((d) => (
              <button
                key={d.date}
                type="button"
                onClick={() => onPickDay(d)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-2 border border-border hover:border-indigo-border transition-all text-xs"
              >
                <span className="font-semibold text-text-primary">{FMT_DATE_TINY(d.date)}</span>
                <span className="text-text-muted">${Math.round(d.priceUsd)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ReturnTripFormProps {
  originLabel: string;
  destinationLabel: string;
  cheapestDate: string;
  loading: boolean;
  onSubmit: (start: string, end: string) => void;
}

function ReturnTripForm({
  originLabel,
  destinationLabel,
  cheapestDate,
  loading,
  onSubmit,
}: ReturnTripFormProps) {
  const todayStr = formatYMD(new Date());
  const initialStart =
    cheapestDate >= todayStr ? cheapestDate : todayStr;
  const initialEnd = formatYMD(addDays(new Date(initialStart + 'T12:00:00'), 14));
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);

  return (
    <div className="mt-7 pt-6 border-t-2 border-border/70">
      <div className="text-[11px] uppercase tracking-wide text-text-muted font-bold mb-2">
        Plan return trip
      </div>
      <div className="flex items-center gap-1.5 text-sm font-semibold text-text-primary mb-3 truncate">
        <span className="truncate">{originLabel}</span>
        <ArrowRight size={14} className="shrink-0 text-text-muted" />
        <span className="truncate">{destinationLabel}</span>
      </div>
      <Suspense fallback={<div className="h-[260px] rounded-2xl bg-surface-muted" aria-hidden />}>
        <DateRangePicker
          dateFrom={start}
          dateTo={end}
          today={todayStr}
          label=""
          fromLabel="Earliest"
          toLabel="Latest"
          onChangeFrom={setStart}
          onChangeTo={setEnd}
        />
      </Suspense>
      <button
        type="button"
        onClick={() => onSubmit(start, end)}
        disabled={loading}
        className="mt-4 w-full flex items-center justify-center gap-2 py-3.5 rounded-full bg-orange text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-orange-dark transition-all"
        style={{ boxShadow: '0 14px 32px -10px rgba(249,115,22,0.5)' }}
      >
        {loading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Searching…
          </>
        ) : (
          <>
            Find cheapest return
            <ArrowRight size={14} />
          </>
        )}
      </button>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
      {children}
    </div>
  );
}

// DateField removed — custom range now uses the shared DateRangePicker
// (same single-month calendar Plan by Budget uses).
