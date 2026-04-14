import { describe, it, expect } from 'vitest';
import { formatPrice, totalPrice } from './price.utils';
import type { TripLeg } from '@fast-travel/shared';

function makeLeg(priceUsd: number): TripLeg {
  return {
    flightId: 'id',
    originIata: 'A',
    originCity: 'A City',
    destinationIata: 'B',
    destinationCity: 'B City',
    destinationCountry: 'Country',
    destinationLat: 0,
    destinationLng: 0,
    departureDatetime: '2026-04-10T08:00:00',
    arrivalDatetime: '2026-04-10T10:00:00',
    durationMinutes: 120,
    airlineName: 'TestAir',
    stops: 0,
    priceUsd,
    bookingUrl: 'https://example.com',
    stopIndex: 1,
    stayDurationDays: 3,
    nextDepartureDate: '2026-04-13',
    isReturn: false,
  };
}

describe('formatPrice', () => {
  it('formats integer prices with $ prefix', () => {
    expect(formatPrice(100)).toBe('$100');
    expect(formatPrice(0)).toBe('$0');
  });

  it('rounds decimal prices to whole dollars', () => {
    expect(formatPrice(99.7)).toBe('$100');
    expect(formatPrice(99.4)).toBe('$99');
  });

  it('handles large values', () => {
    expect(formatPrice(1500)).toBe('$1500');
  });
});

describe('totalPrice', () => {
  it('returns 0 for an empty leg array', () => {
    expect(totalPrice([])).toBe(0);
  });

  it('sums prices of all legs', () => {
    expect(totalPrice([makeLeg(100), makeLeg(200), makeLeg(50)])).toBe(350);
  });

  it('handles a single leg', () => {
    expect(totalPrice([makeLeg(85)])).toBe(85);
  });
});
