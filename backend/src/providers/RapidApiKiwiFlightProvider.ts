import { FlightOption } from '@fast-travel/shared';
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

interface RapidKiwiItinerary {
  id: string;
  price: { amount: string };
  priceEur?: { amount: string };
  bookingOptions?: { edges: { node: { bookingUrl: string } }[] };
  sector: {
    id: string;
    sectorSegments: { segment: RapidKiwiSegment; layover: unknown }[];
  };
}

interface RapidKiwiResponse {
  itineraries?: RapidKiwiItinerary[];
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
        timeout: 20000,
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
    .filter((it) => it.sector?.sectorSegments?.length > 0)
    .map((it): FlightOption => {
      const segments = it.sector.sectorSegments.map((s) => s.segment);
      const first = segments[0];
      const last = segments[segments.length - 1];
      const origStation = first.source.station;
      const destStation = last.destination.station;

      const totalDurationSec = segments.reduce((sum, s) => sum + (s.duration ?? 0), 0);

      const viaIatas = segments.length > 1
        ? segments.slice(0, -1).map((s) => s.destination.station.code)
        : undefined;
      const viaCoords = segments.length > 1
        ? segments.slice(0, -1)
            .map((s) => ({ lat: s.destination.station.gps?.lat ?? 0, lng: s.destination.station.gps?.lng ?? 0 }))
            .filter((c) => c.lat !== 0 || c.lng !== 0)
        : undefined;

      const rawBookingUrl = it.bookingOptions?.edges?.[0]?.node?.bookingUrl ?? '';
      const absoluteUrl = rawBookingUrl.startsWith('http')
        ? rawBookingUrl
        : rawBookingUrl ? `${KIWI_BASE}${rawBookingUrl}` : '';
      let bookingUrl = absoluteUrl;
      if (absoluteUrl && passengers > 1) {
        try {
          const u = new URL(absoluteUrl);
          u.searchParams.set('adults', String(passengers));
          bookingUrl = u.toString();
        } catch { /* leave bookingUrl as-is */ }
      }

      return {
        flightId: it.id,
        originIata: origStation.code,
        originCity: origStation.city?.name ?? origStation.code,
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
        priceUsd: parseFloat(it.price.amount) * passengers,
        bookingUrl,
      };
    });
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
