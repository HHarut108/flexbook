import { useCallback, useEffect, useRef, useState } from 'react';
import { FlightOption } from '@fast-travel/shared';
import { searchFlights } from '../api/flights.api';
import { useTripStore } from '../store/trip.store';
import { format, addDays, parseISO } from 'date-fns';

const WINDOW_DAYS = 3;

/**
 * Fan-out: searches `WINDOW_DAYS` consecutive days starting at `baseDate`
 * (returnFromIata → originIata), takes the cheapest result from each day,
 * and merges into one list sorted by price.
 *
 * Why a fan-out: a single (city-pair, date) tuple often only has one cheap
 * itinerary in Kiwi's index, so showing one date returned exactly one card.
 * Spreading the query across 3 days gives the user real choices to compare —
 * "fly home Sun for $200, Mon for $185, Tue for $220" — which is the actual
 * decision they're making.
 */
export function useReturnOptions() {
  const [flights, setFlights] = useState<FlightOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passengers = useTripStore((s) => s.passengers);
  const requestSeqRef = useRef(0);

  const search = useCallback(
    async (fromIata: string, toIata: string, baseDate: string) => {
      const seq = ++requestSeqRef.current;
      setIsLoading(true);
      setError(null);
      try {
        const dates = Array.from({ length: WINDOW_DAYS }, (_, i) =>
          format(addDays(parseISO(baseDate), i), 'yyyy-MM-dd'),
        );
        const settled = await Promise.allSettled(
          dates.map((d) =>
            searchFlights(fromIata, d, {
              destination: toIata,
              deduplicate: false,
              passengers,
            }),
          ),
        );
        if (seq !== requestSeqRef.current) return; // a newer request superseded us

        const perDayCheapest: FlightOption[] = [];
        for (const r of settled) {
          if (r.status !== 'fulfilled') continue;
          const dayBest = r.value
            .slice()
            .sort((a, b) => a.priceUsd - b.priceUsd)[0];
          if (dayBest) perDayCheapest.push(dayBest);
        }
        perDayCheapest.sort((a, b) => a.priceUsd - b.priceUsd);
        setFlights(perDayCheapest);

        if (perDayCheapest.length === 0) {
          const firstReject = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected');
          if (firstReject) {
            const reason = firstReject.reason;
            setError(reason instanceof Error ? reason.message : 'Failed to load flights');
          }
        }
      } catch (err) {
        if (seq !== requestSeqRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load flights');
        setFlights([]);
      } finally {
        if (seq === requestSeqRef.current) setIsLoading(false);
      }
    },
    [passengers],
  );

  return { flights, isLoading, error, search };
}
