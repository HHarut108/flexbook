import { FlightOption } from '@fast-travel/shared';
import { config } from '../config';
import { getCache, setCache } from '../utils/cache';
import { fetchKiwiFlights, KiwiSearchOptions } from '../providers/KiwiFlightProvider';
import { fetchSerpApiFlights, fetchSerpApiOpenFlights } from '../providers/SerpApiFlightProvider';
import { fetchMockFlights } from '../providers/MockFlightProvider';
import { airportService } from './AirportService';

function deduplicateByDestination(flights: FlightOption[]): FlightOption[] {
  const cheapestByDest = new Map<string, FlightOption>();
  for (const flight of flights) {
    const existing = cheapestByDest.get(flight.destinationIata);
    if (!existing || flight.priceUsd < existing.priceUsd) {
      cheapestByDest.set(flight.destinationIata, flight);
    }
  }
  return Array.from(cheapestByDest.values());
}

function enrichWithAirportData(
  flights: Omit<FlightOption, 'destinationCountry' | 'destinationLat' | 'destinationLng'>[],
): FlightOption[] {
  return flights.map((f) => {
    const destAirport = airportService.getByIata(f.destinationIata);
    const origAirport = airportService.getByIata(f.originIata);
    return {
      ...f,
      originCity: origAirport?.city.name ?? f.originCity,
      destinationCity: destAirport?.city.name ?? f.destinationCity,
      destinationCountry: destAirport?.city.countryName ?? '',
      destinationLat: destAirport?.city.lat ?? 0,
      destinationLng: destAirport?.city.lng ?? 0,
    };
  });
}

export class FlightService {
  async search(
    originIata: string,
    originCity: string,
    date: string,
    destinationIata?: string,
    deduplicate = true,
    limit = 10,
    options: KiwiSearchOptions = {},
    apiMode?: 'real' | 'mock',
  ): Promise<FlightOption[]> {
    const { sort = 'price', maxStopovers, currency = 'USD' } = options;
    
    // If apiMode is explicitly set to 'mock', use mock provider
    const provider = apiMode === 'mock' ? 'mock' : this.selectProvider(destinationIata);
    const cacheKey = `flights:${provider}:${originIata}:${date}:${destinationIata ?? 'any'}:${deduplicate}:${sort}:${maxStopovers ?? 'any'}:${currency}`;
    const cached = getCache<FlightOption[]>(cacheKey);
    if (cached) return cached.slice(0, limit);

    let raw: FlightOption[];

    if (provider === 'serpapi') {
      const partial = destinationIata
        ? await fetchSerpApiFlights(originIata, destinationIata, date, currency)
        : await fetchSerpApiOpenFlights(originIata, date, currency);
      raw = enrichWithAirportData(partial);
    } else if (provider === 'kiwi') {
      raw = await fetchKiwiFlights(originIata, date, destinationIata, options);
    } else {
      raw = await fetchMockFlights(originIata, originCity, date, destinationIata);
    }

    const deduplicated = deduplicate ? deduplicateByDestination(raw) : raw;
    const sorted = deduplicated.sort((a, b) => a.priceUsd - b.priceUsd);
    const top10 = sorted.slice(0, 10);
    setCache(cacheKey, top10);

    return top10.slice(0, limit);
  }

  private selectProvider(_destinationIata?: string): 'serpapi' | 'kiwi' | 'mock' {
    if (config.SERPAPI_API_KEY) return 'serpapi';
    if (config.KIWI_API_KEY) return 'kiwi';
    return 'mock';
  }
}

export const flightService = new FlightService();
