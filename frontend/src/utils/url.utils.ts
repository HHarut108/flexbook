import LZString from 'lz-string';
import { Itinerary } from '@fast-travel/shared';
import type { Screen } from '../store/session.store';

const PARAM_KEY = 't';

const SCREEN_PATHS: Record<Screen, string> = {
  home: '/',
  'flight-results': '/flights',
  'stay-duration': '/stay',
  decision: '/review',
  'return-flights': '/return',
  itinerary: '/itinerary',
  'booking-review': '/book',
  'partial-booking': '/book/partial',
  'plan-stay': '/plan',
};

const PATH_SCREENS: Record<string, Screen> = Object.fromEntries(
  Object.entries(SCREEN_PATHS).map(([screen, path]) => [path, screen as Screen]),
);

export function screenToPath(screen: Screen): string {
  return SCREEN_PATHS[screen] ?? '/';
}

export function pathToScreen(path: string): Screen | null {
  return PATH_SCREENS[path] ?? null;
}

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
