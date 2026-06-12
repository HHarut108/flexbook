import { useEffect, useMemo, useState } from 'react';
import { FlightOption, RoundTripOption, MultiCityOption } from '@fast-travel/shared';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { searchFlights, searchRoundTrip, searchMultiCity } from '../api/flights.api';
import { fetchAirlineLogos } from '../api/airlines.api';
import { FlightCardSkeleton } from '../components/FlightCard';
import { FlightCardDetailed } from '../components/FlightCardDetailed';
import {
  applyFilters,
  applyMultiCityFilters,
  applyRoundTripFilters,
  computeBounds,
  computeMultiCityBounds,
  computeRoundTripBounds,
  defaultFilters,
  type FlightFilterState,
} from '../components/FlightFilters';
import { RoundTripCardSkeleton } from '../components/RoundTripCard';
import { RoundTripCardDetailed } from '../components/RoundTripCardDetailed';
import { MultiCityCardSkeleton } from '../components/MultiCityCard';
import { MultiCityCardDetailed } from '../components/MultiCityCardDetailed';
import { MarketingShellV2 } from '../components/MarketingShellV2';
import { FilterSidebar, SaverTipPill } from '../components/FilterSidebar';
import { EditSearchPanel, type EditSearchLeg, type TripType as EditTripType } from '../components/EditSearchPanel';
import { getAirportIndex, resolveMarkerInIndex } from '../lib/airportIndex';
import { persistSelectedTrip } from '../lib/selectedTrip';
import {
  ArrowRight,
  CalendarSearch,
  Edit3,
  Plane,
  SearchX,
  Sparkles,
  Waypoints,
} from 'lucide-react';

type TripType = 'oneway' | 'return' | 'multi';

/** Shared hook: collects airline codes from a list of legs and fetches their
 *  logo URLs. Each section (one-way / round-trip / multi-city) calls it with
 *  its own leg list. Returns {} on error so badges fall back to the colored
 *  letter mark in LegRow. */
function useAirlineLogos(legs: FlightOption[]): Record<string, string> {
  const [logos, setLogos] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    const codes = legs
      .map((l) => l.airlineCode?.trim().toUpperCase())
      .filter((c): c is string => Boolean(c));
    if (codes.length === 0) {
      setLogos({});
      return;
    }
    fetchAirlineLogos(codes)
      .then((next) => {
        if (!cancelled) setLogos(next);
      })
      .catch(() => {
        if (!cancelled) setLogos({});
      });
    return () => {
      cancelled = true;
    };
  }, [legs]);
  return logos;
}

interface Leg {
  origin: string;
  destination: string;
  date: string;
}

interface LegResult {
  leg: Leg;
  loading: boolean;
  error: string | null;
  flights: FlightOption[];
}

const RESULTS_LIMIT = 30;
const ROUND_TRIP_LIMIT = 15;
const MULTI_CITY_LIMIT = 30;

function decodeLegs(raw: string): Leg[] {
  return raw
    .split('|')
    .map((segment) => {
      const [origin, destination, date] = segment.split(',');
      return origin && destination && date ? { origin, destination, date } : null;
    })
    .filter((leg): leg is Leg => leg !== null);
}

function formatDate(ymd: string): string {
  try {
    return format(new Date(ymd + 'T12:00:00'), 'EEE, MMM d');
  } catch {
    return ymd;
  }
}

/** Map markers → friendly labels via the airport index. IATA markers ("EVN")
 *  stay as-is so the chip shows the code the user typed. City markers
 *  ("@paris_fr") resolve to a {short, code} pair — e.g. "Paris" + "PAR" —
 *  so the human reads a city name instead of an internal slug. Falls back
 *  to a Title-Cased version of the slug ("Paris Fr" → "Paris") on misses
 *  so the chip never shows the underscore form. */
interface MarkerLabel {
  short: string;
  code: string | null;
  isCity: boolean;
}

function fallbackCityFromMarker(marker: string): string {
  if (!marker.startsWith('@')) return marker;
  // "@paris_fr" → "Paris". Drop the country code suffix; words separated by
  // underscores get title-cased.
  const slug = marker.slice(1);
  const segments = slug.split('_');
  // Last segment is typically the country code (2 letters). Keep everything
  // up to but not including it when there's more than one segment.
  const cityParts = segments.length > 1 ? segments.slice(0, -1) : segments;
  return cityParts
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(' ')
    .trim();
}

function useMarkerLabels(markers: string[]): Record<string, MarkerLabel> {
  const [labels, setLabels] = useState<Record<string, MarkerLabel>>({});
  useEffect(() => {
    let cancelled = false;
    const needsLookup = markers.some((m) => m && m.startsWith('@'));
    if (!needsLookup) {
      setLabels({});
      return;
    }
    void getAirportIndex().then((index) => {
      if (cancelled) return;
      const next: Record<string, MarkerLabel> = {};
      for (const m of markers) {
        if (!m || !m.startsWith('@')) continue;
        const resolved = resolveMarkerInIndex(index, m);
        if (resolved && resolved.kind === 'city') {
          next[m] = {
            short: resolved.city.name,
            code: resolved.city.airports[0] ?? null,
            isCity: true,
          };
        } else {
          next[m] = { short: fallbackCityFromMarker(m), code: null, isCity: true };
        }
      }
      setLabels(next);
    });
    return () => {
      cancelled = true;
    };
  }, [markers]);
  return labels;
}

function MarkerChip({
  marker,
  labels,
}: {
  marker: string;
  labels: Record<string, MarkerLabel>;
}) {
  if (!marker.startsWith('@')) {
    // Plain IATA — show as-is in mono so it reads as a code.
    return <span className="font-mono font-bold text-text-primary">{marker}</span>;
  }
  const label = labels[marker];
  if (!label) {
    // Index still loading — show a soft placeholder rather than the raw slug.
    return (
      <span className="font-bold text-text-primary">{fallbackCityFromMarker(marker)}</span>
    );
  }
  return (
    <span className="inline-flex items-baseline gap-1 min-w-0 whitespace-nowrap">
      <span className="font-bold text-text-primary">{label.short}</span>
      <span className="text-[10px] font-semibold text-text-xmuted">(all)</span>
    </span>
  );
}

function TripSummary({
  type,
  legs,
  passengers,
}: {
  type: TripType;
  legs: Leg[];
  passengers: number;
}) {
  const paxLabel = `${passengers} traveler${passengers > 1 ? 's' : ''}`;
  const typeLabel = type === 'oneway' ? 'One-way' : type === 'return' ? 'Return' : 'Multi-city';

  const markers = useMemo(
    () => Array.from(new Set(legs.flatMap((l) => [l.origin, l.destination]))),
    [legs],
  );
  const labels = useMarkerLabels(markers);

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-soft text-indigo text-[11px] font-bold">
        {typeLabel}
      </span>
      {legs.map((leg, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 && <span className="text-text-xmuted">·</span>}
          <MarkerChip marker={leg.origin} labels={labels} />
          <Plane size={11} className="rotate-90 text-text-xmuted" />
          <MarkerChip marker={leg.destination} labels={labels} />
          <span className="text-text-muted">· {formatDate(leg.date)}</span>
        </span>
      ))}
      <span className="text-text-xmuted">·</span>
      <span className="text-text-muted">{paxLabel}</span>
    </div>
  );
}

function ToolCrossSell() {
  return (
    <div className="section-shell p-5 mt-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-indigo" />
        <p className="text-xs font-bold uppercase tracking-wider text-indigo">
          No luck? Try a Flexbook tool
        </p>
      </div>
      <p className="text-sm text-text-muted mb-4">
        Direct routes aren't the only way. These tools were built for exactly this moment.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Link
          to="/hop-planner"
          className="flex items-center gap-3 p-3 rounded-2xl border border-border hover:border-indigo-border bg-surface transition-colors group"
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.97) 0%, rgba(234,108,10,0.97) 100%)' }}
          >
            <Waypoints size={18} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-text-primary">Trip Builder</p>
            <p className="text-[11px] text-text-muted truncate">
              Chain the cheapest one-way fares
            </p>
          </div>
          <ArrowRight size={14} className="text-text-xmuted group-hover:text-indigo shrink-0" />
        </Link>
        <Link
          to="/when-to-go"
          className="flex items-center gap-3 p-3 rounded-2xl border border-border hover:border-indigo-border bg-surface transition-colors group"
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, rgba(13,148,136,0.97) 0%, rgba(16,185,129,0.97) 100%)' }}
          >
            <CalendarSearch size={18} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-text-primary">When to Go</p>
            <p className="text-[11px] text-text-muted truncate">
              Find the cheapest day to fly
            </p>
          </div>
          <ArrowRight size={14} className="text-text-xmuted group-hover:text-indigo shrink-0" />
        </Link>
      </div>
    </div>
  );
}

interface RoundTripResult {
  loading: boolean;
  error: string | null;
  pairs: RoundTripOption[];
}

function RoundTripSection({
  result,
  passengers,
  legs,
}: {
  result: RoundTripResult;
  passengers: number;
  legs: Leg[];
}) {
  const pairs = result.pairs;
  const bounds = useMemo(() => computeRoundTripBounds(pairs), [pairs]);
  const [filters, setFilters] = useState<FlightFilterState>(() => defaultFilters(bounds));
  const filtered = useMemo(() => applyRoundTripFilters(pairs, filters), [pairs, filters]);

  const allLegs = useMemo(() => pairs.flatMap((p) => [p.outbound, p.inbound]), [pairs]);
  const airlineLogos = useAirlineLogos(allLegs);

  // Outbound leg drives the "When to fly" anchor: same origin/dest as the
  // user's search and the depart date the round-trip flexes around.
  const outboundLeg = legs[0];
  const sample = pairs[0]?.outbound;
  const fromCity = sample?.originCity || outboundLeg?.origin || '';
  const toCity = sample?.destinationCity || outboundLeg?.destination || '';

  const navigate = useNavigate();
  function handleSelect(trip: RoundTripOption) {
    const saved = persistSelectedTrip({
      type: 'return',
      passengers,
      flights: [trip.outbound, trip.inbound],
      bookings: [
        {
          label: 'Book round trip',
          url: trip.bookingUrl || trip.outbound.bookingUrl || '',
        },
      ],
      totalPriceUsd: trip.priceUsd,
    });
    navigate(`/trip/${saved.id}`, { state: { trip: saved } });
  }

  if (result.loading) {
    return (
      <div>
        <h2 className="text-2xl font-black tracking-tight text-text-primary mb-1">
          Round-trip options
        </h2>
        <p className="text-xs text-text-muted mb-4">Searching across 30+ airlines — this usually takes 5–10 seconds.</p>
        <div className="space-y-2.5">
          <RoundTripCardSkeleton />
          <RoundTripCardSkeleton />
          <RoundTripCardSkeleton />
        </div>
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="section-shell p-5 text-center">
        <SearchX size={28} className="text-text-xmuted mx-auto mb-2" />
        <p className="text-sm text-text-secondary">{result.error}</p>
      </div>
    );
  }

  if (pairs.length === 0) {
    return (
      <div className="section-shell p-6 text-center">
        <SearchX size={28} className="text-text-xmuted mx-auto mb-2" />
        <p className="text-sm font-semibold text-text-primary">No round-trip pairs found</p>
        <p className="text-xs text-text-muted mt-1">
          Try shifting the dates a day or two — bundled fares are date-sensitive.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 lg:gap-6">
      <FilterSidebar
        bounds={bounds}
        value={filters}
        onChange={setFilters}
        fromMarker={outboundLeg?.origin ?? ''}
        toMarker={outboundLeg?.destination ?? ''}
        fromCity={fromCity}
        toCity={toCity}
        centerDate={outboundLeg?.date ?? ''}
      />
      <div>
        {/* Mobile-only Saver tip pinned above results. Desktop sidebar shows
            the full card. */}
        <div className="lg:hidden mb-3">
          <SaverTipPill
            fromMarker={outboundLeg?.origin ?? ''}
            toMarker={outboundLeg?.destination ?? ''}
            fromCity={fromCity}
            toCity={toCity}
            centerDate={outboundLeg?.date ?? ''}
          />
        </div>
        <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-text-primary">
              Available flights
            </h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              Outbound + return sold together — often cheaper than two one-ways.
            </p>
          </div>
          <p className="text-xs text-text-muted">
            <strong className="text-text-secondary">{filtered.length}</strong> of {pairs.length}{' '}
            result{pairs.length === 1 ? '' : 's'}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="section-shell p-5 text-center">
            <p className="text-sm text-text-secondary">
              No round-trips match these filters. Try widening the price or duration sliders.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((trip, i) => (
              <div key={trip.tripId} style={{ animationDelay: `${i * 30}ms` }}>
                <RoundTripCardDetailed
                  trip={trip}
                  passengers={passengers}
                  isBestValue={i === 0}
                  logos={airlineLogos}
                  onSelect={handleSelect}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface MultiCityResult {
  loading: boolean;
  error: string | null;
  trips: MultiCityOption[];
}

function MultiCitySection({
  result,
  legCount,
  passengers,
  legs,
}: {
  result: MultiCityResult;
  legCount: number;
  passengers: number;
  legs: Leg[];
}) {
  const trips = result.trips;
  const bounds = useMemo(() => computeMultiCityBounds(trips), [trips]);
  const [filters, setFilters] = useState<FlightFilterState>(() => defaultFilters(bounds));
  const filtered = useMemo(() => applyMultiCityFilters(trips, filters), [trips, filters]);

  const allLegs = useMemo(() => trips.flatMap((t) => t.legs), [trips]);
  const airlineLogos = useAirlineLogos(allLegs);

  // Anchor the "When to fly" CTA to leg 1 — the only leg with a stable
  // origin/destination across the whole multi-city trip. The When-to-go
  // tool only supports one O/D pair, so showing it per-leg would be noisy.
  const firstLeg = legs[0];
  const sampleLeg = trips[0]?.legs[0];
  const fromCity = sampleLeg?.originCity || firstLeg?.origin || '';
  const toCity = sampleLeg?.destinationCity || firstLeg?.destination || '';

  const navigate = useNavigate();
  function handleSelect(trip: MultiCityOption) {
    const saved = persistSelectedTrip({
      type: 'multi',
      passengers,
      flights: trip.legs,
      bookings: trip.legs.map((leg, i) => ({
        label: `Book Leg ${i + 1}: ${leg.originIata} → ${leg.destinationIata}`,
        url: leg.bookingUrl ?? '',
      })),
      totalPriceUsd: trip.priceUsd,
    });
    navigate(`/trip/${saved.id}`, { state: { trip: saved } });
  }

  if (result.loading) {
    return (
      <div>
        <h2 className="text-2xl font-black tracking-tight text-text-primary mb-1">
          Multi-city trips
        </h2>
        <p className="text-xs text-text-muted mb-4">Searching across 30+ airlines — this usually takes 5–10 seconds.</p>
        <div className="space-y-2.5">
          <MultiCityCardSkeleton legCount={legCount} />
          <MultiCityCardSkeleton legCount={legCount} />
          <MultiCityCardSkeleton legCount={legCount} />
        </div>
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="section-shell p-5 text-center">
        <SearchX size={28} className="text-text-xmuted mx-auto mb-2" />
        <p className="text-sm text-text-secondary">{result.error}</p>
      </div>
    );
  }

  if (trips.length === 0) {
    return (
      <div className="section-shell p-6 text-center">
        <SearchX size={28} className="text-text-xmuted mx-auto mb-2" />
        <p className="text-sm font-semibold text-text-primary">No multi-city trips found</p>
        <p className="text-xs text-text-muted mt-1">
          One of the legs had no flights on its date — try shifting a date or swapping airports.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 lg:gap-6">
      <FilterSidebar
        bounds={bounds}
        value={filters}
        onChange={setFilters}
        fromMarker={firstLeg?.origin ?? ''}
        toMarker={firstLeg?.destination ?? ''}
        fromCity={fromCity}
        toCity={toCity}
        centerDate={firstLeg?.date ?? ''}
      />
      <div>
        <div className="lg:hidden mb-3">
          <SaverTipPill
            fromMarker={firstLeg?.origin ?? ''}
            toMarker={firstLeg?.destination ?? ''}
            fromCity={fromCity}
            toCity={toCity}
            centerDate={firstLeg?.date ?? ''}
          />
        </div>
        <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-text-primary">
              Available flights
            </h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              All {legCount} legs combined — each leg is booked as a separate ticket.
            </p>
          </div>
          <p className="text-xs text-text-muted">
            <strong className="text-text-secondary">{filtered.length}</strong> of {trips.length}{' '}
            trip{trips.length === 1 ? '' : 's'}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="section-shell p-5 text-center">
            <p className="text-sm text-text-secondary">
              No trips match these filters. Try widening the price or duration sliders.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((trip, i) => (
              <div key={trip.tripId} style={{ animationDelay: `${i * 30}ms` }}>
                <MultiCityCardDetailed
                  trip={trip}
                  passengers={passengers}
                  isBestValue={i === 0}
                  logos={airlineLogos}
                  onSelect={handleSelect}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultsSection({
  heading,
  result,
  passengers,
}: {
  heading: string;
  result: LegResult;
  passengers: number;
}) {
  const sorted = useMemo(
    () => [...result.flights].sort((a, b) => a.priceUsd - b.priceUsd).slice(0, RESULTS_LIMIT),
    [result.flights],
  );

  const bounds = useMemo(() => computeBounds(sorted), [sorted]);
  const [filters, setFilters] = useState<FlightFilterState>(() => defaultFilters(bounds));
  const filtered = useMemo(() => applyFilters(sorted, filters), [sorted, filters]);

  const airlineLogos = useAirlineLogos(sorted);

  const navigate = useNavigate();
  function handleSelect(flight: FlightOption) {
    const saved = persistSelectedTrip({
      type: 'oneway',
      passengers,
      flights: [flight],
      bookings: [
        { label: 'Book this flight', url: flight.bookingUrl ?? '' },
      ],
      totalPriceUsd: flight.priceUsd,
    });
    navigate(`/trip/${saved.id}`, { state: { trip: saved } });
  }

  if (result.loading) {
    return (
      <div>
        <h2 className="text-2xl font-black tracking-tight text-text-primary mb-1">{heading}</h2>
        <p className="text-xs text-text-muted mb-4">Searching across 30+ airlines — this usually takes 5–10 seconds.</p>
        <div className="space-y-2.5">
          <FlightCardSkeleton />
          <FlightCardSkeleton />
          <FlightCardSkeleton />
        </div>
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="section-shell p-5 text-center">
        <SearchX size={28} className="text-text-xmuted mx-auto mb-2" />
        <p className="text-sm text-text-secondary">{result.error}</p>
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="section-shell p-6 text-center">
        <SearchX size={28} className="text-text-xmuted mx-auto mb-2" />
        <p className="text-sm font-semibold text-text-primary">No flights found</p>
        <p className="text-xs text-text-muted mt-1">
          We couldn't find {result.leg.origin} → {result.leg.destination} on {formatDate(result.leg.date)}.
        </p>
      </div>
    );
  }

  // The "When to fly" CTA shows the destination's city name when we can
  // glean it from the first result; otherwise we fall back to the IATA.
  const sample = sorted[0];
  const fromCity = sample?.originCity || result.leg.origin;
  const toCity = sample?.destinationCity || result.leg.destination;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 lg:gap-6">
      <FilterSidebar
        bounds={bounds}
        value={filters}
        onChange={setFilters}
        fromMarker={result.leg.origin}
        toMarker={result.leg.destination}
        fromCity={fromCity}
        toCity={toCity}
        centerDate={result.leg.date}
      />
      <div>
        <div className="lg:hidden mb-3">
          <SaverTipPill
            fromMarker={result.leg.origin}
            toMarker={result.leg.destination}
            fromCity={fromCity}
            toCity={toCity}
            centerDate={result.leg.date}
          />
        </div>
        <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
          <h2 className="text-2xl font-black tracking-tight text-text-primary">{heading}</h2>
          <p className="text-xs text-text-muted">
            <strong className="text-text-secondary">{filtered.length}</strong> of {sorted.length}{' '}
            result{sorted.length === 1 ? '' : 's'}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="section-shell p-5 text-center">
            <p className="text-sm text-text-secondary">
              No flights match these filters. Try widening the price or duration sliders.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((flight, i) => (
              <div key={flight.flightId} style={{ animationDelay: `${i * 30}ms` }}>
                <FlightCardDetailed
                  flight={flight}
                  passengers={passengers}
                  isBestValue={i === 0}
                  logoUrl={
                    flight.airlineCode
                      ? airlineLogos[flight.airlineCode.toUpperCase()]
                      : undefined
                  }
                  carrierLogos={airlineLogos}
                  onSelect={handleSelect}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function SearchResultsScreen({ onMenuOpen }: { onMenuOpen?: () => void }) {
  useDocumentTitle('Flight results — Flexbook');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  const type = (searchParams.get('type') ?? 'oneway') as TripType;
  const passengers = Math.max(1, Math.min(9, parseInt(searchParams.get('pax') ?? '1', 10) || 1));

  const legs: Leg[] = useMemo(() => {
    if (type === 'multi') {
      const raw = searchParams.get('legs');
      return raw ? decodeLegs(raw) : [];
    }
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');
    const depart = searchParams.get('depart');
    const out: Leg[] = [];
    if (origin && destination && depart) {
      out.push({ origin, destination, date: depart });
    }
    if (type === 'return') {
      const ret = searchParams.get('return');
      if (origin && destination && ret) {
        out.push({ origin: destination, destination: origin, date: ret });
      }
    }
    return out;
    // We intentionally re-derive on every searchParams change.
  }, [searchParams, type]);

  const [results, setResults] = useState<LegResult[]>([]);
  const [roundTrip, setRoundTrip] = useState<RoundTripResult>({
    loading: false,
    error: null,
    pairs: [],
  });
  const [multiCity, setMultiCity] = useState<MultiCityResult>({
    loading: false,
    error: null,
    trips: [],
  });

  // Round-trip path: one bundled-pair call instead of two independent one-ways.
  // Splits cleanly from the leg-by-leg effect below — they never run together
  // for the same `type`.
  useEffect(() => {
    if (type !== 'return') return;
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');
    const depart = searchParams.get('depart');
    const ret = searchParams.get('return');
    if (!origin || !destination || !depart || !ret) return;

    let cancelled = false;
    setRoundTrip({ loading: true, error: null, pairs: [] });
    searchRoundTrip(origin, destination, depart, ret, {
      passengers,
      limit: ROUND_TRIP_LIMIT,
    })
      .then((pairs) => {
        if (cancelled) return;
        setRoundTrip({ loading: false, error: null, pairs });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setRoundTrip({
          loading: false,
          error: err.message || 'Could not load round-trip options',
          pairs: [],
        });
      });

    return () => {
      cancelled = true;
    };
  }, [type, searchParams, passengers]);

  // Multi-city path: a single backend call enumerates trip combinations
  // (top-K candidates per leg) and returns the cheapest bundled trips. We
  // render each trip as one card with all legs stacked — same UX shape as
  // round-trip, but legs are booked separately (Kiwi has no /multi-city).
  useEffect(() => {
    if (type !== 'multi') return;
    if (legs.length < 2) return;
    let cancelled = false;
    setMultiCity({ loading: true, error: null, trips: [] });

    searchMultiCity(
      legs.map((l) => ({ origin: l.origin, destination: l.destination, date: l.date })),
      { passengers, limit: MULTI_CITY_LIMIT },
    )
      .then((trips) => {
        if (cancelled) return;
        setMultiCity({ loading: false, error: null, trips });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setMultiCity({
          loading: false,
          error: err.message || 'Could not load multi-city trips',
          trips: [],
        });
      });

    return () => {
      cancelled = true;
    };
  }, [type, legs, passengers]);

  // One-way: fire one searchFlights call per leg (there's only one). Kept as
  // its own effect so round-trip + multi paths above don't trigger it.
  useEffect(() => {
    if (type !== 'oneway') return;
    if (legs.length === 0) return;
    let cancelled = false;
    setResults(legs.map((leg) => ({ leg, loading: true, error: null, flights: [] })));

    legs.forEach((leg, index) => {
      searchFlights(leg.origin, leg.date, {
        destination: leg.destination,
        sort: 'price',
        passengers,
      })
        .then((flights) => {
          if (cancelled) return;
          setResults((prev) =>
            prev.map((row, i) => (i === index ? { ...row, loading: false, flights } : row)),
          );
        })
        .catch((err: Error) => {
          if (cancelled) return;
          setResults((prev) =>
            prev.map((row, i) =>
              i === index
                ? { ...row, loading: false, error: err.message || 'Could not load flights for this leg' }
                : row,
            ),
          );
        });
    });

    return () => {
      cancelled = true;
    };
  }, [type, legs, passengers]);

  const hasInvalidParams = legs.length === 0;
  const allDone =
    type === 'return'
      ? !roundTrip.loading
      : type === 'multi'
      ? !multiCity.loading
      : results.length > 0 && results.every((r) => !r.loading);
  const totalFlights =
    type === 'return'
      ? roundTrip.pairs.length
      : type === 'multi'
      ? multiCity.trips.length
      : results.reduce((sum, r) => sum + r.flights.length, 0);
  const noResults =
    allDone && totalFlights === 0 && !roundTrip.error && !multiCity.error;

  function handleEditSubmit(nextParams: URLSearchParams) {
    setEditOpen(false);
    navigate(`/search?${nextParams.toString()}`);
  }

  return (
    <MarketingShellV2
      active="search"
      title="Flight results"
      description="Live one-way, round-trip, and multi-city fares for your search."
      onMenuOpen={onMenuOpen}
    >
      <div className="relative px-5 pb-16 md:mx-auto md:px-8 md:pt-6 lg:px-10 md:max-w-4xl lg:max-w-6xl xl:max-w-7xl">
        {/* Trip summary + Edit search toggle. The toggle expands an inline
            EditSearchPanel below this row — it does NOT navigate home, so
            the user keeps their place in the results list. */}
        <div className="mb-5 mt-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-mid mb-1">
                Flight results
              </p>
              {!hasInvalidParams && (
                <TripSummary type={type} legs={legs} passengers={passengers} />
              )}
            </div>
            <button
              type="button"
              onClick={() => setEditOpen((v) => !v)}
              className={
                'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors shrink-0 ' +
                (editOpen
                  ? 'bg-indigo text-white border-indigo'
                  : 'bg-surface border-border text-text-secondary hover:border-indigo-border hover:text-text-primary')
              }
              aria-expanded={editOpen}
              aria-controls="edit-search-panel"
            >
              <Edit3 size={12} /> {editOpen ? 'Close' : 'Edit search'}
            </button>
          </div>

          {editOpen && !hasInvalidParams && (
            <div id="edit-search-panel" className="mt-3">
              <EditSearchPanel
                type={type as EditTripType}
                legs={legs as EditSearchLeg[]}
                passengers={passengers}
                onSubmit={handleEditSubmit}
                onClose={() => setEditOpen(false)}
              />
            </div>
          )}
        </div>

        {hasInvalidParams ? (
          <div className="section-shell p-6 text-center">
            <SearchX size={32} className="text-text-xmuted mx-auto mb-3" />
            <p className="text-base font-bold text-text-primary mb-1">Missing search details</p>
            <p className="text-sm text-text-muted mb-4">
              We couldn't read the search you tried. Start a new one from the home page.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo text-white text-sm font-bold hover:bg-indigo/90 transition-all"
            >
              Back to search <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {type === 'return' ? (
              <RoundTripSection result={roundTrip} passengers={passengers} legs={legs} />
            ) : type === 'multi' ? (
              <MultiCitySection
                result={multiCity}
                legCount={legs.length}
                passengers={passengers}
                legs={legs}
              />
            ) : (
              results.map((result) => (
                <ResultsSection
                  key={`${result.leg.origin}-${result.leg.destination}-${result.leg.date}`}
                  heading="Available flights"
                  result={result}
                  passengers={passengers}
                />
              ))
            )}

            {noResults && <ToolCrossSell />}
          </div>
        )}
      </div>
    </MarketingShellV2>
  );
}
