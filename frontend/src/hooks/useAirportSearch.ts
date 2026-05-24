import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Airport } from '@fast-travel/shared';
import { searchAirports } from '../api/airports.api';

// Tiny in-memory LRU-ish cache for recently typed queries. Keeps the UI feeling
// snappy when the user deletes/retypes and avoids hammering the backend.
const RECENT_CACHE_MAX = 30;
const RECENT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
type CacheEntry = { results: Airport[]; ts: number };
const recentCache = new Map<string, CacheEntry>();

function readCache(key: string): Airport[] | null {
  const entry = recentCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > RECENT_CACHE_TTL_MS) {
    recentCache.delete(key);
    return null;
  }
  // Touch for LRU ordering
  recentCache.delete(key);
  recentCache.set(key, entry);
  return entry.results;
}

function writeCache(key: string, results: Airport[]): void {
  recentCache.set(key, { results, ts: Date.now() });
  if (recentCache.size > RECENT_CACHE_MAX) {
    const oldest = recentCache.keys().next().value;
    if (oldest !== undefined) recentCache.delete(oldest);
  }
}

export function useAirportSearch(query: string, debounceMs = 300) {
  const [results, setResults] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Abort any in-flight request — only the latest query should win.
    if (controllerRef.current) controllerRef.current.abort();

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    // Serve from cache instantly when available.
    const key = trimmed.toLowerCase();
    const cached = readCache(key);
    if (cached) {
      setResults(cached);
      setError(null);
      setLoading(false);
      return;
    }

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      controllerRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const data = await searchAirports(trimmed, controller.signal);
        if (controller.signal.aborted) return;
        writeCache(key, data);
        setResults(data);
      } catch (err) {
        // Cancellations are expected — ignore them.
        if (
          axios.isCancel(err) ||
          (err as { code?: string })?.code === 'ERR_CANCELED' ||
          (err as { name?: string })?.name === 'CanceledError' ||
          (err as { name?: string })?.name === 'AbortError'
        ) {
          return;
        }
        setResults([]);
        setError(
          err instanceof Error ? err.message : 'Could not load airports. Please try again.',
        );
      } finally {
        if (controllerRef.current === controller) {
          setLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, debounceMs]);

  return { results, loading, error };
}
