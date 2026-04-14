import { FlightOption } from '@fast-travel/shared';

const MOCK_DESTINATIONS = [
  { iata: 'LIS', city: 'Lisbon', country: 'Portugal', lat: 38.7749, lng: -9.1342 },
  { iata: 'MAD', city: 'Madrid', country: 'Spain', lat: 40.4168, lng: -3.7038 },
  { iata: 'CDG', city: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
  { iata: 'AMS', city: 'Amsterdam', country: 'Netherlands', lat: 52.3676, lng: 4.9041 },
  { iata: 'FCO', city: 'Rome', country: 'Italy', lat: 41.9028, lng: 12.4964 },
  { iata: 'VIE', city: 'Vienna', country: 'Austria', lat: 48.2082, lng: 16.3738 },
  { iata: 'PRG', city: 'Prague', country: 'Czech Republic', lat: 50.0755, lng: 14.4378 },
  { iata: 'BUD', city: 'Budapest', country: 'Hungary', lat: 47.4979, lng: 19.0402 },
  { iata: 'ATH', city: 'Athens', country: 'Greece', lat: 37.9838, lng: 23.7275 },
  { iata: 'CPH', city: 'Copenhagen', country: 'Denmark', lat: 55.6761, lng: 12.5683 },
];

const AIRLINES = [
  { name: 'Ryanair', code: 'FR' },
  { name: 'EasyJet', code: 'U2' },
  { name: 'Vueling', code: 'VY' },
  { name: 'Wizz Air', code: 'W6' },
  { name: 'Norwegian', code: 'DY' },
  { name: 'Iberia', code: 'IB' },
];

// Connecting hubs used for mock 1-stop itineraries (index matches i % 3 === 2 flights)
const MOCK_VIA_HUBS = ['FRA', 'MUC', 'IST', 'ZRH'];

function randomPrice(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

/**
 * Build 3 synthetic flights from originIata to a specific destination that
 * isn't in our static MOCK_DESTINATIONS list (e.g. EVN, TBS, etc.).
 * Returns a direct option and 1-2 via-hub options.
 */
function buildTargetedFlights(
  originIata: string,
  originCity: string,
  destIata: string,
  date: string,
): FlightOption[] {
  const departureDatetime = `${date}T06:00:00Z`;

  const options: Array<{
    durationMinutes: number;
    stops: number;
    viaIatas?: string[];
    airline: { name: string; code: string };
  }> = [
    { durationMinutes: 210, stops: 0, airline: { name: 'Wizz Air', code: 'W6' } },
    { durationMinutes: 330, stops: 1, viaIatas: ['VIE'], airline: { name: 'Austrian Airlines', code: 'OS' } },
    { durationMinutes: 390, stops: 1, viaIatas: ['IST'], airline: { name: 'Turkish Airlines', code: 'TK' } },
  ];

  return options.map((opt, i) => {
    const arrivalMs = new Date(departureDatetime).getTime() + opt.durationMinutes * 60_000;
    return {
      flightId: `MOCK-${originIata}-${destIata}-${date}-R${i}`,
      originIata,
      originCity,
      destinationIata: destIata,
      // Use the destination city name if we know it; fall back to the IATA code
      destinationCity: destIata,
      destinationCountry: '',
      destinationLat: 0,
      destinationLng: 0,
      departureDatetime,
      arrivalDatetime: new Date(arrivalMs).toISOString(),
      durationMinutes: opt.durationMinutes,
      airlineName: opt.airline.name,
      airlineCode: opt.airline.code,
      stops: opt.stops,
      viaIatas: opt.viaIatas,
      priceUsd: randomPrice(i === 0 ? 80 : 50, i === 0 ? 200 : 150),
      bookingUrl: `https://example.com/book/${originIata}-${destIata}-${date}`,
    };
  });
}

export async function fetchMockFlights(
  originIata: string,
  originCity: string,
  date: string,
  destinationIata?: string,
): Promise<FlightOption[]> {
  // Simulate network latency
  await new Promise((r) => setTimeout(r, 50));

  // If a specific destination is requested, serve targeted mock flights
  if (destinationIata) {
    const knownDest = MOCK_DESTINATIONS.find((d) => d.iata === destinationIata);

    if (knownDest) {
      // Destination is in our static list — return a single targeted flight
      const departureDatetime = `${date}T08:00:00Z`;
      const durationMinutes = 150;
      const arrivalMs = new Date(departureDatetime).getTime() + durationMinutes * 60_000;
      return [
        {
          flightId: `MOCK-${originIata}-${destinationIata}-${date}-direct`,
          originIata,
          originCity,
          destinationIata: knownDest.iata,
          destinationCity: knownDest.city,
          destinationCountry: knownDest.country,
          destinationLat: knownDest.lat,
          destinationLng: knownDest.lng,
          departureDatetime,
          arrivalDatetime: new Date(arrivalMs).toISOString(),
          durationMinutes,
          airlineName: AIRLINES[0].name,
          airlineCode: AIRLINES[0].code,
          stops: 0,
          priceUsd: randomPrice(60, 180),
          bookingUrl: `https://example.com/book/${originIata}-${destinationIata}-${date}`,
        },
      ];
    }

    // Destination is outside the static list (e.g. user's home city EVN, TBS, etc.)
    // Generate realistic targeted options: 1 direct + 2 via hub
    return buildTargetedFlights(originIata, originCity, destinationIata, date);
  }

  // No destination filter — return the full explore list (used by FlightResultsScreen)
  const departureDatetime = `${date}T06:00:00Z`;

  return MOCK_DESTINATIONS.map((dest, i) => {
    const durationMinutes = 90 + i * 30;
    const arrivalMs = new Date(departureDatetime).getTime() + durationMinutes * 60_000;
    const airline = AIRLINES[i % AIRLINES.length];
    return {
      flightId: `MOCK-${originIata}-${dest.iata}-${date}-${i}`,
      originIata,
      originCity,
      destinationIata: dest.iata,
      destinationCity: dest.city,
      destinationCountry: dest.country,
      destinationLat: dest.lat,
      destinationLng: dest.lng,
      departureDatetime,
      arrivalDatetime: new Date(arrivalMs).toISOString(),
      durationMinutes,
      airlineName: airline.name,
      airlineCode: airline.code,
      stops: i % 3 === 2 ? 1 : 0,
      viaIatas: i % 3 === 2 ? [MOCK_VIA_HUBS[Math.floor(i / 3) % MOCK_VIA_HUBS.length]] : undefined,
      priceUsd: randomPrice(20, 200),
      bookingUrl: `https://example.com/book/${originIata}-${dest.iata}-${date}`,
    };
  });
}
