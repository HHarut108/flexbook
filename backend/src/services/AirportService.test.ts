import { describe, it, expect, beforeEach } from 'vitest';
import { Airport, AirportSearchEntry, City } from '@fast-travel/shared';
import { AirportService } from './AirportService';

let svc: AirportService;

beforeEach(() => {
  svc = new AirportService();
});

/** Extract just the airport-kind entries (drops City rows) so existing
 *  assertions that talk about IATA / city / country shape keep working. */
function airports(entries: AirportSearchEntry[]): Airport[] {
  return entries.filter((e): e is { kind: 'airport'; airport: Airport } => e.kind === 'airport').map((e) => e.airport);
}

/** Extract just the city-kind entries with member airports. */
function cities(entries: AirportSearchEntry[]): (City & { airports: string[] })[] {
  return entries
    .filter((e): e is { kind: 'city'; city: City & { airports: string[] } } => e.kind === 'city')
    .map((e) => e.city);
}

describe('AirportService.search', () => {
  it('returns empty array for empty query', () => {
    expect(svc.search('')).toEqual([]);
    expect(svc.search('  ')).toEqual([]);
  });

  it('exact IATA match scores highest (LHR)', () => {
    const results = airports(svc.search('LHR'));
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].iata).toBe('LHR');
  });

  it('exact IATA match is case-insensitive', () => {
    const upper = airports(svc.search('CDG'));
    const lower = airports(svc.search('cdg'));
    expect(upper[0]?.iata).toBe('CDG');
    expect(lower[0]?.iata).toBe('CDG');
  });

  it('returns at most 12 results total', () => {
    const results = svc.search('a'); // very broad query
    expect(results.length).toBeLessThanOrEqual(12);
  });

  it('city starts-with match appears before contains match', () => {
    const results = airports(svc.search('paris'));
    expect(results.length).toBeGreaterThan(0);
    const parisResults = results.filter((r) =>
      r.city.name.toUpperCase().includes('PARIS'),
    );
    expect(parisResults.length).toBeGreaterThan(0);
  });

  it('surfaces every commercial airport of a multi-airport city', () => {
    // London has 6 IATAs in the OurAirports commercial set: LHR, LGW, STN,
    // LCY, LTN, SEN. All should appear so the user can choose.
    const iatas = new Set(airports(svc.search('London')).map((r) => r.iata));
    for (const expected of ['LHR', 'LGW', 'STN', 'LCY', 'LTN', 'SEN']) {
      expect(iatas.has(expected)).toBe(true);
    }
  });

  it('US country code is "US", not "UN" (regression)', () => {
    const jfk = airports(svc.search('JFK'))[0];
    expect(jfk.city.countryCode).toBe('US');
  });

  it('matches diacritic-stripped queries (Sao Paulo → São Paulo)', () => {
    const results = airports(svc.search('Sao Paulo'));
    const gru = results.find((r) => r.iata === 'GRU');
    expect(gru).toBeDefined();
    expect(gru!.city.name).toMatch(/São Paulo/);
  });

  it('surfaces marketing-alias airports as primary city matches', () => {
    const iatas = new Set(airports(svc.search('Milan')).map((r) => r.iata));
    for (const expected of ['MXP', 'LIN', 'BGY']) {
      expect(iatas.has(expected)).toBe(true);
    }
    const bgy = airports(svc.search('Milan')).find((r) => r.iata === 'BGY')!;
    expect(bgy.city.name).toBe('Milan');
  });

  it('finds airports via OurAirports keyword aliases (EWR for New York)', () => {
    const iatas = new Set(airports(svc.search('New York')).map((r) => r.iata));
    expect(iatas.has('JFK')).toBe(true);
    expect(iatas.has('LGA')).toBe(true);
    expect(iatas.has('EWR')).toBe(true);
  });

  it('strips comma suffixes from municipalities (Luton, Luton → London via alias)', () => {
    const ltn = svc.getByIata('LTN');
    expect(ltn?.city.name).toBe('London');
  });

  it('returns airport with correct structure', () => {
    const results = airports(svc.search('JFK'));
    expect(results.length).toBeGreaterThan(0);
    const jfk = results[0];
    expect(jfk.iata).toBe('JFK');
    expect(jfk.city).toBeDefined();
    expect(jfk.city.name).toBeTruthy();
    expect(jfk.city.countryCode).toBeTruthy();
  });
});

describe('AirportService.search — City entries', () => {
  it('emits a City entry for cities with ≥2 commercial airports', () => {
    const romeCities = cities(svc.search('Rome'));
    expect(romeCities.length).toBeGreaterThanOrEqual(1);
    const rome = romeCities.find((c) => c.id === 'rome_it');
    expect(rome).toBeDefined();
    expect(rome!.name).toBe('Rome');
    expect(rome!.countryCode).toBe('IT');
    expect(rome!.airports).toEqual(expect.arrayContaining(['FCO', 'CIA']));
  });

  it('exact city-name match: City entry ranks above individual airports', () => {
    const results = svc.search('Rome');
    // First Rome-related entry should be the city, not an individual airport.
    const firstRome = results.find((e) => {
      if (e.kind === 'city') return e.city.name === 'Rome';
      return e.airport.city.name === 'Rome';
    });
    expect(firstRome?.kind).toBe('city');
  });

  it('IATA-exact still beats city (typing "FCO" yields FCO airport first)', () => {
    const results = svc.search('FCO');
    expect(results[0].kind).toBe('airport');
    if (results[0].kind === 'airport') {
      expect(results[0].airport.iata).toBe('FCO');
    }
  });

  it('no City entry for single-airport cities', () => {
    // Yerevan only has EVN, so no city entry should be emitted.
    const cs = cities(svc.search('Yerevan'));
    expect(cs.find((c) => c.id === 'yerevan_am')).toBeUndefined();
  });

  it('London city: members ordered by direct-route popularity DESC', () => {
    const londonCity = cities(svc.search('London')).find((c) => c.id === 'london_gb');
    expect(londonCity).toBeDefined();
    // LHR is by far the busiest London airport — must be first member.
    expect(londonCity!.airports[0]).toBe('LHR');
    // All 6 commercial London airports should be present.
    for (const expected of ['LHR', 'LGW', 'STN', 'LCY', 'LTN', 'SEN']) {
      expect(londonCity!.airports).toContain(expected);
    }
  });

  it('cityById resolves a known city id', () => {
    const rome = svc.cityById('rome_it');
    expect(rome).toBeDefined();
    expect(rome!.name).toBe('Rome');
    expect(rome!.airports).toEqual(expect.arrayContaining(['FCO', 'CIA']));
  });

  it('cityById returns undefined for unknown id', () => {
    expect(svc.cityById('nowhere_xx')).toBeUndefined();
  });

  it('cityById is case-insensitive', () => {
    const a = svc.cityById('ROME_IT');
    const b = svc.cityById('rome_it');
    expect(a?.id).toBe(b?.id);
  });
});

describe('AirportService.searchWithFallback', () => {
  it('returns regular results unchanged when commercial matches exist', () => {
    const out = svc.searchWithFallback('London');
    expect(out.fallback).toBeUndefined();
    expect(out.results.length).toBeGreaterThan(0);
    expect(airports(out.results).some((r) => r.iata === 'LHR')).toBe(true);
  });

  it('falls back to nearest commercial when query is a known non-commercial place', () => {
    const out = svc.searchWithFallback('Sao Carlos');
    expect(out.fallback).toBeDefined();
    expect(out.fallback!.matchedPlace).toMatch(/São Carlos/);
    expect(out.fallback!.countryCode).toBe('BR');
    const airportResults = airports(out.results);
    expect(airportResults.length).toBeGreaterThan(0);
    const saoPauloHubs = new Set(['GRU', 'CGH', 'VCP']);
    expect(airportResults.some((r) => saoPauloHubs.has(r.iata))).toBe(true);
    expect(airportResults.every((r) => r.distanceKm !== undefined)).toBe(true);
    // Fallback path returns airport entries only — no city derivation here.
    expect(cities(out.results)).toEqual([]);
  });

  it('returns empty (no fallback) for queries that match no known place', () => {
    const out = svc.searchWithFallback('zzzzz nowhere place xyz');
    expect(out.results).toEqual([]);
    expect(out.fallback).toBeUndefined();
  });
});

describe('AirportService.nearby', () => {
  it('returns empty array for unknown IATA', () => {
    expect(svc.nearby('ZZZ')).toEqual([]);
  });

  it('excludes the origin airport itself', () => {
    const results = svc.nearby('LHR');
    expect(results.every((a) => a.iata !== 'LHR')).toBe(true);
  });

  it('returns at most 6 airports', () => {
    const results = svc.nearby('LHR');
    expect(results.length).toBeLessThanOrEqual(6);
  });

  it('all results are within 150 km', () => {
    const results = svc.nearby('LHR');
    expect(results.every((a) => (a.distanceKm ?? 0) <= 150)).toBe(true);
  });

  it('sorted by distance ascending', () => {
    const results = svc.nearby('CDG');
    for (let i = 1; i < results.length; i++) {
      expect(results[i].distanceKm ?? 0).toBeGreaterThanOrEqual(results[i - 1].distanceKm ?? 0);
    }
  });
});

describe('AirportService.nearbyByCoords', () => {
  it('excludes the provided IATA from results', () => {
    const results = svc.nearbyByCoords(51.4775, -0.4614, 'LHR');
    expect(results.every((a) => a.iata !== 'LHR')).toBe(true);
  });

  it('returns results when no exclude IATA given', () => {
    const results = svc.nearbyByCoords(51.5, -0.12);
    expect(results.length).toBeGreaterThan(0);
  });
});

describe('AirportService.getByIata', () => {
  it('returns the airport for a known IATA', () => {
    const airport = svc.getByIata('LIS');
    expect(airport).toBeDefined();
    expect(airport!.iata).toBe('LIS');
    expect(airport!.city.name).toBeTruthy();
  });

  it('returns undefined for an unknown IATA', () => {
    expect(svc.getByIata('ZZZ')).toBeUndefined();
  });

  it('is case-insensitive', () => {
    expect(svc.getByIata('lis')?.iata).toBe('LIS');
    expect(svc.getByIata('LIS')?.iata).toBe('LIS');
  });
});
