import { useEffect } from 'react';
import { useTripStore } from '../store/trip.store';
import { useSessionStore } from '../store/session.store';
import { decodeItinerary, decodeSession } from '../utils/url.utils';

const TRIP_KEY = 't';
const SESSION_KEY = 's';

/**
 * Re-hydrate trip + session stores from the URL whenever the user navigates
 * via the browser's back/forward buttons.
 *
 * Why: the funnel screens (/flights, /stay, /review) read from the zustand
 * stores, not from the URL. `useUrlSync` mirrors store → URL using
 * `replaceState`, so each history entry has the correct URL — but once the
 * trip evolves forward (e.g. user picks leg 2), the store holds the new
 * state and never gets rolled back when the browser back button restores an
 * older history entry. So /flights with `?t=<just-origin+leg1>` would still
 * render leg-2 search results because the store still holds [leg1, leg2].
 *
 * Fix: listen for `popstate`, decode the now-current URL, and re-hydrate
 * the stores. `popstate` fires ONLY for browser back/forward — never for
 * `pushState`/`replaceState` — so this can't fight with the store → URL
 * mirroring inside `useUrlSync`.
 *
 * Also handles forward navigation through history (the inverse: re-applying
 * a later state when the user clicks forward).
 */
export function useUrlHydrationOnPop(): void {
  useEffect(() => {
    function handlePopState() {
      const params = new URLSearchParams(window.location.search);
      const encodedTrip = params.get(TRIP_KEY);
      const encodedSession = params.get(SESSION_KEY);

      // Trip state — full re-hydrate or full reset, never partial. Mixing
      // would leave the store inconsistent (e.g. legs that don't match the
      // current origin) and trigger RequireOrigin redirects in odd places.
      const trip = useTripStore.getState();
      if (encodedTrip) {
        const it = decodeItinerary(encodedTrip);
        if (it?.origin) {
          trip.loadFromItinerary(it);
        }
      } else {
        // No `?t=` in the restored URL → the user navigated to a non-funnel
        // entry (e.g. /, /hop-planner). Clear the trip so RequireOrigin
        // continues to behave as the user expects.
        trip.reset();
      }

      // Session state — selectedFlight + selectedDate. Mirror the URL
      // exactly: present in `?s=` ⇒ use it, absent ⇒ clear it.
      const sess = useSessionStore.getState();
      if (encodedSession) {
        const sd = decodeSession(encodedSession);
        sess.setSelectedFlight(sd?.selectedFlight ?? null);
        if (sd?.selectedDate) sess.setSelectedDate(sd.selectedDate);
      } else {
        sess.setSelectedFlight(null);
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);
}
