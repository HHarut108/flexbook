import { FlightOption } from '@fast-travel/shared';
import { config } from '../config';
import { KiwiSearchOptions } from '../providers/KiwiFlightProvider';
import { fetchRapidApiKiwiFlights } from '../providers/RapidApiKiwiFlightProvider';
import { fetchSerpApiFlights, fetchSerpApiOpenFlights } from '../providers/SerpApiFlightProvider';
import { fetchMockFlights } from '../providers/MockFlightProvider';
import { airportService } from './AirportService';
import {
  ScheduleEntry,
  getScheduleCache,
  setScheduleCache,
  getPriceInfo,
  setPriceInfo,
} from '../utils/flightCache';

export interface FlightSearchResult {
  flights: FlightOption[];
  cacheStatus: 'live' | 'schedule_cached';
}

type Provider = 'rapidapi-kiwi' | 'serpapi' | 'mock';

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

function toScheduleEntry(f: FlightOption): ScheduleEntry {
  return {
    flightId: f.flightId,
    originIata: f.originIata,
    originCity: f.originCity,
    destinationIata: f.destinationIata,
    destinationCity: f.destinationCity,
    destinationCountry: f.destinationCountry,
    destinationLat: f.destinationLat,
    destinationLng: f.destinationLng,
    departureDatetime: f.departureDatetime,
    arrivalDatetime: f.arrivalDatetime,
    durationMinutes: f.durationMinutes,
    airlineName: f.airlineName,
    airlineCode: f.airlineCode,
    stops: f.stops,
    viaIatas: f.viaIatas,
  };
}

function storePricesAndAttach(
  flights: FlightOption[],
  providerName: string,
  date: string,
): FlightOption[] {
  const now = new Date().toISOString();
  return flights.map((f) => {
    setPriceInfo(
      f.flightId,
      { amount: f.priceUsd, currency: 'USD', provider: providerName, deeplink: f.bookingUrl, priceUpdatedAt: now },
      date,
    );
    return {
      ...f,
      priceInfo: {
        amount: f.priceUsd,
        currency: 'USD',
        provider: providerName,
        deeplink: f.bookingUrl,
        priceUpdatedAt: now,
        priceStatus: 'live' as const,
      },
    };
  });
}

function attachCachedPrices(entries: ScheduleEntry[]): { flights: FlightOption[]; hasStale: boolean } {
  let hasStale = false;
  const flights: FlightOption[] = entries.map((entry) => {
    const priceInfo = getPriceInfo(entry.flightId);
    if (!priceInfo || priceInfo.priceStatus === 'stale') hasStale = true;

    const resolvedPriceInfo = priceInfo ?? {
      amount: 0,
      currency: 'USD',
      provider: 'unknown',
      deeplink: '',
      priceUpdatedAt: new Date(0).toISOString(),
      priceStatus: 'stale' as const,
    };

    return {
      ...entry,
      priceUsd: resolvedPriceInfo.amount,
      bookingUrl: resolvedPriceInfo.deeplink,
      priceInfo: resolvedPriceInfo,
    };
  });
  return { flights, hasStale };
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
  ): Promise<FlightSearchResult> {
    const provider: Provider = apiMode === 'mock' ? 'mock' : this.selectProvider();

    const cachedSchedule = getScheduleCache(originIata, date, destinationIata);
    if (cachedSchedule) {
      const { flights, hasStale } = attachCachedPrices(cachedSchedule);
      if (hasStale) {
        this.refreshInBackground({ originIata, originCity, date, destinationIata, provider, options, deduplicate });
      }
      return { flights: flights.slice(0, limit), cacheStatus: 'schedule_cached' };
    }

    const raw = await this.callProvider(provider, originIata, originCity, date, destinationIata, options);
    const processed = this.processFlights(raw, originIata, deduplicate);
    const top10 = processed.slice(0, 10);

    setScheduleCache(originIata, date, top10.map(toScheduleEntry), destinationIata);
    const withPrices = storePricesAndAttach(top10, provider, date);

    return { flights: withPrices.slice(0, limit), cacheStatus: 'live' };
  }

  private async callProvider(
    provider: Provider,
    originIata: string,
    originCity: string,
    date: string,
    destinationIata: string | undefined,
    options: KiwiSearchOptions,
  ): Promise<FlightOption[]> {
    const { currency = 'USD', passengers = 1 } = options;
    if (provider === 'rapidapi-kiwi') {
      return fetchRapidApiKiwiFlights(originIata, date, destinationIata, options);
    }
    if (provider === 'serpapi') {
      const partial = destinationIata
        ? await fetchSerpApiFlights(originIata, destinationIata, date, currency, passengers)
        : await fetchSerpApiOpenFlights(originIata, date, currency, passengers);
      return enrichWithAirportData(partial);
    }
    return fetchMockFlights(originIata, originCity, date, destinationIata);
  }

  private processFlights(raw: FlightOption[], originIata: string, deduplicate: boolean): FlightOption[] {
    const filtered = raw.filter((f) => f.destinationIata !== originIata);
    const deduped = deduplicate ? deduplicateByDestination(filtered) : filtered;
    return deduped.sort((a, b) => a.priceUsd - b.priceUsd);
  }

  private refreshInBackground(params: {
    originIata: string;
    originCity: string;
    date: string;
    destinationIata?: string;
    provider: Provider;
    options: KiwiSearchOptions;
    deduplicate: boolean;
  }): void {
    const { originIata, originCity, date, destinationIata, provider, options, deduplicate } = params;
    Promise.resolve()
      .then(async () => {
        try {
          console.log(`[flightCache] background refresh start ${originIata}:${date}`);
          const raw = await this.callProvider(provider, originIata, originCity, date, destinationIata, options);
          const top10 = this.processFlights(raw, originIata, deduplicate).slice(0, 10);
          setScheduleCache(originIata, date, top10.map(toScheduleEntry), destinationIata);
          storePricesAndAttach(top10, provider, date);
          console.log(`[flightCache] background refresh done ${originIata}:${date}`);
        } catch (err) {
          console.warn(`[flightCache] background refresh failed ${originIata}:${date}`, err);
        }
      })
      .catch((err) => {
        // Belt-and-suspenders: the inner try/catch should absorb all errors, but guard
        // here too so a bug in the catch block itself never causes an unhandled rejection.
        console.warn(`[flightCache] background refresh uncaught ${originIata}:${date}`, err);
      });
  }

  private selectProvider(): Provider {
    if (config.RAPIDAPI_KEY) return 'rapidapi-kiwi';
    if (config.SERPAPI_API_KEY) return 'serpapi';
    return 'mock';
  }
}

export const flightService = new FlightService();
