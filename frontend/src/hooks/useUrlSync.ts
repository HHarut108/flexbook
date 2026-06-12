import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTripStore } from '../store/trip.store';
import { useSessionStore } from '../store/session.store';
import { encodeItinerary, encodeSession } from '../utils/url.utils';

const TRIP_KEY = 't';
const SESSION_KEY = 's';
const DEBOUNCE_MS = 150;

// Routes that own their own URL state and should never carry the trip-store
// `?t=` / session `?s=` params. `/` is the generic flight-search home;
// `/hop-planner` is the Trip Builder entry point (origin not yet picked);
// `/search` carries its own search-form params (origin/destination/depart/...).
const HOME_LIKE_PATHS = new Set(['/', '/hop-planner', '/search']);

export function useUrlSync() {
  const location = useLocation();
  const origin     = useTripStore((s) => s.origin);
  const legs       = useTripStore((s) => s.legs);
  const status     = useTripStore((s) => s.status);
  const createdAt  = useTripStore((s) => s.createdAt);
  const passengers = useTripStore((s) => s.passengers);
  const picks      = useTripStore((s) => s.picks);
  const selectedFlight = useSessionStore((s) => s.selectedFlight);
  const selectedDate   = useSessionStore((s) => s.selectedDate);

  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const lastTripRef = useRef('');
  const lastSessionRef = useRef('');
  const lastPathRef = useRef(location.pathname);

  useEffect(() => {
    const writeUrl = () => {
      const url = new URL(window.location.href);

      if (!origin || HOME_LIKE_PATHS.has(location.pathname)) {
        let changed = false;
        if (url.searchParams.has(TRIP_KEY)) {
          url.searchParams.delete(TRIP_KEY);
          lastTripRef.current = '';
          changed = true;
        }
        if (url.searchParams.has(SESSION_KEY)) {
          url.searchParams.delete(SESSION_KEY);
          lastSessionRef.current = '';
          changed = true;
        }
        if (changed) window.history.replaceState(null, '', url.toString());
        return;
      }

      let changed = false;

      const encodedTrip = encodeItinerary({
        origin,
        legs,
        status,
        createdAt,
        passengers,
        ...(picks.length > 0 ? { picks } : {}),
      });
      if (encodedTrip !== lastTripRef.current) {
        url.searchParams.set(TRIP_KEY, encodedTrip);
        lastTripRef.current = encodedTrip;
        changed = true;
      }

      // Persist transient picker state (the flight the user just tapped, the
      // date they were searching). StayDurationScreen depends on selectedFlight
      // and bounces to /flights if it's missing — without this, reloading
      // /stay drops the user back to a fresh flight search.
      if (selectedFlight || selectedDate) {
        const encodedSession = encodeSession({ selectedFlight, selectedDate });
        if (encodedSession !== lastSessionRef.current) {
          url.searchParams.set(SESSION_KEY, encodedSession);
          lastSessionRef.current = encodedSession;
          changed = true;
        }
      } else if (url.searchParams.has(SESSION_KEY)) {
        url.searchParams.delete(SESSION_KEY);
        lastSessionRef.current = '';
        changed = true;
      }

      if (changed) window.history.replaceState(null, '', url.toString());
    };

    if (timerRef.current) clearTimeout(timerRef.current);

    // On pathname change (e.g. clicking an origin on Home navigates to
    // /flights), write synchronously. Otherwise a user who reloads inside
    // the 150ms debounce window lands on /flights with no ?t=, hydrates an
    // empty store, and RequireOrigin bounces them back to /. The debounce
    // is only there to batch rapid same-page state edits.
    //
    // Also reset the encoded refs: react-router's navigate('/foo') wipes
    // the search string, so the new URL has no ?t= or ?s= even though our
    // refs still think we wrote them last cycle. Without resetting, the
    // equality check below would skip re-writing the trip param whenever
    // the trip state didn't change across the navigation (e.g. /flights →
    // /stay, where only selectedFlight changed), and the user would land
    // on /stay?s=... with no ?t=, fail hydration, and bounce home.
    if (location.pathname !== lastPathRef.current) {
      lastPathRef.current = location.pathname;
      lastTripRef.current = '';
      lastSessionRef.current = '';
      writeUrl();
      return;
    }

    timerRef.current = setTimeout(writeUrl, DEBOUNCE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [
    origin, legs, status, createdAt, passengers, picks,
    selectedFlight, selectedDate,
    location.pathname,
  ]);
}
