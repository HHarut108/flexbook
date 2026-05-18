import { FlightOption } from '@fast-travel/shared';
import { config } from '../config';
import { fetchRapidApiKiwiFlights, KiwiSearchOptions } from '../providers/RapidApiKiwiFlightProvider';
import { fetchSerpApiFlights, fetchSerpApiOpenFlights } from '../providers/SerpApiFlightProvider';
import { fetchMockFlights } from '../providers/MockFlightProvider';
import { airportService } from './AirportService';
import { increment, CallType } from '../utils/apiMetrics';
import { log } from '../utils/logger';
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

async function attachCachedPrices(
  entries: ScheduleEntry[],
): Promise<{ flights: FlightOption[]; hasStale: boolean; hasMissing: boolean }> {
  let hasStale = false;
  let hasMissing = false;
  const resolved = await Promise.all(entries.map(async (entry) => {
    const priceInfo = await getPriceInfo(entry.flightId);
    if (!priceInfo) {
      hasMissing = true;
      return null;
    }
    if (priceInfo.priceStatus === 'stale') hasStale = true;
    return {
      ...entry,
      priceUsd: priceInfo.amount,
      bookingUrl: priceInfo.deeplink,
      priceInfo,
    } as FlightOption;
  }));
  const flights = resolved.filter((f): f is FlightOption => f !== null);
  return { flights, hasStale, hasMissing };
}

export class FlightService {
  async search(
    originIata: string,
    originCity: string,
    date: string,
    destinationIata?: string,
    deduplicate = true,
    options: KiwiSearchOptions = {},
    apiMode?: 'real' | 'mock',
    bypassCache = false,
  ): Promise<FlightSearchResult> {
    const chain = this.providerChain(apiMode);
    const country = options.country;

    const cachedSchedule = bypassCache ? undefined : await getScheduleCache(originIata, date, destinationIata, country);
    if (cachedSchedule) {
      const { flights, hasStale, hasMissing } = await attachCachedPrices(cachedSchedule);
      // Fall through to a live fetch when no flights remain after dropping
      // entries with no cached price — otherwise the user sees an empty list.
      if (flights.length > 0) {
        if (hasStale || hasMissing) {
          this.refreshInBackground({ originIata, originCity, date, destinationIata, chain, options, deduplicate });
        }
        return { flights, cacheStatus: 'schedule_cached' };
      }
    }

    const { raw, usedProvider } = await this.callWithFallback(
      chain, originIata, originCity, date, destinationIata, options,
    );
    const processed = this.processFlights(raw, originIata, deduplicate);

    setScheduleCache(originIata, date, processed.map(toScheduleEntry), destinationIata, country);
    const withPrices = storePricesAndAttach(processed, usedProvider, date);

    return { flights: withPrices, cacheStatus: 'live' };
  }

  /** Ordered list of providers to try, from primary to fallback. */
  private providerChain(apiMode?: 'real' | 'mock'): Provider[] {
    if (apiMode === 'mock') return ['mock'];
    const chain: Provider[] = [];
    if (config.RAPIDAPI_KEY) chain.push('rapidapi-kiwi');
    if (config.SERPAPI_API_KEY) chain.push('serpapi');
    if (chain.length === 0) chain.push('mock');
    return chain;
  }

  /**
   * Iterates through the provider chain until one succeeds.
   * Increments the metric with 'primary' for the first provider and 'fallback' for any retry.
   */
  private async callWithFallback(
    chain: Provider[],
    originIata: string,
    originCity: string,
    date: string,
    destinationIata: string | undefined,
    options: KiwiSearchOptions,
  ): Promise<{ raw: FlightOption[]; usedProvider: string }> {
    let lastError: unknown;
    for (let i = 0; i < chain.length; i++) {
      const provider = chain[i];
      const callType: CallType = i === 0 ? 'primary' : 'fallback';
      increment(provider, callType);
      try {
        const raw = await this.callProvider(provider, originIata, originCity, date, destinationIata, options);
        return { raw, usedProvider: provider };
      } catch (err) {
        lastError = err;
        if (i < chain.length - 1) {
          log().warn(
            { provider, nextProvider: chain[i + 1], err: err instanceof Error ? err.message : err },
            'FlightService provider failed, falling back',
          );
        }
      }
    }
    throw lastError;
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
    chain: Provider[];
    options: KiwiSearchOptions;
    deduplicate: boolean;
  }): void {
    const { originIata, originCity, date, destinationIata, chain, options, deduplicate } = params;
    void (async () => {
      try {
        const { raw, usedProvider } = await this.callWithFallback(
          chain, originIata, originCity, date, destinationIata, options,
        );
        const processed = this.processFlights(raw, originIata, deduplicate);
        setScheduleCache(originIata, date, processed.map(toScheduleEntry), destinationIata, options.country);
        storePricesAndAttach(processed, usedProvider, date);
      } catch (err) {
        log().warn({ originIata, date, err }, 'flightCache background refresh failed');
      }
    })();
  }
}

export const flightService = new FlightService();
