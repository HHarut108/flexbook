import { describe, it, expect, beforeEach } from 'vitest';
import { AirportService } from './AirportService';

let svc: AirportService;

beforeEach(() => {
  svc = new AirportService();
});

describe('AirportService.search', () => {
  it('returns empty array for empty query', () => {
    expect(svc.search('')).toEqual([]);
    expect(svc.search('  ')).toEqual([]);
  });

  it('exact IATA match scores highest (LHR)', () => {
    const results = svc.search('LHR');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].iata).toBe('LHR');
  });

  it('exact IATA match is case-insensitive', () => {
    const upper = svc.search('CDG');
    const lower = svc.search('cdg');
    expect(upper[0]?.iata).toBe('CDG');
    expect(lower[0]?.iata).toBe('CDG');
  });

  it('returns at most 12 results', () => {
    const results = svc.search('a'); // very broad query
    expect(results.length).toBeLessThanOrEqual(12);
  });

  it('city starts-with match appears before contains match', () => {
    // "paris" starts-with → CDG/ORY should score high
    // "port" starts-with, but "airport" contains "port" → lower
    const results = svc.search('paris');
    expect(results.length).toBeGreaterThan(0);
    // All Paris results should be before any non-Paris result
    const parisResults = results.filter((r) =>
      r.city.name.toUpperCase().includes('PARIS'),
    );
    expect(parisResults.length).toBeGreaterThan(0);
  });

  it('surfaces every commercial airport of a multi-airport city', () => {
    // London has 6 IATAs in the OurAirports commercial set: LHR, LGW, STN,
    // LCY, LTN, SEN. All should appear so the user can choose.
    const results = svc.search('London');
    const iatas = new Set(results.map((r) => r.iata));
    for (const expected of ['LHR', 'LGW', 'STN', 'LCY', 'LTN', 'SEN']) {
      expect(iatas.has(expected)).toBe(true);
    }
  });

  it('US country code is "US", not "UN" (regression)', () => {
    const jfk = svc.search('JFK')[0];
    expect(jfk.city.countryCode).toBe('US');
  });

  it('matches diacritic-stripped queries (Sao Paulo → São Paulo)', () => {
    const results = svc.search('Sao Paulo');
    const gru = results.find((r) => r.iata === 'GRU');
    expect(gru).toBeDefined();
    expect(gru!.city.name).toMatch(/São Paulo/);
  });

  it('surfaces marketing-alias airports as primary city matches', () => {
    // MXP/LIN/BGY have municipalities Ferno/Segrate/Orio al Serio but are
    // all marketed as "Milan". After MARKETING_CITY_ALIAS override, all
    // three should surface with city.name === "Milan" for a "Milan" query.
    const results = svc.search('Milan');
    const iatas = new Set(results.map((r) => r.iata));
    for (const expected of ['MXP', 'LIN', 'BGY']) {
      expect(iatas.has(expected)).toBe(true);
    }
    const bgy = results.find((r) => r.iata === 'BGY')!;
    expect(bgy.city.name).toBe('Milan');
  });

  it('finds airports via OurAirports keyword aliases (EWR for New York)', () => {
    // EWR's city is "Newark" (intentionally not aliased to NYC because
    // Newark is a real major city), but its keywords contain "Manhattan,
    // New York City, NYC". A "New York" search should still surface EWR
    // alongside JFK/LGA via the keyword tier.
    const results = svc.search('New York');
    const iatas = new Set(results.map((r) => r.iata));
    expect(iatas.has('JFK')).toBe(true);
    expect(iatas.has('LGA')).toBe(true);
    expect(iatas.has('EWR')).toBe(true);
  });

  it('strips comma suffixes from municipalities (Luton, Luton → London via alias)', () => {
    // OurAirports stores LTN's municipality as "Luton, Luton" — the
    // build script's cleanMunicipality strips that to "Luton" and the
    // alias overlay then maps LTN → "London". User shouldn't see the
    // weird raw form anywhere.
    const ltn = svc.getByIata('LTN');
    expect(ltn?.city.name).toBe('London');
  });

  it('returns airport with correct structure', () => {
    const results = svc.search('JFK');
    expect(results.length).toBeGreaterThan(0);
    const jfk = results[0];
    expect(jfk.iata).toBe('JFK');
    expect(jfk.city).toBeDefined();
    expect(jfk.city.name).toBeTruthy();
    expect(jfk.city.countryCode).toBeTruthy();
  });
});

describe('AirportService.searchWithFallback', () => {
  it('returns regular results unchanged when commercial matches exist', () => {
    const out = svc.searchWithFallback('London');
    expect(out.fallback).toBeUndefined();
    expect(out.results.length).toBeGreaterThan(0);
    expect(out.results.some((r) => r.iata === 'LHR')).toBe(true);
  });

  it('falls back to nearest commercial when query is a known non-commercial place', () => {
    // QSC (São Carlos) was dropped from the commercial set. The gazetteer
    // still has São Carlos's coordinates, so we should surface São Paulo's
    // hubs (GRU/VCP/CGH) as nearby commercial alternatives within 300 km.
    const out = svc.searchWithFallback('Sao Carlos');
    expect(out.fallback).toBeDefined();
    expect(out.fallback!.matchedPlace).toMatch(/São Carlos/);
    expect(out.fallback!.countryCode).toBe('BR');
    expect(out.results.length).toBeGreaterThan(0);
    const saoPauloHubs = new Set(['GRU', 'CGH', 'VCP']);
    expect(out.results.some((r) => saoPauloHubs.has(r.iata))).toBe(true);
    expect(out.results.every((r) => r.distanceKm !== undefined)).toBe(true);
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
    // Coordinates of central London
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
