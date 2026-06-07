import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import {
  fetchRapidApiKiwiRoundTrip,
  RapidApiRateLimitError,
  RapidApiAuthError,
  RapidApiUnavailableError,
} from './RapidApiKiwiFlightProvider';

vi.mock('../config', () => ({
  config: { RAPIDAPI_KEY: 'test-key' },
}));

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

function station(code: string, city: string, country: string, lat: number, lng: number) {
  return { code, name: `${city} Airport`, gps: { lat, lng }, city: { name: city }, country: { code: country, name: country } };
}

function segment(originCode: string, destCode: string, depart: string, arrive: string, durationSec: number, carrier = 'BA') {
  return {
    id: `${originCode}-${destCode}`,
    source: { localTime: depart, utcTime: depart, station: station(originCode, originCode, 'GB', 51.47, -0.45) },
    destination: { localTime: arrive, utcTime: arrive, station: station(destCode, destCode, 'PT', 38.77, -9.13) },
    duration: durationSec,
    carrier: { code: carrier, name: carrier === 'BA' ? 'British Airways' : carrier },
  };
}

const roundTripItinerary = {
  id: 'rt-1',
  price: { amount: '180.50' },
  bookingOptions: { edges: [{ node: { bookingUrl: '/book/abc' } }] },
  outbound: {
    id: 'out-1',
    sectorSegments: [
      { segment: segment('LHR', 'LIS', '2030-04-10T08:00:00', '2030-04-10T10:30:00', 9000), layover: null },
    ],
  },
  inbound: {
    id: 'in-1',
    sectorSegments: [
      { segment: segment('LIS', 'LHR', '2030-04-17T11:00:00', '2030-04-17T13:30:00', 9000), layover: null },
    ],
  },
};

const roundTripWithStopover = {
  id: 'rt-2',
  price: { amount: '220.00' },
  bookingOptions: { edges: [{ node: { bookingUrl: 'https://www.kiwi.com/book/xyz?adults=1' } }] },
  outbound: {
    id: 'out-2',
    sectorSegments: [
      { segment: segment('LHR', 'MAD', '2030-04-10T07:00:00', '2030-04-10T10:00:00', 10800), layover: null },
      { segment: segment('MAD', 'LIS', '2030-04-10T11:00:00', '2030-04-10T12:30:00', 5400), layover: null },
    ],
  },
  inbound: {
    id: 'in-2',
    sectorSegments: [
      { segment: segment('LIS', 'LHR', '2030-04-17T16:00:00', '2030-04-17T18:30:00', 9000), layover: null },
    ],
  },
};

describe('fetchRapidApiKiwiRoundTrip', () => {
  beforeEach(() => {
    mockedAxios.isAxiosError = ((err: unknown): err is import('axios').AxiosError =>
      typeof err === 'object' && err !== null && (err as { isAxiosError?: boolean }).isAxiosError === true) as typeof axios.isAxiosError;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('parses a simple direct outbound + direct inbound pair', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: { itineraries: [roundTripItinerary] } });

    const pairs = await fetchRapidApiKiwiRoundTrip('LHR', 'LIS', '2030-04-10', '2030-04-17');

    expect(pairs).toHaveLength(1);
    const p = pairs[0];
    expect(p.tripId).toBe('rt-1');
    expect(p.priceUsd).toBeCloseTo(180.5, 2);
    expect(p.outbound.originIata).toBe('LHR');
    expect(p.outbound.destinationIata).toBe('LIS');
    expect(p.outbound.stops).toBe(0);
    expect(p.inbound.originIata).toBe('LIS');
    expect(p.inbound.destinationIata).toBe('LHR');
    expect(p.inbound.stops).toBe(0);
    // Both legs echo the combined total, not per-leg pricing.
    expect(p.outbound.priceUsd).toBe(p.priceUsd);
    expect(p.inbound.priceUsd).toBe(p.priceUsd);
  });

  it('counts stops correctly for multi-segment legs', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: { itineraries: [roundTripWithStopover] } });

    const pairs = await fetchRapidApiKiwiRoundTrip('LHR', 'LIS', '2030-04-10', '2030-04-17');

    expect(pairs).toHaveLength(1);
    expect(pairs[0].outbound.stops).toBe(1);
    expect(pairs[0].outbound.viaIatas).toEqual(['MAD']);
    expect(pairs[0].inbound.stops).toBe(0);
  });

  it('computes door-to-door duration including layovers, plus separate flightTimeMinutes', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: { itineraries: [roundTripWithStopover] } });

    const pairs = await fetchRapidApiKiwiRoundTrip('LHR', 'LIS', '2030-04-10', '2030-04-17');
    const out = pairs[0].outbound;

    // Flight time = 10800s (3h) + 5400s (1h30m) = 4h 30m = 270 minutes
    expect(out.flightTimeMinutes).toBe(270);
    // Door-to-door = 07:00 → 12:30 = 5h 30m = 330 minutes (includes the 1h MAD layover)
    expect(out.durationMinutes).toBe(330);
  });

  it('populates carriers and layovers for multi-segment legs', async () => {
    const mixedCarrierItin = {
      id: 'rt-mix',
      price: { amount: '199.00' },
      bookingOptions: { edges: [{ node: { bookingUrl: '/book/mix' } }] },
      outbound: {
        id: 'out-mix',
        sectorSegments: [
          { segment: segment('LHR', 'MAD', '2030-04-10T07:00:00', '2030-04-10T10:00:00', 10800, 'W6'), layover: null },
          // No Kiwi flag → falls back to carrier-code heuristic.
          { segment: segment('MAD', 'LIS', '2030-04-10T13:30:00', '2030-04-10T15:00:00', 5400, 'FR'), layover: null },
        ],
      },
      inbound: {
        id: 'in-mix',
        sectorSegments: [
          { segment: segment('LIS', 'LHR', '2030-04-17T16:00:00', '2030-04-17T18:30:00', 9000), layover: null },
        ],
      },
    };
    mockedAxios.get = vi.fn().mockResolvedValue({ data: { itineraries: [mixedCarrierItin] } });

    const pairs = await fetchRapidApiKiwiRoundTrip('LHR', 'LIS', '2030-04-10', '2030-04-17');
    const out = pairs[0].outbound;

    expect(out.carriers).toEqual(['W6', 'FR']);
    expect(out.layovers).toHaveLength(1);
    expect(out.layovers![0]).toEqual({
      iata: 'MAD',
      durationMinutes: 210, // 10:00 → 13:30
      selfTransfer: true,   // fallback heuristic: different carrier codes
    });

    // Inbound is single-segment → no layovers, single carrier.
    expect(pairs[0].inbound.layovers).toBeUndefined();
    expect(pairs[0].inbound.carriers).toEqual(['British Airways']);
  });

  it('marks layovers as non-self-transfer when consecutive segments share a carrier', async () => {
    const sameCarrierItin = {
      id: 'rt-same',
      price: { amount: '150.00' },
      bookingOptions: { edges: [{ node: { bookingUrl: '/book/same' } }] },
      outbound: {
        id: 'out-same',
        sectorSegments: [
          { segment: segment('LHR', 'MAD', '2030-04-10T07:00:00', '2030-04-10T10:00:00', 10800, 'IB'), layover: null },
          { segment: segment('MAD', 'LIS', '2030-04-10T11:00:00', '2030-04-10T12:30:00', 5400, 'IB'), layover: null },
        ],
      },
      inbound: {
        id: 'in-same',
        sectorSegments: [
          { segment: segment('LIS', 'LHR', '2030-04-17T16:00:00', '2030-04-17T18:30:00', 9000), layover: null },
        ],
      },
    };
    mockedAxios.get = vi.fn().mockResolvedValue({ data: { itineraries: [sameCarrierItin] } });

    const pairs = await fetchRapidApiKiwiRoundTrip('LHR', 'LIS', '2030-04-10', '2030-04-17');
    expect(pairs[0].outbound.layovers![0].selfTransfer).toBe(false);
    expect(pairs[0].outbound.carriers).toEqual(['IB']);
  });

  it('prefers Kiwi isBaggageRecheck flag over the carrier-code heuristic', async () => {
    // Same carrier (W6) on both legs — heuristic alone would mark
    // selfTransfer=false. But Kiwi sets isBaggageRecheck=true on the layover
    // because the legs are sold as separate tickets. The flag must win.
    const sameCarrierSelfTransferItin = {
      id: 'rt-flag',
      price: { amount: '120.00' },
      bookingOptions: { edges: [{ node: { bookingUrl: '/book/flag' } }] },
      outbound: {
        id: 'out-flag',
        sectorSegments: [
          { segment: segment('LHR', 'MAD', '2030-04-10T07:00:00', '2030-04-10T10:00:00', 10800, 'W6'), layover: null },
          {
            segment: segment('MAD', 'LIS', '2030-04-10T13:00:00', '2030-04-10T14:30:00', 5400, 'W6'),
            layover: { duration: 10800, isBaggageRecheck: true, isWalkingDistance: true, transferDuration: null, id: 'L1' },
          },
        ],
      },
      inbound: {
        id: 'in-flag',
        sectorSegments: [
          { segment: segment('LIS', 'LHR', '2030-04-17T16:00:00', '2030-04-17T18:30:00', 9000), layover: null },
        ],
      },
    };
    mockedAxios.get = vi.fn().mockResolvedValue({ data: { itineraries: [sameCarrierSelfTransferItin] } });

    const pairs = await fetchRapidApiKiwiRoundTrip('LHR', 'LIS', '2030-04-10', '2030-04-17');
    expect(pairs[0].outbound.layovers![0].selfTransfer).toBe(true);
  });

  it('multiplies bundled price by passengers', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: { itineraries: [roundTripItinerary] } });

    const pairs = await fetchRapidApiKiwiRoundTrip('LHR', 'LIS', '2030-04-10', '2030-04-17', { passengers: 3 });

    expect(pairs[0].priceUsd).toBeCloseTo(541.5, 2); // 180.50 * 3
  });

  it('adds adults query param to booking URL when passengers > 1', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: { itineraries: [roundTripWithStopover] } });

    const pairs = await fetchRapidApiKiwiRoundTrip('LHR', 'LIS', '2030-04-10', '2030-04-17', { passengers: 2 });

    expect(pairs[0].bookingUrl).toMatch(/adults=2/);
  });

  it('falls back to the sectors[] shape when outbound/inbound are absent', async () => {
    const sectorsShape = {
      id: 'rt-3',
      price: { amount: '99.00' },
      bookingOptions: { edges: [{ node: { bookingUrl: '/book/sec' } }] },
      sectors: [roundTripItinerary.outbound, roundTripItinerary.inbound],
    };
    mockedAxios.get = vi.fn().mockResolvedValue({ data: { itineraries: [sectorsShape] } });

    const pairs = await fetchRapidApiKiwiRoundTrip('LHR', 'LIS', '2030-04-10', '2030-04-17');

    expect(pairs).toHaveLength(1);
    expect(pairs[0].outbound.originIata).toBe('LHR');
    expect(pairs[0].inbound.originIata).toBe('LIS');
  });

  it('skips itineraries missing either leg', async () => {
    const malformed = { id: 'rt-bad', price: { amount: '100.00' }, outbound: roundTripItinerary.outbound };
    mockedAxios.get = vi.fn().mockResolvedValue({
      data: { itineraries: [roundTripItinerary, malformed] },
    });

    const pairs = await fetchRapidApiKiwiRoundTrip('LHR', 'LIS', '2030-04-10', '2030-04-17');

    expect(pairs).toHaveLength(1);
    expect(pairs[0].tripId).toBe('rt-1');
  });

  it('sends both outbound and inbound date windows in the request', async () => {
    const getMock = vi.fn().mockResolvedValue({ data: { itineraries: [] } });
    mockedAxios.get = getMock;

    await fetchRapidApiKiwiRoundTrip('LHR', 'LIS', '2030-04-10', '2030-04-17');

    const params = getMock.mock.calls[0][1].params;
    expect(params.outboundDepartureDateStart).toBe('2030-04-10T00:00:00');
    expect(params.outboundDepartureDateEnd).toBe('2030-04-10T23:59:59');
    expect(params.inboundDepartureDateStart).toBe('2030-04-17T00:00:00');
    expect(params.inboundDepartureDateEnd).toBe('2030-04-17T23:59:59');
    expect(params.source).toBe('Airport:LHR');
    expect(params.destination).toBe('Airport:LIS');
  });

  it('forwards maxStopovers to the upstream as maxStopsCount', async () => {
    const getMock = vi.fn().mockResolvedValue({ data: { itineraries: [] } });
    mockedAxios.get = getMock;

    await fetchRapidApiKiwiRoundTrip('LHR', 'LIS', '2030-04-10', '2030-04-17', { maxStopovers: 0 });

    expect(getMock.mock.calls[0][1].params.maxStopsCount).toBe(0);
  });

  it('maps HTTP 429 to RapidApiRateLimitError', async () => {
    mockedAxios.get = vi.fn().mockRejectedValue({
      isAxiosError: true,
      response: { status: 429 },
      message: 'rate limit',
    });

    await expect(fetchRapidApiKiwiRoundTrip('LHR', 'LIS', '2030-04-10', '2030-04-17')).rejects.toBeInstanceOf(
      RapidApiRateLimitError,
    );
  });

  it('maps HTTP 401/403 to RapidApiAuthError', async () => {
    mockedAxios.get = vi.fn().mockRejectedValue({
      isAxiosError: true,
      response: { status: 403 },
      message: 'forbidden',
    });

    await expect(fetchRapidApiKiwiRoundTrip('LHR', 'LIS', '2030-04-10', '2030-04-17')).rejects.toBeInstanceOf(
      RapidApiAuthError,
    );
  });

  it('maps HTTP 502/503/504 to RapidApiUnavailableError', async () => {
    mockedAxios.get = vi.fn().mockRejectedValue({
      isAxiosError: true,
      response: { status: 503 },
      message: 'unavailable',
    });

    await expect(fetchRapidApiKiwiRoundTrip('LHR', 'LIS', '2030-04-10', '2030-04-17')).rejects.toBeInstanceOf(
      RapidApiUnavailableError,
    );
  });
});
