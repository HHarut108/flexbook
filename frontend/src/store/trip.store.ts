import { create } from 'zustand';
import { Airport, TripLeg, Itinerary } from '@fast-travel/shared';

const MAX_LEGS = 15;

interface TripState {
  origin: Airport | null;
  legs: TripLeg[];
  status: 'planning' | 'complete';
  createdAt: string;

  setOrigin: (airport: Airport) => void;
  addLeg: (leg: TripLeg) => void;
  updateStay: (stopIndex: number, days: number, nextDepartureDate: string) => void;
  finalize: () => void;
  reset: () => void;
  loadFromItinerary: (itinerary: Itinerary) => void;

  canContinue: () => boolean;
  currentStop: () => Airport | null;
  nextDepartureDate: () => string | null;
  toItinerary: () => Itinerary | null;
}

export const useTripStore = create<TripState>((set, get) => ({
  origin: null,
  legs: [],
  status: 'planning',
  createdAt: new Date().toISOString(),

  setOrigin: (airport) =>
    set({ origin: airport, legs: [], status: 'planning', createdAt: new Date().toISOString() }),

  addLeg: (leg) => set((s) => ({ legs: [...s.legs, leg] })),

  updateStay: (stopIndex, days, nextDepartureDate) =>
    set((s) => ({
      legs: s.legs.map((l) =>
        l.stopIndex === stopIndex ? { ...l, stayDurationDays: days, nextDepartureDate } : l,
      ),
    })),

  finalize: () => set({ status: 'complete' }),

  reset: () =>
    set({ origin: null, legs: [], status: 'planning', createdAt: new Date().toISOString() }),

  loadFromItinerary: (it) =>
    set({ origin: it.origin, legs: it.legs, status: it.status, createdAt: it.createdAt }),

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
    const { origin, legs, status, createdAt } = get();
    if (!origin) return null;
    return { origin, legs, status, createdAt };
  },
}));
