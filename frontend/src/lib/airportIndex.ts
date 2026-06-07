import { Airport } from '@fast-travel/shared';

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

let indexPromise: Promise<IndexedEntry[]> | null = null;
let cachedIndex: IndexedEntry[] | null = null;

export function prefetchAirportIndex(): void {
  if (!indexPromise) getAirportIndex();
}

export function getAirportIndex(): Promise<IndexedEntry[]> {
  if (cachedIndex) return Promise.resolve(cachedIndex);
  if (indexPromise) return indexPromise;

  indexPromise = fetch('/airports.json')
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load airport index: ${r.status}`);
      return r.json() as Promise<RawAirport[]>;
    })
    .then((raw) => {
      const index = raw.map(buildEntry);
      cachedIndex = index;
      return index;
    });

  return indexPromise;
}

export function searchIndex(index: IndexedEntry[], query: string): Airport[] {
  if (!query || query.trim().length < 1) return [];
  const raw = query.trim();
  const upper = raw.toUpperCase();
  const qNorm = normalize(raw);

  const scored: Array<{ entry: IndexedEntry; score: number }> = [];

  for (const entry of index) {
    let score = 0;
    if (entry.iataUpper === upper) score = 100;
    else if (entry.cityHead === upper || entry.cityHeadNorm === qNorm) score = 95;
    else if (entry.cityHead.startsWith(upper) || entry.cityHeadNorm.startsWith(qNorm)) score = 85;
    else if (entry.nameUpper.startsWith(upper) || entry.nameNorm.startsWith(qNorm)) score = 75;
    else if (entry.cityHead.includes(upper) || entry.cityHeadNorm.includes(qNorm)) score = 65;
    else if (entry.nameUpper.includes(upper) || entry.nameNorm.includes(qNorm)) score = 55;
    else if (entry.kwNorm && entry.kwNorm.includes(qNorm)) score = 45;

    if (score > 0) scored.push({ entry, score });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.entry.airport.city.name.localeCompare(b.entry.airport.city.name))
    .slice(0, 12)
    .map(({ entry }) => entry.airport);
}
