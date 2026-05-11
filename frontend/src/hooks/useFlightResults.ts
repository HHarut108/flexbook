import { useState, useCallback } from 'react';
import { FlightOption } from '@fast-travel/shared';
import { searchFlights, FlightSearchOptions } from '../api/flights.api';
import { useTripStore } from '../store/trip.store';

export function useFlightResults() {
  const [flights, setFlights] = useState<FlightOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passengers = useTripStore((s) => s.passengers);

  const search = useCallback(
    async (originIata: string, date: string, options?: FlightSearchOptions) => {
      setIsLoading(true);
      setError(null);
      try {
        const results = await searchFlights(originIata, date, { ...options, passengers });
        setFlights(results);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load flights');
        setFlights([]);
      } finally {
        setIsLoading(false);
      }
    },
    [passengers],
  );

  const reset = useCallback(() => {
    setFlights([]);
    setError(null);
  }, []);

  return { flights, isLoading, error, search, reset };
}
