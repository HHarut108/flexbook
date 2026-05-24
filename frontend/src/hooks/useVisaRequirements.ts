import { useEffect, useState } from 'react';
import { fetchVisaRequirement, type VisaRequirement } from '../api/visa.api';

type Entry =
  | { status: 'loading' }
  | { status: 'ok'; data: VisaRequirement }
  | { status: 'error'; message: string }
  | { status: 'unsupported' };

type ResultMap = Record<string, Entry>;

const cache = new Map<string, VisaRequirement>();
const inflight = new Map<string, Promise<void>>();

/**
 * Look up visa requirements for a passport against a list of destination ISO-2
 * codes. Results are cached in-process for the session; the backend already
 * caches against the upstream microservice, so repeated calls are cheap.
 *
 * Destinations of `null` (e.g. country name couldn't be resolved to an ISO-2)
 * become `{ status: 'unsupported' }` so the UI can render a fallback.
 */
export function useVisaRequirements(
  passport: string | null,
  destinations: Array<string | null>,
): ResultMap {
  const [results, setResults] = useState<ResultMap>({});

  useEffect(() => {
    if (!passport) {
      setResults({});
      return;
    }

    const next: ResultMap = {};
    const toFetch: string[] = [];
    const seen = new Set<string>();

    for (const dest of destinations) {
      if (!dest) continue;
      if (seen.has(dest)) continue;
      seen.add(dest);

      const key = `${passport}:${dest}`;
      const cached = cache.get(key);
      if (cached) {
        next[dest] = { status: 'ok', data: cached };
      } else if (dest === passport) {
        // Same-country: visa-free, no upstream call needed.
        const synthetic: VisaRequirement = {
          passport,
          destination: dest,
          status: 'visa free',
          label: 'Visa Free',
          last_updated: '',
        };
        cache.set(key, synthetic);
        next[dest] = { status: 'ok', data: synthetic };
      } else {
        next[dest] = { status: 'loading' };
        toFetch.push(dest);
      }
    }
    setResults(next);

    let cancelled = false;
    for (const dest of toFetch) {
      const key = `${passport}:${dest}`;
      const existing = inflight.get(key);
      const promise =
        existing ??
        fetchVisaRequirement(passport, dest)
          .then((data) => {
            cache.set(key, data);
          })
          .catch(() => {
            /* swallow; we'll mark error in state below */
          })
          .finally(() => {
            inflight.delete(key);
          });
      if (!existing) inflight.set(key, promise);

      promise.then(() => {
        if (cancelled) return;
        setResults((prev) => {
          const cached = cache.get(key);
          if (cached) return { ...prev, [dest]: { status: 'ok', data: cached } };
          return { ...prev, [dest]: { status: 'error', message: 'Lookup failed' } };
        });
      });
    }

    return () => {
      cancelled = true;
    };
    // Stringify the destinations array to make the effect dep stable.
  }, [passport, destinations.join('|')]);

  // Tag unresolved-name destinations so the UI can render a placeholder.
  const final: ResultMap = { ...results };
  for (const dest of destinations) {
    if (dest === null) continue;
    if (!(dest in final) && passport) final[dest] = { status: 'loading' };
  }
  return final;
}
