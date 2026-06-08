import { FlightOption, RoundTripOption, Layover } from '@fast-travel/shared';
import axios, { AxiosError } from 'axios';
import { config } from '../config';

export interface KiwiSearchOptions {
  sort?: 'price' | 'duration' | 'quality';
  maxStopovers?: number;
  currency?: string;
  cabinClass?: 'M' | 'W' | 'C' | 'F';
  passengers?: number;
  /** 2-letter ISO country code. When set (and destinationIata is not), Kiwi
   *  searches for flights to any airport in that country via `destination=Country:XX`. */
  country?: string;
}

export class RapidApiRateLimitError extends Error {
  constructor() {
    super('RapidAPI Kiwi rate limit reached');
    this.name = 'RapidApiRateLimitError';
  }
}

export class RapidApiAuthError extends Error {
  constructor() {
    super('RapidAPI Kiwi: invalid or missing API key');
    this.name = 'RapidApiAuthError';
  }
}

export class RapidApiUnavailableError extends Error {
  constructor(status: number) {
    super(`RapidAPI Kiwi unavailable (HTTP ${status})`);
    this.name = 'RapidApiUnavailableError';
  }
}

const RAPIDAPI_HOST = 'kiwi-com-cheap-flights.p.rapidapi.com';
const KIWI_BASE = 'https://www.kiwi.com';

interface RapidKiwiStation {
  code: string;
  name: string;
  gps?: { lat: number; lng: number };
  city?: { name: string };
  country?: { code: string; name?: string };
}

interface RapidKiwiSegment {
  id: string;
  source: { localTime: string; utcTime: string; station: RapidKiwiStation };
  destination: { localTime: string; utcTime: string; station: RapidKiwiStation };
  duration: number;
  carrier: { code: string; name: string };
  operatingCarrier?: { code: string; name: string };
  cabinClass?: string;
}

/**
 * Layover metadata from Kiwi. `isBaggageRecheck=true` means the user must
 * collect bags and check in again at the layover airport — i.e. the legs
 * are not interlined and the itinerary is a "self-transfer". Same-carrier
 * legs can still be self-transfer if booked across non-interlining tickets.
 */
interface RapidKiwiLayover {
  duration?: number;
  isBaggageRecheck?: boolean;
  isWalkingDistance?: boolean;
  transferDuration?: number | null;
  id?: string;
}

interface RapidKiwiSector {
  id: string;
  sectorSegments: { segment: RapidKiwiSegment; layover: RapidKiwiLayover | null }[];
}

interface RapidKiwiItinerary {
  id: string;
  price: { amount: string };
  priceEur?: { amount: string };
  bookingOptions?: { edges: { node: { bookingUrl: string } }[] };
  /** /one-way endpoint shape: one outbound sector. */
  sector?: RapidKiwiSector;
  /** /round-trip endpoint shape: paired outbound + inbound sectors. */
  outbound?: RapidKiwiSector;
  inbound?: RapidKiwiSector;
  /** Some response variants pack both legs into a `sectors` array. */
  sectors?: RapidKiwiSector[];
}

interface RapidKiwiResponse {
  itineraries?: RapidKiwiItinerary[];
}

/**
 * Pull outbound + inbound sectors out of a round-trip itinerary, accommodating
 * the two shapes Kiwi's RapidAPI surface uses interchangeably (named fields vs
 * a sectors[] array).
 */
function extractRoundTripSectors(it: RapidKiwiItinerary): { outbound: RapidKiwiSector; inbound: RapidKiwiSector } | null {
  if (it.outbound && it.inbound) return { outbound: it.outbound, inbound: it.inbound };
  if (it.sectors && it.sectors.length >= 2) return { outbound: it.sectors[0], inbound: it.sectors[1] };
  return null;
}

/**
 * Build a FlightOption from a single sector. Shared between the one-way and
 * round-trip paths so leg-level rendering (stops, via, duration, airline)
 * stays identical regardless of which endpoint returned it.
 *
 * Price-attaching is the caller's job: round-trip pairs carry a *combined*
 * price, not per-leg, so we leave priceUsd at 0 here.
 */
function sectorToFlightOption(
  sector: RapidKiwiSector,
  itineraryId: string,
  legSuffix: string,
): Omit<FlightOption, 'priceUsd' | 'bookingUrl'> | null {
  const segments = sector.sectorSegments?.map((s) => s.segment) ?? [];
  if (segments.length === 0) return null;

  const first = segments[0];
  const last = segments[segments.length - 1];
  const origStation = first.source.station;
  const destStation = last.destination.station;
  const flightTimeSec = segments.reduce((sum, s) => sum + (s.duration ?? 0), 0);

  // Door-to-door duration: departure-of-first → arrival-of-last in UTC.
  // We prefer utcTime when present (immune to DST/timezone arithmetic);
  // fall back to localTime parsed as a date. This is what the card surfaces
  // because total elapsed time is what the user actually plans around.
  const departureUtc = first.source.utcTime ?? first.source.localTime;
  const arrivalUtc = last.destination.utcTime ?? last.destination.localTime;
  const totalMs = new Date(arrivalUtc).getTime() - new Date(departureUtc).getTime();
  const durationMinutes = Number.isFinite(totalMs) && totalMs > 0
    ? Math.round(totalMs / 60000)
    : Math.round(flightTimeSec / 60); // fall back to flight time if dates can't be parsed

  const viaIatas =
    segments.length > 1 ? segments.slice(0, -1).map((s) => s.destination.station.code) : undefined;
  const viaCoords =
    segments.length > 1
      ? segments
          .slice(0, -1)
          .map((s) => ({
            lat: s.destination.station.gps?.lat ?? 0,
            lng: s.destination.station.gps?.lng ?? 0,
          }))
          .filter((c) => c.lat !== 0 || c.lng !== 0)
      : undefined;

  // Layovers: one entry per inter-segment gap. Duration = arrival of leg i to
  // departure of leg i+1. selfTransfer comes from Kiwi's `isBaggageRecheck`
  // flag when present — that's the authoritative signal (e.g. same-carrier
  // legs can still be self-transfer when booked across separate tickets).
  // Fallback when the flag is absent: different carrier codes across the
  // gap is a strong proxy that the user has to recheck bags themselves.
  const sectorSegmentsRaw = sector.sectorSegments ?? [];
  let layovers: Layover[] | undefined;
  if (segments.length > 1) {
    layovers = [];
    for (let i = 0; i < segments.length - 1; i++) {
      const prev = segments[i];
      const next = segments[i + 1];
      const arr = prev.destination.utcTime ?? prev.destination.localTime;
      const dep = next.source.utcTime ?? next.source.localTime;
      const gapMs = new Date(dep).getTime() - new Date(arr).getTime();
      const gapMinutes = Number.isFinite(gapMs) && gapMs > 0 ? Math.round(gapMs / 60000) : 0;
      // The layover sits on the segment AFTER the gap (sectorSegments[i+1]),
      // mirroring Kiwi's response: the first segment has layover=null.
      const kiwiLayover = sectorSegmentsRaw[i + 1]?.layover ?? null;
      const selfTransfer =
        kiwiLayover?.isBaggageRecheck === true ||
        (kiwiLayover === null && prev.carrier.code !== next.carrier.code);
      layovers.push({
        iata: prev.destination.station.code,
        durationMinutes: gapMinutes,
        selfTransfer,
      });
    }
  }

  // Unique carriers in order of first appearance. Reveals multi-carrier
  // itineraries (e.g. Wizz Air Malta + Ryanair) that the single airlineName
  // field hides today.
  const carrierNames: string[] = [];
  const seenCarriers = new Set<string>();
  for (const s of segments) {
    const name = s.carrier.name ?? s.carrier.code;
    if (!seenCarriers.has(name)) {
      seenCarriers.add(name);
      carrierNames.push(name);
    }
  }

  return {
    flightId: `${itineraryId}:${legSuffix}`,
    originIata: origStation.code,
    originCity: origStation.city?.name ?? origStation.code,
    destinationIata: destStation.code,
    destinationCity: destStation.city?.name ?? destStation.code,
    destinationCountry: destStation.country?.name ?? destStation.country?.code ?? '',
    destinationLat: destStation.gps?.lat ?? 0,
    destinationLng: destStation.gps?.lng ?? 0,
    departureDatetime: first.source.localTime,
    arrivalDatetime: last.destination.localTime,
    durationMinutes,
    flightTimeMinutes: Math.round(flightTimeSec / 60),
    airlineName: first.carrier.name ?? first.carrier.code,
    airlineCode: first.carrier.code,
    carriers: carrierNames.length > 0 ? carrierNames : undefined,
    stops: segments.length - 1,
    viaIatas,
    viaCoords: viaCoords?.length ? viaCoords : undefined,
    layovers: layovers && layovers.length > 0 ? layovers : undefined,
  };
}

export async function fetchRapidApiKiwiFlights(
  originIata: string,
  date: string,
  destinationIata?: string,
  options: KiwiSearchOptions = {},
): Promise<FlightOption[]> {
  const { sort = 'price', maxStopovers, currency = 'USD', cabinClass = 'M', passengers = 1, country } = options;

  const cabinClassMap: Record<string, string> = {
    M: 'ECONOMY',
    W: 'ECONOMY_PREMIUM',
    C: 'BUSINESS',
    F: 'FIRST_CLASS',
  };

  const sortByMap: Record<string, string> = {
    price: 'PRICE',
    duration: 'DURATION',
    quality: 'QUALITY',
  };

  const params: Record<string, string | number> = {
    source: `Airport:${originIata}`,
    currency: currency.toLowerCase(),
    locale: 'en',
    adults: 1,
    children: 0,
    infants: 0,
    handbags: 0,
    holdbags: 0,
    cabinClass: cabinClassMap[cabinClass] ?? 'ECONOMY',
    sortBy: sortByMap[sort] ?? 'PRICE',
    sortOrder: 'ASCENDING',
    transportTypes: 'FLIGHT',
    // No `contentProviders` filter: Kiwi defaults to all providers. The previous
    // `KIWI,KAYAK,FRESH` triple excluded routes that exist on kiwi.com (notably
    // Wizz Air direct EVN→FMM on Jun 30 2026) — those itineraries live behind
    // other content providers and were never reaching us.
    // 250: high enough that mid-priced destinations (e.g. EVN→DTM, EVN→FMM ~$77)
    // aren't pushed out by ultra-cheap CIS/Turkey routes on an "anywhere" search.
    limit: 250,
    outboundDepartureDateStart: `${date}T00:00:00`,
    outboundDepartureDateEnd: `${date}T23:59:59`,
  };

  if (destinationIata) {
    params['destination'] = `Airport:${destinationIata}`;
  } else if (country) {
    // Country-scoped search: bypasses the "anywhere" endpoint's per-region quotas
    // and surfaces low-cost-carrier routes (e.g. Wizz EVN→FMM) that the unfiltered
    // search drops. ISO 3166 alpha-2, uppercased.
    params['destination'] = `Country:${country.toUpperCase()}`;
  }
  if (maxStopovers !== undefined) {
    params['maxStopsCount'] = maxStopovers;
  }

  let response: RapidKiwiResponse;
  try {
    const { data } = await axios.get<RapidKiwiResponse>(
      `https://${RAPIDAPI_HOST}/one-way`,
      {
        params,
        headers: {
          'x-rapidapi-key': config.RAPIDAPI_KEY,
          'x-rapidapi-host': RAPIDAPI_HOST,
        },
        // 30s: indirect routes with no direct option (e.g. EVN→MAD via FCO/SAW)
        // force Kiwi to expand the connection graph and routinely exceed 20s.
        timeout: 30000,
      },
    );
    response = data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;
      if (status === 429) throw new RapidApiRateLimitError();
      if (status === 401 || status === 403) throw new RapidApiAuthError();
      if (status && [502, 503, 504].includes(status)) throw new RapidApiUnavailableError(status);
    }
    throw err;
  }

  const itineraries = response.itineraries ?? [];

  return itineraries
    .map((it): FlightOption | null => {
      if (!it.sector?.sectorSegments?.length) return null;
      const leg = sectorToFlightOption(it.sector, it.id, 'out');
      if (!leg) return null;

      const rawBookingUrl = it.bookingOptions?.edges?.[0]?.node?.bookingUrl ?? '';
      const bookingUrl = applyPassengersToBookingUrl(rawBookingUrl, passengers);

      return {
        ...leg,
        flightId: it.id,
        priceUsd: parseFloat(it.price.amount) * passengers,
        bookingUrl,
      };
    })
    .filter((f): f is FlightOption => f !== null);
}

function applyPassengersToBookingUrl(rawBookingUrl: string, passengers: number): string {
  const absoluteUrl = rawBookingUrl.startsWith('http')
    ? rawBookingUrl
    : rawBookingUrl
      ? `${KIWI_BASE}${rawBookingUrl}`
      : '';
  if (!absoluteUrl || passengers <= 1) return absoluteUrl;
  try {
    const u = new URL(absoluteUrl);
    u.searchParams.set('adults', String(passengers));
    return u.toString();
  } catch {
    return absoluteUrl;
  }
}

// ─── Round-trip mode ───────────────────────────────────────────────────────────
// Kiwi's `/round-trip` endpoint accepts paired outbound and inbound date windows
// and returns itineraries where both legs are sold together at a single bundled
// price — frequently cheaper than two one-ways stitched together. We surface
// the pair intact (not as two independent legs) so the user sees the airline's
// actual round-trip fare and books it as one transaction.

export interface KiwiRoundTripOptions {
  currency?: string;
  cabinClass?: 'M' | 'W' | 'C' | 'F';
  passengers?: number;
  /** Cap on the number of pairs the upstream returns. */
  limit?: number;
  /** Max stopovers per leg. Omit for any. */
  maxStopovers?: number;
}

export async function fetchRapidApiKiwiRoundTrip(
  originIata: string,
  destinationIata: string,
  outboundDate: string,
  inboundDate: string,
  options: KiwiRoundTripOptions = {},
): Promise<RoundTripOption[]> {
  const { currency = 'USD', cabinClass = 'M', passengers = 1, limit = 50, maxStopovers } = options;

  const cabinClassMap: Record<string, string> = {
    M: 'ECONOMY',
    W: 'ECONOMY_PREMIUM',
    C: 'BUSINESS',
    F: 'FIRST_CLASS',
  };

  const params: Record<string, string | number> = {
    source: `Airport:${originIata}`,
    destination: `Airport:${destinationIata}`,
    currency: currency.toLowerCase(),
    locale: 'en',
    adults: 1,
    children: 0,
    infants: 0,
    handbags: 0,
    holdbags: 0,
    cabinClass: cabinClassMap[cabinClass] ?? 'ECONOMY',
    sortBy: 'PRICE',
    sortOrder: 'ASCENDING',
    transportTypes: 'FLIGHT',
    limit,
    outboundDepartureDateStart: `${outboundDate}T00:00:00`,
    outboundDepartureDateEnd: `${outboundDate}T23:59:59`,
    inboundDepartureDateStart: `${inboundDate}T00:00:00`,
    inboundDepartureDateEnd: `${inboundDate}T23:59:59`,
  };
  if (maxStopovers !== undefined) {
    params['maxStopsCount'] = maxStopovers;
  }

  let response: RapidKiwiResponse;
  try {
    const { data } = await axios.get<RapidKiwiResponse>(
      `https://${RAPIDAPI_HOST}/round-trip`,
      {
        params,
        headers: {
          'x-rapidapi-key': config.RAPIDAPI_KEY,
          'x-rapidapi-host': RAPIDAPI_HOST,
        },
        timeout: 25000,
      },
    );
    response = data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;
      if (status === 429) throw new RapidApiRateLimitError();
      if (status === 401 || status === 403) throw new RapidApiAuthError();
      if (status && [502, 503, 504].includes(status)) throw new RapidApiUnavailableError(status);
    }
    throw err;
  }

  const itineraries = response.itineraries ?? [];
  const pairs: RoundTripOption[] = [];

  for (const it of itineraries) {
    const sectors = extractRoundTripSectors(it);
    if (!sectors) continue;

    const outboundLeg = sectorToFlightOption(sectors.outbound, it.id, 'out');
    const inboundLeg = sectorToFlightOption(sectors.inbound, it.id, 'in');
    if (!outboundLeg || !inboundLeg) continue;

    const combinedPrice = parseFloat(it.price?.amount ?? 'NaN');
    if (!Number.isFinite(combinedPrice) || combinedPrice <= 0) continue;
    const totalUsd = combinedPrice * passengers;

    const rawBookingUrl = it.bookingOptions?.edges?.[0]?.node?.bookingUrl ?? '';
    const bookingUrl = applyPassengersToBookingUrl(rawBookingUrl, passengers);

    // Each leg echoes the bundled total so consumers built around FlightOption
    // (cards, map preview) keep working. Callers must not sum the two — see
    // RoundTripOption.priceUsd in @fast-travel/shared.
    const outbound: FlightOption = { ...outboundLeg, priceUsd: totalUsd, bookingUrl };
    const inbound: FlightOption = { ...inboundLeg, priceUsd: totalUsd, bookingUrl };

    pairs.push({
      tripId: it.id,
      outbound,
      inbound,
      priceUsd: totalUsd,
      bookingUrl,
    });
  }

  return pairs;
}

// ─── Calendar mode ─────────────────────────────────────────────────────────────
// Kiwi's /one-way endpoint accepts an `outboundDepartureDateStart` /
// `outboundDepartureDateEnd` range and, when sorted ASCENDING by price, returns
// the cheapest itineraries across the entire window in a single call. The spike
// in scripts/spike-calendar.ts confirmed this works (one HTTP call returned 15
// distinct departure days for a 30-day range, ~2.7s, 1 quota unit).
//
// Range queries return at most ~25-50 itineraries truncated by price-asc, so
// long windows must be chunked by the *caller* to guarantee per-day coverage —
// see FlightService.priceCalendar for the chunking strategy.

export interface KiwiCalendarDay {
  /** YYYY-MM-DD departure date */
  date: string;
  /** Cheapest fare in the requested currency */
  priceUsd: number;
  currency: string;
  /** Deep link to book the cheapest itinerary for this day */
  bookingUrl?: string;
  /** Full itinerary metadata for the cheapest itinerary on this day. */
  itinerary?: KiwiCalendarItinerary;
}

/** Subset of FlightOption that the result card + map preview need. */
export interface KiwiCalendarItinerary {
  originIata: string;
  originCity: string;
  originLat: number;
  originLng: number;
  destinationIata: string;
  destinationCity: string;
  destinationCountry: string;
  destinationLat: number;
  destinationLng: number;
  departureDatetime: string;
  arrivalDatetime: string;
  durationMinutes: number;
  airlineName: string;
  airlineCode?: string;
  stops: number;
  viaIatas?: string[];
  viaCoords?: { lat: number; lng: number }[];
}

export async function fetchRapidApiKiwiCalendar(
  originIata: string,
  destinationIata: string,
  startDate: string,
  endDate: string,
  currency = 'USD',
): Promise<KiwiCalendarDay[]> {
  const params: Record<string, string | number> = {
    source: `Airport:${originIata}`,
    destination: `Airport:${destinationIata}`,
    currency: currency.toLowerCase(),
    locale: 'en',
    adults: 1,
    children: 0,
    infants: 0,
    handbags: 0,
    holdbags: 0,
    cabinClass: 'ECONOMY',
    sortBy: 'PRICE',
    sortOrder: 'ASCENDING',
    transportTypes: 'FLIGHT',
    // Match the per-day search limit. Range queries return a truncated set —
    // the caller (FlightService.priceCalendar) is responsible for chunking
    // ranges that span more than ~14 days so each chunk's top-N covers every
    // day with at least one itinerary.
    limit: 250,
    outboundDepartureDateStart: `${startDate}T00:00:00`,
    outboundDepartureDateEnd: `${endDate}T23:59:59`,
  };

  let response: RapidKiwiResponse;
  try {
    const { data } = await axios.get<RapidKiwiResponse>(
      `https://${RAPIDAPI_HOST}/one-way`,
      {
        params,
        headers: {
          'x-rapidapi-key': config.RAPIDAPI_KEY,
          'x-rapidapi-host': RAPIDAPI_HOST,
        },
        timeout: 30000,
      },
    );
    response = data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;
      if (status === 429) throw new RapidApiRateLimitError();
      if (status === 401 || status === 403) throw new RapidApiAuthError();
      if (status && [502, 503, 504].includes(status)) throw new RapidApiUnavailableError(status);
    }
    throw err;
  }

  const itineraries = response.itineraries ?? [];
  const byDay = new Map<string, KiwiCalendarDay>();

  for (const it of itineraries) {
    const sectorSegments = it?.sector?.sectorSegments ?? [];
    const segments = sectorSegments.map((s) => s.segment);
    const first = segments[0];
    const last = segments[segments.length - 1];
    if (!first || !last) continue;

    const dep = first.source?.localTime;
    if (!dep) continue;
    const day = dep.slice(0, 10); // YYYY-MM-DD
    const price = parseFloat(it?.price?.amount ?? 'NaN');
    if (!Number.isFinite(price) || price <= 0) continue;

    const rawBookingUrl = it.bookingOptions?.edges?.[0]?.node?.bookingUrl ?? '';
    const bookingUrl = rawBookingUrl
      ? rawBookingUrl.startsWith('http')
        ? rawBookingUrl
        : `${KIWI_BASE}${rawBookingUrl}`
      : undefined;

    const existing = byDay.get(day);
    if (existing && price >= existing.priceUsd) continue;

    const origStation = first.source.station;
    const destStation = last.destination.station;
    const totalDurationSec = segments.reduce((sum, s) => sum + (s.duration ?? 0), 0);

    const viaIatas =
      segments.length > 1 ? segments.slice(0, -1).map((s) => s.destination.station.code) : undefined;
    const viaCoords =
      segments.length > 1
        ? segments
            .slice(0, -1)
            .map((s) => ({
              lat: s.destination.station.gps?.lat ?? 0,
              lng: s.destination.station.gps?.lng ?? 0,
            }))
            .filter((c) => c.lat !== 0 || c.lng !== 0)
        : undefined;

    const itineraryMeta: KiwiCalendarItinerary = {
      originIata: origStation.code,
      originCity: origStation.city?.name ?? origStation.code,
      originLat: origStation.gps?.lat ?? 0,
      originLng: origStation.gps?.lng ?? 0,
      destinationIata: destStation.code,
      destinationCity: destStation.city?.name ?? destStation.code,
      destinationCountry: destStation.country?.name ?? destStation.country?.code ?? '',
      destinationLat: destStation.gps?.lat ?? 0,
      destinationLng: destStation.gps?.lng ?? 0,
      departureDatetime: first.source.localTime,
      arrivalDatetime: last.destination.localTime,
      durationMinutes: Math.round(totalDurationSec / 60),
      airlineName: first.carrier.name ?? first.carrier.code,
      airlineCode: first.carrier.code,
      stops: segments.length - 1,
      viaIatas,
      viaCoords: viaCoords?.length ? viaCoords : undefined,
    };

    byDay.set(day, {
      date: day,
      priceUsd: price,
      currency: currency.toUpperCase(),
      bookingUrl,
      itinerary: itineraryMeta,
    });
  }

  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}
