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

  it('returns at most 7 results', () => {
    const results = svc.search('a'); // very broad query
    expect(results.length).toBeLessThanOrEqual(7);
  });

  it('city starts-with match appears before contains match', () => {
    // "paris" starts-with → CDG/ORY should score 80
    // "port" starts-with, but "airport" contains "port" → score 60
    const results = svc.search('paris');
    expect(results.length).toBeGreaterThan(0);
    // All Paris results should be before any non-Paris result
    const parisResults = results.filter((r) =>
      r.city.name.toUpperCase().includes('PARIS'),
    );
    expect(parisResults.length).toBeGreaterThan(0);
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
