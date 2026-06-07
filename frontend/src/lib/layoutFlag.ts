import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'layout_v2';
const QUERY_KEY = 'v2';

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function readQueryOverride(): boolean | null {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get(QUERY_KEY);
  if (value === '1' || value === 'true') return true;
  if (value === '0' || value === 'false') return false;
  return null;
}

function readStorageOverride(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === '1') return true;
    if (value === '0') return false;
  } catch {
    // private mode / disabled storage → fall through to env default
  }
  return null;
}

function readEnvDefault(): boolean {
  return import.meta.env.VITE_LAYOUT_V2 === '1' || import.meta.env.VITE_LAYOUT_V2 === 'true';
}

/**
 * Resolves the V2 flag. Order: ?v2=… → localStorage → VITE_LAYOUT_V2 → false.
 * A ?v2 querystring also writes to localStorage so the choice is sticky
 * across reloads and internal links.
 */
export function isV2Enabled(): boolean {
  const query = readQueryOverride();
  if (query !== null) {
    try {
      window.localStorage.setItem(STORAGE_KEY, query ? '1' : '0');
    } catch {
      // ignore — query override still wins for this page
    }
    return query;
  }
  const stored = readStorageOverride();
  if (stored !== null) return stored;
  return readEnvDefault();
}

/**
 * Persist an explicit override. Pass `null` to clear and fall back to env default.
 */
export function setV2Override(value: boolean | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // ignore
  }
  notify();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * React hook: re-renders when the flag changes via setV2Override.
 * Reads fresh on every render so querystring flips also take effect after navigation.
 */
export function useV2(): boolean {
  return useSyncExternalStore(subscribe, isV2Enabled, () => false);
}
