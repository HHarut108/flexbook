import { Airport, AirportSearchEntry, City } from '@fast-travel/shared';

interface RawAirport {
  iata: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  timezone: string;
  keywords?: string;
}

interface IndexedEntry {
  airport: Airport;
  iataUpper: string;
  cityHead: string;
  cityHeadNorm: string;
  nameUpper: string;
  nameNorm: string;
  kwNorm: string | null;
}

/** A derived multi-airport city (≥2 commercial airports sharing the same
 *  normalized city + country). Generated client-side from airports.json so
 *  the dropdown can surface a "Rome (city)" row without a backend round-trip.
 *  Mirrors the backend's AirportService.buildCityIndex() — the two MUST stay
 *  in sync on id format so URL state survives a server-rendered share link. */
interface DerivedCityEntry {
  id: string;
  city: City & { airports: string[] };
  nameUpper: string;
  nameHeadNorm: string;
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function buildEntry(raw: RawAirport): IndexedEntry {
  const cityHead = raw.city.split(',')[0].trim();
  return {
    airport: {
      iata: raw.iata,
      name: raw.name,
      city: {
        id: raw.iata,
        name: cityHead,
        countryCode: raw.countryCode,
        countryName: raw.country,
        lat: raw.lat,
        lng: raw.lng,
      },
      timezone: raw.timezone,
    },
    iataUpper: raw.iata.toUpperCase(),
    cityHead: cityHead.toUpperCase(),
    cityHeadNorm: normalize(cityHead),
    nameUpper: raw.name.toUpperCase(),
    nameNorm: normalize(raw.name),
    kwNorm: raw.keywords ? normalize(raw.keywords) : null,
  };
}

interface FullIndex {
  airports: IndexedEntry[];
  cities: DerivedCityEntry[];
}

let indexPromise: Promise<FullIndex> | null = null;
let cachedIndex: FullIndex | null = null;

export function prefetchAirportIndex(): void {
  if (!indexPromise) getAirportIndex();
}

export function getAirportIndex(): Promise<FullIndex> {
  if (cachedIndex) return Promise.resolve(cachedIndex);
  if (indexPromise) return indexPromise;

  indexPromise = fetch('/airports.json')
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load airport index: ${r.status}`);
      return r.json() as Promise<RawAirport[]>;
    })
    .then((raw) => {
      const airports = raw.map(buildEntry);
      const cities = buildCityIndex(raw);
      const full: FullIndex = { airports, cities };
      cachedIndex = full;
      return full;
    });

  return indexPromise;
}

/** Derive City entries client-side. MUST match the backend's
 *  AirportService.buildCityIndex() id format (`${cityNorm}_${cc.lower}`)
 *  and member ordering, so URL state survives both encoding sides. */
function buildCityIndex(raw: RawAirport[]): DerivedCityEntry[] {
  const groups = new Map<string, RawAirport[]>();
  for (const a of raw) {
    const cityHead = a.city.split(',')[0].trim();
    const cityNorm = normalize(cityHead);
    if (!cityNorm) continue;
    const key = `${cityNorm.replace(/[^a-z0-9]+/g, '_')}_${a.countryCode.toLowerCase()}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(a);
    groups.set(key, bucket);
  }
  const out: DerivedCityEntry[] = [];
  for (const [id, members] of groups) {
    if (members.length < 2) continue;
    // Client doesn't have direct-route popularity data — order by IATA so the
    // ordering is at least stable and deterministic. The backend will use its
    // popularity-ordered list when actually fanning out the search.
    const sorted = [...members].sort((a, b) => a.iata.localeCompare(b.iata));
    const cityHead = sorted[0].city.split(',')[0].trim();
    const lat = sorted.reduce((s, a) => s + a.lat, 0) / sorted.length;
    const lng = sorted.reduce((s, a) => s + a.lng, 0) / sorted.length;
    out.push({
      id,
      city: {
        id,
        name: cityHead,
        countryCode: sorted[0].countryCode,
        countryName: sorted[0].country,
        lat,
        lng,
        airports: sorted.map((a) => a.iata.toUpperCase()),
      },
      nameUpper: cityHead.toUpperCase(),
      nameHeadNorm: normalize(cityHead),
    });
  }
  return out;
}

/** Resolve a URL-state marker ("EVN" or "@rome_it") back to the indexed
 *  LocationSelection. Returns null when the marker isn't present in the
 *  loaded index — callers should treat as "couldn't resolve, leave the
 *  field empty so the user can re-pick". */
export function resolveMarkerInIndex(
  index: FullIndex,
  marker: string,
): AirportSearchEntry | null {
  const trimmed = marker.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('@')) {
    const id = trimmed.slice(1);
    const city = index.cities.find((c) => c.id === id);
    return city ? { kind: 'city', city: city.city } : null;
  }
  const upper = trimmed.toUpperCase();
  const airport = index.airports.find((a) => a.iataUpper === upper);
  return airport ? { kind: 'airport', airport: airport.airport } : null;
}

export function searchIndex(index: FullIndex, query: string): AirportSearchEntry[] {
  if (!query || query.trim().length < 1) return [];
  const raw = query.trim();
  const upper = raw.toUpperCase();
  const qNorm = normalize(raw);

  type ScoredAirport = { kind: 'airport'; entry: IndexedEntry; score: number };
  type ScoredCity = { kind: 'city'; entry: DerivedCityEntry; score: number };
  const scored: Array<ScoredAirport | ScoredCity> = [];

  for (const entry of index.airports) {
    let score = 0;
    if (entry.iataUpper === upper) score = 100;
    else if (entry.cityHead === upper || entry.cityHeadNorm === qNorm) score = 95;
    else if (entry.cityHead.startsWith(upper) || entry.cityHeadNorm.startsWith(qNorm)) score = 85;
    else if (entry.nameUpper.startsWith(upper) || entry.nameNorm.startsWith(qNorm)) score = 75;
    else if (entry.cityHead.includes(upper) || entry.cityHeadNorm.includes(qNorm)) score = 65;
    else if (entry.nameUpper.includes(upper) || entry.nameNorm.includes(qNorm)) score = 55;
    else if (entry.kwNorm && entry.kwNorm.includes(qNorm)) score = 45;

    if (score > 0) scored.push({ kind: 'airport', entry, score });
  }

  for (const entry of index.cities) {
    let score = 0;
    if (entry.nameUpper === upper || entry.nameHeadNorm === qNorm) score = 95;
    else if (entry.nameUpper.startsWith(upper) || entry.nameHeadNorm.startsWith(qNorm)) score = 85;
    else if (entry.nameUpper.includes(upper) || entry.nameHeadNorm.includes(qNorm)) score = 65;
    // +5 bias on exact match so "Rome (city)" surfaces above individual FCO/CIA rows.
    if (score === 95) score = 100;
    if (score > 0) scored.push({ kind: 'city', entry, score });
  }

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const nameA = a.kind === 'airport' ? a.entry.airport.city.name : a.entry.city.name;
      const nameB = b.kind === 'airport' ? b.entry.airport.city.name : b.entry.city.name;
      // Same-name group: city above airports.
      return nameA.localeCompare(nameB) || (a.kind === 'city' ? -1 : 1);
    })
    .slice(0, 12)
    .map((s): AirportSearchEntry =>
      s.kind === 'airport'
        ? { kind: 'airport', airport: s.entry.airport }
        : { kind: 'city', city: s.entry.city },
    );
}
