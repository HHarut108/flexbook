import { FlightOption } from '@fast-travel/shared';
import axios, { AxiosError } from 'axios';
import { config } from '../config';
import { KiwiSearchOptions } from './KiwiFlightProvider';

const RAPIDAPI_HOST = 'kiwi-com-cheap-flights.p.rapidapi.com';

interface RapidKiwiSegment {
  id: string;
  source: {
    station: { code: string; city: { name: string; country: { name: string }; coordinates: { lat: number; lng: number } } };
    localTime: string;
    utcTime: string;
  };
  destination: {
    station: { code: string; city: { name: string; coordinates: { lat: number; lng: number } } };
    localTime: string;
  };
  duration: number;
  carrier: { code: string; name: string };
  operatingCarrier?: { code: string; name: string };
}

interface RapidKiwiItinerary {
  id: string;
  duration: number;
  price: { amount: number; currencyCode: string };
  segments: RapidKiwiSegment[];
  bookingOptions: { bookingUrl: string }[];
}

interface RapidKiwiResponse {
  itineraries: RapidKiwiItinerary[];
}

export async function fetchRapidApiKiwiFlights(
  originIata: string,
  date: string,
  destinationIata?: string,
  options: KiwiSearchOptions = {},
): Promise<FlightOption[]> {
  const { sort = 'price', maxStopovers, currency = 'USD', cabinClass = 'M' } = options;

  const cabinClassMap: Record<string, string> = {
    M: 'ECONOMY',
    W: 'PREMIUM_ECONOMY',
    C: 'BUSINESS',
    F: 'FIRST',
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
    handbags: 1,
    holdbags: 0,
    cabinClass: cabinClassMap[cabinClass] ?? 'ECONOMY',
    sortBy: sortByMap[sort] ?? 'PRICE',
    sortOrder: 'ASCENDING',
    transportTypes: 'FLIGHT',
    limit: 50,
    outboundDepartureDate: date,
  };

  if (destinationIata) {
    params['destination'] = `Airport:${destinationIata}`;
  }
  if (maxStopovers !== undefined) {
    params['maxStopovers'] = maxStopovers;
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
          'Content-Type': 'application/json',
        },
      },
    );
    response = data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;
      if (status === 429) throw new Error('RapidAPI Kiwi rate limit reached');
      if (status === 401 || status === 403) throw new Error('RapidAPI Kiwi: invalid or missing API key');
      if (status && [502, 503, 504].includes(status)) throw new Error(`RapidAPI Kiwi unavailable (HTTP ${status})`);
    }
    throw err;
  }

  if (!Array.isArray(response.itineraries)) return [];

  return response.itineraries
    .filter((it) => it.segments?.length > 0)
    .map((it): FlightOption => {
      const first = it.segments[0];
      const last = it.segments[it.segments.length - 1];
      const dest = last.destination.station;
      const orig = first.source.station;
      const viaIatas = it.segments.length > 1
        ? it.segments.slice(0, -1).map((s) => s.destination.station.code)
        : undefined;

      return {
        flightId: it.id,
        originIata: orig.code,
        originCity: orig.city.name,
        destinationIata: dest.code,
        destinationCity: dest.city.name,
        destinationCountry: orig.city.country?.name ?? '',
        destinationLat: dest.city.coordinates?.lat ?? 0,
        destinationLng: dest.city.coordinates?.lng ?? 0,
        departureDatetime: first.source.localTime,
        arrivalDatetime: last.destination.localTime,
        durationMinutes: Math.round(it.duration / 60),
        airlineName: first.carrier.name ?? first.carrier.code,
        airlineCode: first.carrier.code,
        stops: it.segments.length - 1,
        viaIatas,
        priceUsd: it.price.amount,
        bookingUrl: it.bookingOptions?.[0]?.bookingUrl ?? '',
      };
    });
}
