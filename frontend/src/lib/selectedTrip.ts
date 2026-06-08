import { FlightOption } from '@fast-travel/shared';

/** A trip the user picked from /search and is reviewing on /trip/:id.
 *  Lives in sessionStorage keyed by a short id so the user can refresh and
 *  back-button without losing context. The /search results page knows the
 *  trip type so we never have to guess from the leg list. */
export interface SelectedTrip {
  id: string;
  type: 'oneway' | 'return' | 'multi';
  passengers: number;
  /** Flights in user-facing order — leg 1 first. Round-trip = [outbound,
   *  inbound]; multi-city = [leg1, …, legN]. */
  flights: FlightOption[];
  /** One booking row per ticket the user actually buys. For one-way and
   *  round-trip this is a single bundled link (the provider sells the pair
   *  together). For multi-city it's one row per leg because each leg is a
   *  separate ticket. */
  bookings: Array<{ label: string; url: string }>;
  totalPriceUsd: number;
}

const STORAGE_PREFIX = 'flexbook.selectedTrip.';

function randomId(): string {
  // crypto.randomUUID isn't available in every browser the staging build
  // touches; this is a tiny URL-safe id good enough for one-tab session use.
  const a = Math.random().toString(36).slice(2, 10);
  const b = Date.now().toString(36);
  return `${b}-${a}`;
}

export function persistSelectedTrip(trip: Omit<SelectedTrip, 'id'>): SelectedTrip {
  const id = randomId();
  const full: SelectedTrip = { ...trip, id };
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(full));
    }
  } catch {
    // sessionStorage may be unavailable in private mode — the user can still
    // see the trip during the current navigation because the screen also
    // accepts state from useLocation, but a refresh won't survive that.
  }
  return full;
}

export function loadSelectedTrip(id: string | undefined): SelectedTrip | null {
  if (!id || typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw) as SelectedTrip;
  } catch {
    return null;
  }
}
