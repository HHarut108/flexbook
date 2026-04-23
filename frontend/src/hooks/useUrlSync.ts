import { useEffect } from 'react';
import { useTripStore } from '../store/trip.store';
import { useSessionStore } from '../store/session.store';
import { encodeItinerary, decodeItinerary } from '../utils/url.utils';
import { fetchTripShare } from '../api/trips.api';

const PARAM_KEY = 't';
const TRIP_PARAM = 'trip';

/**
 * Bidirectional URL sync for active trip state.
 * - On mount: restores from ?trip=<id> (server-stored, shows expired modal on 404)
 *             or falls back to legacy ?t=<encoded> param.
 * - On state change: writes compressed trip JSON to ?t= for session continuity.
 */
export function useUrlSync() {
  const legs = useTripStore((s) => s.legs);
  const origin = useTripStore((s) => s.origin);
  const status = useTripStore((s) => s.status);
  const createdAt = useTripStore((s) => s.createdAt);
  const loadFromItinerary = useTripStore((s) => s.loadFromItinerary);
  const screen = useSessionStore((s) => s.screen);
  const setScreen = useSessionStore((s) => s.setScreen);
  const showExpiredLinkModal = useSessionStore((s) => s.showExpiredLinkModal);

  // Restore from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Short share link: ?trip=<id>
    const tripId = params.get(TRIP_PARAM);
    if (tripId) {
      // Clear the param immediately so the session URL takes over
      const url = new URL(window.location.href);
      url.searchParams.delete(TRIP_PARAM);
      window.history.replaceState(null, '', url.toString());

      fetchTripShare(tripId).then((itinerary) => {
        if (!itinerary) {
          showExpiredLinkModal();
          return;
        }
        loadFromItinerary(itinerary);
        if (itinerary.status === 'complete') {
          setScreen('itinerary');
        } else if (itinerary.legs.length > 0) {
          setScreen('decision');
        } else {
          setScreen('flight-results');
        }
      });
      return;
    }

    // Legacy inline-encoded link: ?t=<lzstring>
    const encoded = params.get(PARAM_KEY);
    if (!encoded) return;

    const itinerary = decodeItinerary(encoded);
    if (!itinerary || !itinerary.origin) return;

    loadFromItinerary(itinerary);

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
