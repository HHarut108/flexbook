import { describe, it, expect } from 'vitest';
import { encodeItinerary, decodeItinerary } from './url.utils';
import type { Itinerary } from '@fast-travel/shared';

const SAMPLE_ITINERARY: Itinerary = {
  origin: {
    iata: 'LHR',
    name: 'London Heathrow',
    city: {
      id: 'LHR',
      name: 'London',
      countryCode: 'GB',
      countryName: 'United Kingdom',
      lat: 51.4775,
      lng: -0.4614,
    },
    timezone: 'Europe/London',
  },
  legs: [
    {
      flightId: 'FL001',
      originIata: 'LHR',
      originCity: 'London',
      destinationIata: 'LIS',
      destinationCity: 'Lisbon',
      destinationCountry: 'Portugal',
      destinationLat: 38.77,
      destinationLng: -9.13,
      departureDatetime: '2026-04-10T08:00:00',
      arrivalDatetime: '2026-04-10T10:30:00',
      durationMinutes: 150,
      airlineName: 'TAP',
      stops: 0,
      priceUsd: 85,
      bookingUrl: 'https://example.com/book',
      stopIndex: 1,
      stayDurationDays: 5,
      nextDepartureDate: '2026-04-15',
      isReturn: false,
    },
  ],
  status: 'planning',
  createdAt: '2026-04-06T12:00:00.000Z',
};

describe('encodeItinerary / decodeItinerary round-trip', () => {
  it('decodes back to the original itinerary', () => {
    const encoded = encodeItinerary(SAMPLE_ITINERARY);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);

    const decoded = decodeItinerary(encoded);
    expect(decoded).toEqual(SAMPLE_ITINERARY);
  });

  it('produces a non-empty string with no unencoded spaces', () => {
    const encoded = encodeItinerary(SAMPLE_ITINERARY);
    expect(encoded.length).toBeGreaterThan(10);
    expect(encoded).not.toContain(' ');
  });

  it('handles multi-leg itineraries', () => {
    const multi: Itinerary = {
      ...SAMPLE_ITINERARY,
      legs: [
        ...SAMPLE_ITINERARY.legs,
        {
          ...SAMPLE_ITINERARY.legs[0],
          flightId: 'FL002',
          originIata: 'LIS',
          destinationIata: 'MAD',
          stopIndex: 2,
          isReturn: false,
        },
      ],
    };
    expect(decodeItinerary(encodeItinerary(multi))).toEqual(multi);
  });
});

describe('decodeItinerary — error handling', () => {
  it('returns null for an empty string', () => {
    expect(decodeItinerary('')).toBeNull();
  });

  it('returns null for garbage input', () => {
    expect(decodeItinerary('not-valid-lzstring!!!!')).toBeNull();
  });

  it('returns null for valid base64 that is not JSON', () => {
    // LZString can compress arbitrary data; decompressed but not valid JSON
    expect(decodeItinerary('junk-payload-xyz')).toBeNull();
  });
});
