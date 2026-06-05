import { Airport, AirportSearchEntry, City } from '@fast-travel/shared';
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
  results: AirportSearchEntry[];
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

/** A "City" search entry for a metropolitan area with ≥2 commercial
 *  airports. Built from airports.json at boot — no separate dataset.
 *  Stored value lives on `cityIndex`; serialised into the search
 *  response as `{ kind: 'city', city: { ..., airports } }`. */
interface DerivedCity {
  id: string;        // `${cityNorm}_${cc.lower}` — stable across builds
  name: string;
  countryCode: string;
  countryName: string;
  lat: number;       // centroid of member airports
  lng: number;       // centroid of member airports
  airports: string[]; // IATAs, ordered by direct-route popularity DESC
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

/** Project an internal DerivedCity onto the shared `City & { airports }`
 *  contract for /api/airports/search responses. */
function derivedToCity(d: DerivedCity): City & { airports: string[] } {
  return {
    id: d.id,
    name: d.name,
    countryCode: d.countryCode,
    countryName: d.countryName,
    lat: d.lat,
    lng: d.lng,
    airports: d.airports,
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
  /** Derived City entries (≥2 airports per metro). Map key is the city id
   *  (`${cityNorm}_${cc.lower}`), used by /api/airports/search results and
   *  resolved back to member IATAs in cityById(). */
  private cityIndex: Map<string, DerivedCity>;

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

    this.cityIndex = this.buildCityIndex();
  }

  /** Group airports by (normalized city name, country code). Any group with
   *  ≥2 airports becomes a selectable City. Member airports are ordered by
   *  destinationPopularity DESC so cost-capping later (top-N per city) keeps
   *  the busiest hubs. Skips airports whose normalized city name is empty
   *  (rare data-quality holes in OurAirports). */
  private buildCityIndex(): Map<string, DerivedCity> {
    const groups = new Map<string, RawAirport[]>();
    for (const a of this.airports) {
      const cityHead = a.city.split(',')[0].trim();
      const cityNorm = normalizePlaceName(cityHead);
      if (!cityNorm) continue;
      const key = `${cityNorm.replace(/[^a-z0-9]+/g, '_')}_${a.countryCode.toLowerCase()}`;
      const bucket = groups.get(key) ?? [];
      bucket.push(a);
      groups.set(key, bucket);
    }
    const index = new Map<string, DerivedCity>();
    for (const [id, members] of groups) {
      if (members.length < 2) continue;
      const sorted = [...members].sort((a, b) => {
        const pa = this.destinationPopularity.get(a.iata.toUpperCase()) ?? 0;
        const pb = this.destinationPopularity.get(b.iata.toUpperCase()) ?? 0;
        return pb - pa || a.iata.localeCompare(b.iata);
      });
      const cityHead = sorted[0].city.split(',')[0].trim();
      const lat = sorted.reduce((s, a) => s + a.lat, 0) / sorted.length;
      const lng = sorted.reduce((s, a) => s + a.lng, 0) / sorted.length;
      index.set(id, {
        id,
        name: cityHead,
        countryCode: sorted[0].countryCode,
        countryName: sorted[0].country,
        lat,
        lng,
        airports: sorted.map((a) => a.iata.toUpperCase()),
      });
    }
    return index;
  }

  /** Resolve a city id (e.g. "rome_it") to its derived entry, or undefined
   *  if unknown. Used by resolveLocation() to expand "@<id>" markers from
   *  flight route handlers into the list of member IATAs to fan out across. */
  cityById(id: string): DerivedCity | undefined {
    return this.cityIndex.get(id.toLowerCase());
  }

  /** Fuzzy search across IATA, city, airport name, and keyword aliases.
   *  Returns top 12 results as a mix of airport entries and "City" entries.
   *  When a query exactly matches a multi-airport city (e.g. "Rome"), the
   *  city entry gets a +5 score bias so it surfaces above the individual
   *  FCO/CIA rows — power users typing "FCO" still see the airport first
   *  because IATA-exact scores 100. Diacritic-insensitive: "Sao Paulo"
   *  matches "São Paulo". Keyword-matching surfaces airports marketed as a
   *  different city than their municipality — BGY for "Milan" (kw: "Milan
   *  Bergamo"), EWR for "New York" (kw: "Manhattan, NYC"), TSF for "Venice"
   *  (kw: "Venice-Treviso"), etc. */
  search(query: string): AirportSearchEntry[] {
    if (!query || query.trim().length < 1) return [];
    const raw = query.trim();
    const q = raw.toUpperCase();
    const qNorm = normalizePlaceName(raw);
    type AirportResult = { kind: 'airport'; airport: RawAirport; score: number };
    type CityResult = { kind: 'city'; city: DerivedCity; score: number };
    const results: Array<AirportResult | CityResult> = [];

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

      if (score > 0) results.push({ kind: 'airport', airport, score });
    }

    for (const city of this.cityIndex.values()) {
      const nameUpper = city.name.toUpperCase();
      const nameHeadNorm = normalizePlaceName(city.name);
      let score = 0;
      // Same tier ladder as airports, minus the IATA tier (cities have no IATA).
      if (nameUpper === q || nameHeadNorm === qNorm) score = 95;
      else if (nameUpper.startsWith(q) || nameHeadNorm.startsWith(qNorm)) score = 85;
      else if (nameUpper.includes(q) || nameHeadNorm.includes(qNorm)) score = 65;
      // +5 bias on exact city-name match so "Rome" surfaces the city row
      // above the individual FCO/CIA rows. Airport IATA-exact still beats
      // city (100 > 100) so typing "FCO" still leads with the airport.
      if (score === 95) score = 100;
      if (score > 0) results.push({ kind: 'city', city, score });
    }

    return results
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const nameA = a.kind === 'airport' ? a.airport.city : a.city.name;
        const nameB = b.kind === 'airport' ? b.airport.city : b.city.name;
        // Group same-named entries together (city alongside its airports)
        // and break ties by kind: city first within a name group.
        return nameA.localeCompare(nameB) || (a.kind === 'city' ? -1 : 1);
      })
      .slice(0, 12)
      .map((r): AirportSearchEntry =>
        r.kind === 'airport'
          ? { kind: 'airport', airport: toAirport(r.airport) }
          : { kind: 'city', city: derivedToCity(r.city) },
      );
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
      // Gazetteer fallback never produces city entries — these are nearest
      // commercial airports around a query like "São Carlos" that has no
      // airport of its own. Wrap each in the discriminated-union shape so
      // the response matches the rest of /api/airports/search.
      results: results.map((airport): AirportSearchEntry => ({ kind: 'airport', airport })),
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
