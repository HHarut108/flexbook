import { Airport } from '@fast-travel/shared';
import { haversineKm } from '../utils/haversine';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rawAirports: RawAirport[] = require('../data/airports.json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const rawGazetteer: GazetteerEntry[] = require('../data/airports.gazetteer.json');

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

/** Slim place record built from the wider OurAirports set (including small
 *  regional fields with no scheduled service). Used to resolve a typed-in
 *  city name to coordinates when no commercial airport matches directly —
 *  e.g. "São Carlos" → (-21.78, -47.88) → nearest commercial = VCP/GRU. */
interface GazetteerEntry {
  city: string;
  cityNorm: string;
  lat: number;
  lng: number;
  cc: string;
}

export interface SearchWithFallback {
  results: Airport[];
  /** Present only when the regular search returned 0 and we resolved the
   *  query to a known place outside the commercial dataset. The frontend
   *  uses this to render a "No airport in <place>. Did you mean:" header. */
  fallback?: {
    matchedPlace: string;
    countryCode: string;
    /** Radius in km used to find the airports in `results`. */
    radiusKm: number;
  };
}

const FALLBACK_RADIUS_KM = 300;

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

/** Lowercase + diacritic-strip so "Sao Carlos" matches "São Carlos" and
 *  "Zurich" matches "Zürich". Must match build-airports.ts. */
function normalizePlaceName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export class AirportService {
  private airports: RawAirport[] = rawAirports;
  private gazetteer: GazetteerEntry[] = rawGazetteer;
  private byIata: Map<string, RawAirport>;

  constructor() {
    this.byIata = new Map(this.airports.map((a) => [a.iata.toUpperCase(), a]));
  }

  /** Fuzzy search across IATA, city, and airport name. Returns top 12 so
   *  multi-airport cities (London → LHR/LGW/STN/LCY/LTN/SEN, Moscow → 4,
   *  New York → JFK/LGA, etc.) can all surface for the user to choose.
   *  Same-city airports are co-located in the result via the alpha tie-break.
   *  Diacritic-insensitive: "Sao Paulo" matches "São Paulo". */
  search(query: string): Airport[] {
    if (!query || query.trim().length < 1) return [];
    const raw = query.trim();
    const q = raw.toUpperCase();
    const qNorm = normalizePlaceName(raw);
    const results: Array<{ airport: RawAirport; score: number }> = [];

    for (const airport of this.airports) {
      const iata = airport.iata.toUpperCase();
      const cityUpper = airport.city.toUpperCase();
      const nameUpper = airport.name.toUpperCase();
      // OurAirports stores some municipalities as "City, Region" (e.g.
      // "London, Essex"). Match against just the leading token so a search
      // for "London" still treats Stansted as a London city-match.
      const cityHead = cityUpper.split(',')[0].trim();
      const cityHeadNorm = normalizePlaceName(cityHead);
      const nameNorm = normalizePlaceName(nameUpper);

      let score = 0;
      if (iata === q) score = 100;
      else if (cityHead === q || cityHeadNorm === qNorm) score = 95;
      else if (cityHead.startsWith(q) || cityHeadNorm.startsWith(qNorm)) score = 85;
      else if (nameUpper.startsWith(q) || nameNorm.startsWith(qNorm)) score = 75;
      else if (cityHead.includes(q) || cityHeadNorm.includes(qNorm)) score = 65;
      else if (nameUpper.includes(q) || nameNorm.includes(qNorm)) score = 55;

      if (score > 0) results.push({ airport, score });
    }

    return results
      .sort((a, b) => b.score - a.score || a.airport.city.localeCompare(b.airport.city))
      .slice(0, 12)
      .map(({ airport }) => toAirport(airport));
  }

  /** Like search() but with a "did you mean" fallback: when the regular
   *  search returns zero results, look the query up against the wider place
   *  gazetteer (places that have any airport, including non-commercial
   *  regional fields). If found, return the nearest commercial airports
   *  within 300 km along with a `fallback` marker so the UI can frame them
   *  as "No airport in <city>. Did you mean:". */
  searchWithFallback(query: string): SearchWithFallback {
    const direct = this.search(query);
    if (direct.length > 0) return { results: direct };

    const qNorm = normalizePlaceName(query);
    if (!qNorm) return { results: [] };

    // Prefer exact, then starts-with, then contains — same ranking logic as
    // the main search but against the gazetteer's normalized field only.
    let best: GazetteerEntry | undefined;
    let bestRank = Infinity;
    for (const entry of this.gazetteer) {
      let rank = Infinity;
      if (entry.cityNorm === qNorm) rank = 0;
      else if (entry.cityNorm.startsWith(qNorm)) rank = 1;
      else if (entry.cityNorm.includes(qNorm)) rank = 2;
      if (rank < bestRank) { best = entry; bestRank = rank; }
      if (bestRank === 0) break;
    }
    if (!best) return { results: [] };

    const results = this.nearbyByCoords(best.lat, best.lng, undefined, FALLBACK_RADIUS_KM);
    return {
      results,
      fallback: {
        matchedPlace: best.city,
        countryCode: best.cc,
        radiusKm: FALLBACK_RADIUS_KM,
      },
    };
  }

  /** Airports within 150 km of the given IATA, sorted by distance */
  nearby(iata: string): Airport[] {
    const origin = this.byIata.get(iata.toUpperCase());
    if (!origin) return [];
    return this.nearbyByCoords(origin.lat, origin.lng, origin.iata);
  }

  /** Airports within `radiusKm` (default 150) of a lat/lng position, sorted by distance */
  nearbyByCoords(lat: number, lng: number, excludeIata?: string, radiusKm = 150): Airport[] {
    const results: Array<{ airport: RawAirport; distanceKm: number }> = [];

    for (const airport of this.airports) {
      if (excludeIata && airport.iata.toUpperCase() === excludeIata.toUpperCase()) continue;
      const distanceKm = haversineKm(lat, lng, airport.lat, airport.lng);
      if (distanceKm <= radiusKm) results.push({ airport, distanceKm });
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
