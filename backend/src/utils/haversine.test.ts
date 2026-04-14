import { describe, it, expect } from 'vitest';
import { haversineKm } from './haversine';

describe('haversineKm', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineKm(51.5, -0.12, 51.5, -0.12)).toBeCloseTo(0, 1);
  });

  it('calculates LHR → CDG (~341 km)', () => {
    // London Heathrow: 51.4775, -0.4614 | Paris CDG: 49.0097, 2.5479
    const dist = haversineKm(51.4775, -0.4614, 49.0097, 2.5479);
    expect(dist).toBeGreaterThan(330);
    expect(dist).toBeLessThan(360);
  });

  it('calculates BCN → MAD (~483 km)', () => {
    // Barcelona El Prat: 41.2974, 2.0833 | Madrid Barajas: 40.4719, -3.5626
    const dist = haversineKm(41.2974, 2.0833, 40.4719, -3.5626);
    expect(dist).toBeGreaterThan(470);
    expect(dist).toBeLessThan(500);
  });

  it('is symmetric (A→B == B→A)', () => {
    const ab = haversineKm(51.5, -0.12, 48.85, 2.35);
    const ba = haversineKm(48.85, 2.35, 51.5, -0.12);
    expect(ab).toBeCloseTo(ba, 5);
  });
});
