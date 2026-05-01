import { useCallback } from 'react';
import { searchFlights, FlightSearchOptions } from '../api/flights.api';
import { useSessionStore } from '../store/session.store';
import { useTripStore } from '../store/trip.store';

export function useFlightSearch() {
  const { setFlightLoading, setFlightError, setPendingFlights } = useSessionStore();
  const passengers = useTripStore((s) => s.passengers);

  const search = useCallback(
    async (originIata: string, date: string, options?: FlightSearchOptions) => {
      setFlightLoading(true);
      setFlightError(null);
      try {
        const flights = await searchFlights(originIata, date, { ...options, passengers });
        setPendingFlights(flights);
      } catch (err) {
        setFlightError(err instanceof Error ? err.message : 'Failed to load flights');
        setPendingFlights([]);
      } finally {
        setFlightLoading(false);
      }
    },
    [passengers, setFlightLoading, setFlightError, setPendingFlights],
  );

  return { search };
}
