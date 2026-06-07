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
  if (cached?.loaded) return Promise.resolve();
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
    if (!cached?.loaded) void load();
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
