import { create } from 'zustand';
import { Airport, TripLeg, Itinerary, LocationSelection } from '@fast-travel/shared';

const MAX_LEGS = 15;

interface TripState {
  origin: Airport | null;
  /** City id set when the user picked a multi-airport "Rome (city)" rather
   *  than a specific airport. `origin` holds the city's busiest member
   *  airport (for map + labels); flight searches use the city marker to
   *  fan out across all member airports. */
  originCityId: string | null;
  legs: TripLeg[];
  status: 'planning' | 'complete';
  createdAt: string;
  passengers: number;

  /** Accepts either kind of selection. City picks store the primary airport
   *  in `origin` AND the city id in `originCityId`. */
  setOrigin: (selection: LocationSelection) => void;
  setPassengers: (count: number) => void;
  addLeg: (leg: TripLeg) => void;
  updateStay: (stopIndex: number, days: number, nextDepartureDate: string) => void;
  finalize: () => void;
  reset: () => void;
  loadFromItinerary: (itinerary: Itinerary) => void;

  canContinue: () => boolean;
  currentStop: () => Airport | null;
  nextDepartureDate: () => string | null;
  toItinerary: () => Itinerary | null;
  /** Marker form for backend params + URL state — "@<cityId>" if the user
   *  picked a city, else the primary airport's IATA. */
  originMarker: () => string | null;
}

export const useTripStore = create<TripState>((set, get) => ({
  origin: null,
  originCityId: null,
  legs: [],
  status: 'planning',
  createdAt: new Date().toISOString(),
  passengers: 1,

  setOrigin: (selection) => {
    if (selection.kind === 'city') {
      // Project city → primary airport for `origin` (map + labels), keep
      // the city id for fan-out at search time.
      const primary = selection.city.airports[0];
      const projected: Airport = {
        iata: primary,
        name: `${selection.city.name} Airport`,
        city: {
          id: primary,
          name: selection.city.name,
          countryCode: selection.city.countryCode,
          countryName: selection.city.countryName,
          lat: selection.city.lat,
          lng: selection.city.lng,
        },
        timezone: '',
      };
      set({
        origin: projected,
        originCityId: selection.city.id,
        legs: [],
        status: 'planning',
        createdAt: new Date().toISOString(),
      });
    } else {
      set({
        origin: selection.airport,
        originCityId: null,
        legs: [],
        status: 'planning',
        createdAt: new Date().toISOString(),
      });
    }
  },

  setPassengers: (count) => set({ passengers: Math.max(1, Math.min(9, count)) }),

  addLeg: (leg) =>
    set((s) => {
      if (leg.isReturn) {
        const outbound = s.legs.filter((l) => !l.isReturn);
        return { legs: [...outbound, leg] };
      }
      const existingIdx = s.legs.findIndex((l) => !l.isReturn && l.flightId === leg.flightId);
      if (existingIdx >= 0) {
        const next = [...s.legs];
        next[existingIdx] = leg;
        return { legs: next };
      }
      return { legs: [...s.legs, leg] };
    }),

  updateStay: (stopIndex, days, nextDepartureDate) =>
    set((s) => ({
      legs: s.legs.map((l) =>
        l.stopIndex === stopIndex ? { ...l, stayDurationDays: days, nextDepartureDate } : l,
      ),
    })),

  finalize: () => set({ status: 'complete' }),

  reset: () =>
    set({ origin: null, originCityId: null, legs: [], status: 'planning', createdAt: new Date().toISOString(), passengers: 1 }),

  loadFromItinerary: (it) =>
    set({
      origin: it.origin,
      originCityId: it.originCityId ?? null,
      legs: it.legs,
      status: it.status,
      createdAt: it.createdAt,
      passengers: it.passengers ?? 1,
    }),

  canContinue: () => {
    const { legs } = get();
    const nonReturnLegs = legs.filter((l) => !l.isReturn);
    return nonReturnLegs.length < MAX_LEGS;
  },

  currentStop: () => {
    const { origin, legs } = get();
    const lastLeg = legs.filter((l) => !l.isReturn).at(-1);
    if (!lastLeg) return origin;
    return {
      iata: lastLeg.destinationIata,
      name: lastLeg.destinationCity + ' Airport',
      city: {
        id: lastLeg.destinationIata,
        name: lastLeg.destinationCity,
        countryCode: '',
        countryName: lastLeg.destinationCountry,
        lat: lastLeg.destinationLat,
        lng: lastLeg.destinationLng,
      },
      timezone: '',
    } satisfies Airport;
  },

  nextDepartureDate: () => {
    const { legs } = get();
    const lastLeg = legs.filter((l) => !l.isReturn).at(-1);
    return lastLeg?.nextDepartureDate ?? null;
  },

  toItinerary: () => {
    const { origin, originCityId, legs, status, createdAt, passengers } = get();
    if (!origin) return null;
    return {
      origin,
      ...(originCityId ? { originCityId } : {}),
      legs,
      status,
      createdAt,
      passengers,
    };
  },

  originMarker: () => {
    const { origin, originCityId } = get();
    if (!origin) return null;
    return originCityId ? `@${originCityId}` : origin.iata;
  },
}));
