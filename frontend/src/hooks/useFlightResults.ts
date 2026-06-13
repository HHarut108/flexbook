import { useCallback, useState } from 'react';
import { searchFlights, FlightSearchOptions } from '../api/flights.api';
import { useTripStore } from '../store/trip.store';
import { useFlightsStore, flightsCacheKey } from '../store/flights.store';

// Imperative API kept for compatibility with the screen, but state lives in the
// global store keyed by (iata, date, passengers). Repeat calls for a cached
// key are no-ops; concurrent calls for the same key dedupe.
export function useFlightResults() {
  const passengers = useTripStore((s) => s.passengers);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const entry = useFlightsStore((s) => (activeKey ? s.cache[activeKey] : undefined));
  const fetching = useFlightsStore((s) => (activeKey ? !!s.inFlight[activeKey] : false));

  const runFetch = useCallback(
    async (iata: string, date: string, options?: FlightSearchOptions) => {
      const key = flightsCacheKey(iata, date, passengers, options?.expandMetro);
      const store = useFlightsStore.getState();
      if (store.inFlight[key]) return;
      store.setInFlight(key, true);
      try {
        const flights = await searchFlights(iata, date, { ...options, passengers });
        useFlightsStore.getState().setEntry(key, {
          flights,
          error: null,
          fetchedAt: Date.now(),
        });
      } catch (err) {
        useFlightsStore.getState().setEntry(key, {
          flights: [],
          error: err instanceof Error ? err.message : 'Failed to load flights',
          fetchedAt: Date.now(),
        });
      } finally {
        useFlightsStore.getState().setInFlight(key, false);
      }
    },
    [passengers],
  );

  const search = useCallback(
    (iata: string, date: string, options?: FlightSearchOptions) => {
      const key = flightsCacheKey(iata, date, passengers, options?.expandMetro);
      setActiveKey(key);
      const store = useFlightsStore.getState();
      // Cache hit (success or error) → don't re-fetch. Use refetch() to force.
      if (store.cache[key]) return Promise.resolve();
      return runFetch(iata, date, options);
    },
    [passengers, runFetch],
  );

  // Bypasses cache. Used by the "Try again" path so a previously-errored key
  // can retry without polluting the imperative search() contract.
  const refetch = useCallback(
    (iata: string, date: string, options?: FlightSearchOptions) => {
      const key = flightsCacheKey(iata, date, passengers, options?.expandMetro);
      setActiveKey(key);
      useFlightsStore.getState().clearEntry(key);
      return runFetch(iata, date, options);
    },
    [passengers, runFetch],
  );

  return {
    flights: entry?.flights ?? [],
    isLoading: !entry && fetching,
    error: entry?.error ?? null,
    search,
    refetch,
  };
}
