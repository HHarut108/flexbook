import { Airport } from '@fast-travel/shared';
import { haversineKm } from '../utils/haversine';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rawAirports: RawAirport[] = require('../data/airports.json');

interface RawAirport {
  iata: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  timezone: string;
}

function toAirport(raw: RawAirport, distanceKm?: number): Airport {
  return {
    iata: raw.iata,
    name: raw.name,
    city: {
      id: raw.iata,
      name: raw.city,
      countryCode: raw.countryCode,
      countryName: raw.country,
      lat: raw.lat,
      lng: raw.lng,
    },
    timezone: raw.timezone,
    ...(distanceKm !== undefined && { distanceKm }),
  };
}

export class AirportService {
  private airports: RawAirport[] = rawAirports;
  private byIata: Map<string, RawAirport>;

  constructor() {
    this.byIata = new Map(this.airports.map((a) => [a.iata.toUpperCase(), a]));
  }

  /** 3-pass fuzzy search, returns top 7 */
  search(query: string): Airport[] {
    if (!query || query.trim().length < 1) return [];
    const q = query.trim().toUpperCase();
    const results: Array<{ airport: RawAirport; score: number }> = [];

    for (const airport of this.airports) {
      const iata = airport.iata.toUpperCase();
      const cityUpper = airport.city.toUpperCase();
      const nameUpper = airport.name.toUpperCase();

      let score = 0;
      if (iata === q) {
        score = 100;
      } else if (cityUpper.startsWith(q) || nameUpper.startsWith(q)) {
        score = 80;
      } else if (cityUpper.includes(q) || nameUpper.includes(q)) {
        score = 60;
      }

      if (score > 0) results.push({ airport, score });
    }

    return results
      .sort((a, b) => b.score - a.score || a.airport.city.localeCompare(b.airport.city))
      .slice(0, 7)
      .map(({ airport }) => toAirport(airport));
  }

  /** Airports within 150 km of the given IATA, sorted by distance */
  nearby(iata: string): Airport[] {
    const origin = this.byIata.get(iata.toUpperCase());
    if (!origin) return [];
    return this.nearbyByCoords(origin.lat, origin.lng, origin.iata);
  }

  /** Airports within 150 km of a lat/lng position, sorted by distance */
  nearbyByCoords(lat: number, lng: number, excludeIata?: string): Airport[] {
    const results: Array<{ airport: RawAirport; distanceKm: number }> = [];

    for (const airport of this.airports) {
      if (excludeIata && airport.iata.toUpperCase() === excludeIata.toUpperCase()) continue;
      const distanceKm = haversineKm(lat, lng, airport.lat, airport.lng);
      if (distanceKm <= 150) results.push({ airport, distanceKm });
    }

    return results
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 6)
      .map(({ airport, distanceKm }) => toAirport(airport, Math.round(distanceKm)));
  }

  getByIata(iata: string): Airport | undefined {
    const raw = this.byIata.get(iata.toUpperCase());
    return raw ? toAirport(raw) : undefined;
  }
}

export const airportService = new AirportService();
