import { useEffect } from 'react';
import { useTripStore } from '../store/trip.store';
import { useSessionStore } from '../store/session.store';
import { encodeItinerary, decodeItinerary } from '../utils/url.utils';

const PARAM_KEY = 't';

/**
 * Bidirectional URL sync for active trip state.
 * - Writes compressed trip JSON to ?t= on every leg/screen change.
 * - Restores trip + screen on first mount if ?t= is present.
 */
export function useUrlSync() {
  const legs = useTripStore((s) => s.legs);
  const origin = useTripStore((s) => s.origin);
  const status = useTripStore((s) => s.status);
  const createdAt = useTripStore((s) => s.createdAt);
  const loadFromItinerary = useTripStore((s) => s.loadFromItinerary);
  const screen = useSessionStore((s) => s.screen);
  const setScreen = useSessionStore((s) => s.setScreen);

  // Restore from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get(PARAM_KEY);
    if (!encoded) return;

    const itinerary = decodeItinerary(encoded);
    if (!itinerary || !itinerary.origin) return;

    loadFromItinerary(itinerary);

    // Restore to the most logical screen for the trip state
    if (itinerary.status === 'complete') {
      setScreen('itinerary');
    } else if (itinerary.legs.length > 0) {
      setScreen('decision');
    } else {
      setScreen('flight-results');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Write to URL on every state change (skip home screen — no trip yet)
  useEffect(() => {
    if (!origin || screen === 'home') {
      // Clear the param when user resets
      const url = new URL(window.location.href);
      if (url.searchParams.has(PARAM_KEY)) {
        url.searchParams.delete(PARAM_KEY);
        window.history.replaceState(null, '', url.toString());
      }
      return;
    }

    const itinerary = { origin, legs, status, createdAt };
    const encoded = encodeItinerary(itinerary);
    const url = new URL(window.location.href);
    url.searchParams.set(PARAM_KEY, encoded);
    window.history.replaceState(null, '', url.toString());
  }, [origin, legs, status, createdAt, screen]);
}
