import { FlightOption } from '@fast-travel/shared';
import axios, { AxiosError } from 'axios';
import { config } from '../config';

export class SerpApiRateLimitError extends Error {
  constructor() {
    super('SerpAPI rate limit reached');
    this.name = 'SerpApiRateLimitError';
  }
}

export class SerpApiUnavailableError extends Error {
  constructor(status: number) {
    super(`SerpAPI unavailable (HTTP ${status})`);
    this.name = 'SerpApiUnavailableError';
  }
}

interface SerpApiAirport {
  name: string;
  id: string;
  time: string; // "2024-01-15 08:00"
}

interface SerpApiFlightSegment {
  departure_airport: SerpApiAirport;
  arrival_airport: SerpApiAirport;
  duration: number;
  airplane: string;
  airline: string;
  airline_logo: string;
  travel_class: string;
  flight_number: string;
  overnight?: boolean;
}

interface SerpApiFlightResult {
  flights: SerpApiFlightSegment[];
  layovers?: { duration: number; name: string; id: string }[];
  total_duration: number;
  price: number;
  type: string;
  airline_logo: string;
}

interface SerpApiResponse {
  best_flights?: SerpApiFlightResult[];
  other_flights?: SerpApiFlightResult[];
  error?: string;
}

function buildGoogleFlightsUrl(origin: string, dest: string, date: string): string {
  return `https://www.google.com/flights#search;f=${origin};t=${dest};d=${date};tt=o`;
}

function parseFlightTime(time: string): string {
  // SerpAPI returns "2024-01-15 08:00" — convert to ISO 8601
  return time.replace(' ', 'T') + ':00';
}

// Popular global destinations used for open "fly anywhere" searches
const OPEN_SEARCH_DESTINATIONS = [
  'LHR', 'CDG', 'AMS', 'FCO', 'MAD', 'BCN', 'VIE', 'PRG', 'ATH', 'LIS',
  'IST', 'DXB', 'BKK', 'NRT', 'SIN', 'JFK', 'MIA', 'CUN', 'GRU', 'SYD',
];

export async function fetchSerpApiOpenFlights(
  originIata: string,
  date: string,
  currency = 'USD',
): Promise<Omit<FlightOption, 'destinationCountry' | 'destinationLat' | 'destinationLng'>[]> {
  const destinations = OPEN_SEARCH_DESTINATIONS.filter((d) => d !== originIata);

  const results = await Promise.allSettled(
    destinations.map((dest) => fetchSerpApiFlights(originIata, dest, date, currency)),
  );

  const flights: Omit<FlightOption, 'destinationCountry' | 'destinationLat' | 'destinationLng'>[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      // Take the cheapest option per destination
      const cheapest = result.value.reduce((a, b) => (a.priceUsd <= b.priceUsd ? a : b));
      flights.push(cheapest);
    }
  }

  return flights;
}

export async function fetchSerpApiFlights(
  originIata: string,
  destinationIata: string,
  date: string,
  currency = 'USD',
): Promise<Omit<FlightOption, 'destinationCountry' | 'destinationLat' | 'destinationLng'>[]> {
  let response: SerpApiResponse;

  try {
    const { data } = await axios.get<SerpApiResponse>('https://serpapi.com/search', {
      params: {
        engine: 'google_flights',
        departure_id: originIata,
        arrival_id: destinationIata,
        outbound_date: date,
        type: 2, // one-way
        currency,
        hl: 'en',
        api_key: config.SERPAPI_API_KEY,
      },
    });
    response = data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;
      if (status === 429) throw new SerpApiRateLimitError();
      if (status === 503 || status === 502 || status === 504) {
        throw new SerpApiUnavailableError(status);
      }
    }
    throw err;
  }

  if (response.error) {
    throw new Error(`SerpAPI error: ${response.error}`);
  }

  const allResults = [...(response.best_flights ?? []), ...(response.other_flights ?? [])];

  return allResults.map((result, index) => {
    const firstSeg = result.flights[0];
    const lastSeg = result.flights[result.flights.length - 1];
    const stops = result.flights.length - 1;
    const viaIatas =
      stops > 0 ? result.flights.slice(0, -1).map((seg) => seg.arrival_airport.id) : undefined;

    // Derive airline code from flight number prefix (e.g. "UA123" → "UA")
    const airlineCode = firstSeg.flight_number.match(/^([A-Z]{2})/)?.[1] ?? undefined;

    return {
      flightId: `SERP-${originIata}-${destinationIata}-${date}-${index}`,
      originIata,
      originCity: firstSeg.departure_airport.name,
      destinationIata,
      destinationCity: lastSeg.arrival_airport.name,
      departureDatetime: parseFlightTime(firstSeg.departure_airport.time),
      arrivalDatetime: parseFlightTime(lastSeg.arrival_airport.time),
      durationMinutes: result.total_duration,
      airlineName: firstSeg.airline,
      airlineCode,
      stops,
      viaIatas,
      priceUsd: result.price,
      bookingUrl: buildGoogleFlightsUrl(originIata, destinationIata, date),
    };
  });
}
