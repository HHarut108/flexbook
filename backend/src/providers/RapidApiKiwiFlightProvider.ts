import { FlightOption } from '@fast-travel/shared';
import axios, { AxiosError } from 'axios';
import { config } from '../config';
import { KiwiSearchOptions } from './KiwiFlightProvider';

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
  const { sort = 'price', maxStopovers, currency = 'USD', cabinClass = 'M', passengers = 1 } = options;

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
    contentProviders: 'KIWI,KAYAK,FRESH',
    limit: 50,
    outboundDepartureDateStart: `${date}T00:00:00`,
    outboundDepartureDateEnd: `${date}T23:59:59`,
  };

  if (destinationIata) {
    params['destination'] = `Airport:${destinationIata}`;
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
        priceUsd: parseFloat(it.price.amount) * passengers,
        bookingUrl,
      };
    });
}
