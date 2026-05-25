import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { AirportSearchResponse } from '@fast-travel/shared';
import { getAirportIndex, searchIndex } from '../lib/airportIndex';
import { searchAirports } from '../api/airports.api';

const EMPTY: AirportSearchResponse = { results: [] };

export function useAirportSearch(query: string) {
  const [response, setResponse] = useState<AirportSearchResponse>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref to track latest query so stale async results don't clobber newer ones.
  const latestQuery = useRef(query);
  latestQuery.current = query;

  // Debounce timer only used for the server fallback (gazetteer) path.
  const fallbackTimer = useRef<ReturnType<typeof setTimeout>>();
  const fallbackController = useRef<AbortController | null>(null);

  useEffect(() => {
    clearTimeout(fallbackTimer.current);
    fallbackController.current?.abort();

    const trimmed = query.trim();

    if (!trimmed) {
      setResponse(EMPTY);
      setError(null);
      setLoading(false);
      return;
    }

    // Kick off the index load (no-op if already loaded/loading).
    getAirportIndex().then((index) => {
      // Guard: ignore if the user has already typed something else.
      if (latestQuery.current.trim() !== trimmed) return;

      const local = searchIndex(index, trimmed);

      if (local.length > 0) {
        setResponse({ results: local });
        setError(null);
        setLoading(false);
        return;
      }

      // No local hits — query is either very short or resolves only via the
      // gazetteer (small city with no commercial airport nearby). Fall back to
      // the backend which has the full gazetteer and "did you mean" logic.
      if (trimmed.length < 3) {
        setResponse(EMPTY);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      fallbackTimer.current = setTimeout(async () => {
        const controller = new AbortController();
        fallbackController.current = controller;
        try {
          const data = await searchAirports(trimmed, controller.signal);
          if (controller.signal.aborted) return;
          if (latestQuery.current.trim() !== trimmed) return;
          setResponse(data);
        } catch (err) {
          if (
            axios.isCancel(err) ||
            (err as { code?: string })?.code === 'ERR_CANCELED' ||
            (err as { name?: string })?.name === 'CanceledError' ||
            (err as { name?: string })?.name === 'AbortError'
          ) {
            return;
          }
          if (latestQuery.current.trim() !== trimmed) return;
          setResponse(EMPTY);
          setError(err instanceof Error ? err.message : 'Could not load airports. Please try again.');
        } finally {
          if (fallbackController.current === controller) setLoading(false);
        }
      }, 200);
    });
  }, [query]);

  return {
    results: response.results,
    fallback: response.fallback,
    loading,
    error,
  };
}
