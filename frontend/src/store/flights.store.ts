import { create } from 'zustand';
import { FlightOption } from '@fast-travel/shared';

// In-memory keyed cache for /flights. Survives screen remounts so back-nav
// and date-toggle revisits paint instantly instead of re-fetching.
// Lives only in memory — a hard refresh still hits the network.

export interface FlightsCacheEntry {
  flights: FlightOption[];
  error: string | null;
  fetchedAt: number;
}

export interface FlightsUiState {
  expandedCountry: string | null;
  popupDestIata: string | null;
  // Tracks whether the user has manually toggled. While false, the screen
  // auto-expands the cheapest country as data arrives.
  userTouched: boolean;
}

export const DEFAULT_UI: FlightsUiState = {
  expandedCountry: null,
  popupDestIata: null,
  userTouched: false,
};

interface FlightsStoreState {
  // Results cache: key = `${iata}|${date}|${passengers}`
  cache: Record<string, FlightsCacheEntry>;
  // Active fetches by the same key — used to dedupe concurrent callers.
  inFlight: Record<string, boolean>;
  // UI state per (iata, date) — passengers doesn't affect the country layout,
  // so it isn't part of the key.
  ui: Record<string, FlightsUiState>;

  setEntry: (key: string, entry: FlightsCacheEntry) => void;
  clearEntry: (key: string) => void;
  setInFlight: (key: string, value: boolean) => void;
  updateUi: (key: string, patch: Partial<FlightsUiState>) => void;
}

export const useFlightsStore = create<FlightsStoreState>((set) => ({
  cache: {},
  inFlight: {},
  ui: {},

  setEntry: (key, entry) =>
    set((s) => ({ cache: { ...s.cache, [key]: entry } })),

  clearEntry: (key) =>
    set((s) => {
      if (!(key in s.cache)) return s;
      const next = { ...s.cache };
      delete next[key];
      return { cache: next };
    }),

  setInFlight: (key, value) =>
    set((s) => {
      if (!value) {
        if (!s.inFlight[key]) return s;
        const next = { ...s.inFlight };
        delete next[key];
        return { inFlight: next };
      }
      return { inFlight: { ...s.inFlight, [key]: true } };
    }),

  updateUi: (key, patch) =>
    set((s) => ({
      ui: { ...s.ui, [key]: { ...(s.ui[key] ?? DEFAULT_UI), ...patch } },
    })),
}));

export function flightsCacheKey(iata: string, date: string, passengers: number) {
  return `${iata}|${date}|${passengers}`;
}

export function flightsUiKey(iata: string, date: string) {
  return `${iata}|${date}`;
}
