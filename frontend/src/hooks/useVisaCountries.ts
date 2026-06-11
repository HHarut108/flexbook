import { useEffect, useState } from 'react';
import { fetchVisaCountries, type VisaCountry } from '../api/visa.api';

interface State {
  countries: VisaCountry[];
  byNameLower: Map<string, string>;
  loaded: boolean;
  error: string | null;
}

const EMPTY: State = { countries: [], byNameLower: new Map(), loaded: false, error: null };

let cached: State | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<(s: State) => void>();

function broadcast() {
  if (!cached) return;
  for (const l of listeners) l(cached);
}

function load(): Promise<void> {
  // Only short-circuit on a *successful* load. After an error (cold visa-
  // service, transient network), `cached` reflects the error but we want the
  // next hook mount to be able to retry — otherwise one bad request poisons
  // the page until full reload.
  if (cached?.loaded && cached.error === null) return Promise.resolve();
  if (inflight) return inflight;
  inflight = fetchVisaCountries()
    .then((list) => {
      const byNameLower = new Map<string, string>();
      for (const c of list) byNameLower.set(c.name.toLowerCase(), c.code);
      cached = { countries: list, byNameLower, loaded: true, error: null };
      broadcast();
    })
    .catch((err: Error) => {
      cached = { ...EMPTY, loaded: true, error: err.message };
      broadcast();
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useVisaCountries(): State {
  const [state, setState] = useState<State>(cached ?? EMPTY);
  useEffect(() => {
    listeners.add(setState);
    // Retry on mount if we don't have a clean cached success yet — covers both
    // "never loaded" and "previously failed" (e.g. cold visa-service on first
    // visit, now warm).
    if (!cached?.loaded || cached.error) void load();
    else setState(cached);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return state;
}

export function resolveCountryCode(name: string | null | undefined): string | null {
  if (!name || !cached?.loaded) return null;
  return cached.byNameLower.get(name.trim().toLowerCase()) ?? null;
}

/** Fire-and-forget warmer. Pulls the country list (and wakes the
 *  visa-service cold start) so that by the time the user lands on a
 *  results screen the lookup is instant. Safe to call multiple times. */
export function prefetchVisaCountries(): void {
  if (cached?.loaded && cached.error === null) return;
  void load();
}
