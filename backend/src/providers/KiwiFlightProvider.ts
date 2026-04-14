import { FlightOption } from '@fast-travel/shared';
import axios, { AxiosError } from 'axios';
import { config } from '../config';

export class KiwiRateLimitError extends Error {
  readonly retryAfter?: number;
  constructor(retryAfter?: number) {
    super('Kiwi API rate limit reached');
    this.name = 'KiwiRateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class KiwiUnavailableError extends Error {
  constructor(status: number) {
    super(`Kiwi API unavailable (HTTP ${status})`);
    this.name = 'KiwiUnavailableError';
  }
}

interface KiwiRoute {
  id: string;
  flyFrom: string;
  cityFrom: string;
  flyTo: string;
  cityTo: string;
  countryTo: { name: string };
  latitudeTo: number;
  longitudeTo: number;
  local_departure: string;
  local_arrival: string;
  duration: { total: number };
  airlines: string[];
  route: { flyFrom: string; flyTo: string; airline: string }[];
  price: number;
  deep_link: string;
}

interface KiwiResponse {
  data: KiwiRoute[];
}

export interface KiwiSearchOptions {
  /** Sort order. 'quality' ranks by price+duration+stops combined. Default: 'price' */
  sort?: 'price' | 'duration' | 'quality';
  /** Maximum number of stopovers. 0 = direct only. Omit for any. */
  maxStopovers?: number;
  /** 3-letter ISO currency code. Default: 'USD' */
  currency?: string;
  /** Cabin class. M=Economy, W=Premium Economy, C=Business, F=First. Default: M */
  cabinClass?: 'M' | 'W' | 'C' | 'F';
}

export async function fetchKiwiFlights(
  originIata: string,
  date: string,
  destinationIata?: string,
  options: KiwiSearchOptions = {},
): Promise<FlightOption[]> {
  const [year, month, day] = date.split('-');
  const dateFormatted = `${day}/${month}/${year}`;
  const { sort = 'price', maxStopovers, currency = 'USD', cabinClass } = options;

  const searchParams: Record<string, string | number> = {
    fly_from: originIata,
    date_from: dateFormatted,
    date_to: dateFormatted,
    curr: currency,
    limit: 50,
    sort,
    partner: 'picky',
    vehicle_type: 'aircraft',
  };

  if (destinationIata) {
    searchParams['fly_to'] = destinationIata;
  }
  if (maxStopovers !== undefined) {
    searchParams['max_stopovers'] = maxStopovers;
  }
  if (cabinClass) {
    searchParams['selected_cabins'] = cabinClass;
  }

  let response: KiwiResponse;
  try {
    const { data } = await axios.get<KiwiResponse>(
      'https://api.tequila.kiwi.com/v2/search',
      { params: searchParams, headers: { apikey: config.KIWI_API_KEY } },
    );
    response = data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;
      if (status === 429) {
        const retryAfter = Number(axiosErr.response?.headers['retry-after']) || undefined;
        throw new KiwiRateLimitError(retryAfter);
      }
      if (status === 503 || status === 502 || status === 504) {
        throw new KiwiUnavailableError(status);
      }
    }
    throw err;
  }

  return response.data.map((r: KiwiRoute) => ({
    flightId: r.id,
    originIata: r.flyFrom,
    originCity: r.cityFrom,
    destinationIata: r.flyTo,
    destinationCity: r.cityTo,
    destinationCountry: r.countryTo.name,
    destinationLat: r.latitudeTo,
    destinationLng: r.longitudeTo,
    departureDatetime: r.local_departure,
    arrivalDatetime: r.local_arrival,
    durationMinutes: Math.round(r.duration.total / 60),
    airlineName: r.airlines[0] ?? 'Unknown',
    airlineCode: r.airlines[0] ?? undefined,
    stops: r.route.length - 1,
    viaIatas: r.route.length > 1
      ? r.route.slice(0, -1).map((seg) => seg.flyTo)
      : undefined,
    priceUsd: r.price,
    bookingUrl: r.deep_link,
  }));
}
