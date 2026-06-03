import { Airport } from '@fast-travel/shared';
import { haversineKm } from '../utils/haversine';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rawAirports: RawAirport[] = require('../data/airports.json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const rawGazetteer: GazetteerEntry[] = require('../data/airports.gazetteer.json');
/** OpenFlights-derived map of `originIATA -> directDestIATA[]`. Updated by
 *  `scripts/build-routes.ts`. Used to filter the When To Go suggested-routes
 *  endpoint so we only inspire users with flights they can take non-stop. */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const rawDirectRoutes: Record<string, string[]> = require('../data/direct-routes.json');

interface RawAirport {
  iata: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  timezone: string;
  /** Comma-separated alternate names / IATA metro codes / local-language
   *  spellings from OurAirports' `keywords` field. Matched (lower score)
   *  by search so e.g. BGY surfaces for "Milan" via "Milan Bergamo
   *  Airport", EWR for "New York" via "Manhattan, New York City, NYC",
   *  NRT for "Tokyo" via "TYO, Tokyo, Tokyo Narita Airport". May be
   *  empty for older/quieter airports OurAirports hasn't tagged. */
  keywords?: string;
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
  /** Per-origin Set of destination IATAs with at least one non-stop service. */
  private directDestsByOrigin: Map<string, Set<string>>;
  /** Global popularity score: how many origins serve a given destination. Used
   *  to rank residual direct-destination fallbacks when the curated list runs
   *  out — busier hubs are more inspiring than tiny regional pairings. */
  private destinationPopularity: Map<string, number>;

  constructor() {
    this.byIata = new Map(this.airports.map((a) => [a.iata.toUpperCase(), a]));

    this.directDestsByOrigin = new Map();
    this.destinationPopularity = new Map();
    for (const [origin, dests] of Object.entries(rawDirectRoutes)) {
      this.directDestsByOrigin.set(origin, new Set(dests));
      for (const dest of dests) {
        this.destinationPopularity.set(
          dest,
          (this.destinationPopularity.get(dest) ?? 0) + 1,
        );
      }
    }
  }

  /** Fuzzy search across IATA, city, airport name, and keyword aliases.
   *  Returns top 12 so multi-airport cities (London → LHR/LGW/STN/LCY/LTN/SEN,
   *  Moscow → 4, New York → JFK/LGA/EWR-via-keywords, etc.) can all surface
   *  for the user to choose. Same-city airports are co-located in the result
   *  via the alpha tie-break. Diacritic-insensitive: "Sao Paulo" matches
   *  "São Paulo". Keyword-matching surfaces airports marketed as a different
   *  city than their municipality — BGY for "Milan" (kw: "Milan Bergamo"),
   *  EWR for "New York" (kw: "Manhattan, NYC"), TSF for "Venice" (kw:
   *  "Venice-Treviso"), etc. */
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
      // "London, Essex"). The build script strips that suffix, but keep
      // the leading-token split as a safety net for any cases we miss.
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

      // Keyword aliases — lowest tier, only checked if nothing else matched.
      // Score 45 sits below name-contains so well-named matches always lead;
      // keyword hits fill in airports the user knows by marketing name only.
      if (score === 0 && airport.keywords) {
        const kwNorm = normalizePlaceName(airport.keywords);
        if (kwNorm.includes(qNorm)) score = 45;
      }

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

  /** True if `origin` has at least one non-stop service to `dest` according
   *  to the OpenFlights-derived dataset (see scripts/build-routes.ts). */
  hasDirectRoute(originIata: string, destIata: string): boolean {
    const set = this.directDestsByOrigin.get(originIata.toUpperCase());
    if (!set) return false;
    return set.has(destIata.toUpperCase());
  }

  /** Non-stop destinations served from `origin`, ranked by global popularity
   *  (how many origins also serve that destination — busier hubs first). The
   *  suggested-routes endpoint uses this as a last-resort fallback when the
   *  curated regional list runs dry for a small origin airport. */
  directDestinations(originIata: string): string[] {
    const set = this.directDestsByOrigin.get(originIata.toUpperCase());
    if (!set) return [];
    return [...set].sort((a, b) => {
      const pa = this.destinationPopularity.get(a) ?? 0;
      const pb = this.destinationPopularity.get(b) ?? 0;
      return pb - pa || a.localeCompare(b);
    });
  }
}

export const airportService = new AirportService();
