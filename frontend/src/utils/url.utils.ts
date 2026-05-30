import LZString from 'lz-string';
import { FlightOption, Itinerary } from '@fast-travel/shared';

const PARAM_KEY = 't';

export function encodeItinerary(itinerary: Itinerary): string {
  const json = JSON.stringify(itinerary);
  return LZString.compressToEncodedURIComponent(json);
}

export function decodeItinerary(encoded: string): Itinerary | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    return JSON.parse(json) as Itinerary;
  } catch {
    return null;
  }
}

export function readShareParam(): Itinerary | null {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get(PARAM_KEY);
  if (!encoded) return null;
  return decodeItinerary(encoded);
}

export function buildSlugShareUrl(slug: string): string {
  return `${window.location.origin}/share/${slug}`;
}

// Transient picker state persisted alongside the committed Itinerary so the
// user can reload mid-funnel (/stay, /flights leg 2+) without losing the flight
// they were about to commit or the date they were searching.
export interface UrlSessionState {
  selectedFlight?: FlightOption | null;
  selectedDate?: string | null;
}

export function encodeSession(session: UrlSessionState): string {
  const json = JSON.stringify(session);
  return LZString.compressToEncodedURIComponent(json);
}

export function decodeSession(encoded: string): UrlSessionState | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    return JSON.parse(json) as UrlSessionState;
  } catch {
    return null;
  }
}
