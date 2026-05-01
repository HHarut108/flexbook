import { useEffect, useRef } from 'react';
import { useTripStore } from '../store/trip.store';
import { useSessionStore } from '../store/session.store';
import { encodeItinerary, decodeItinerary, screenToPath, pathToScreen } from '../utils/url.utils';
import { fetchTripShare } from '../api/trips.api';

const PARAM_KEY = 't';

/**
 * Bidirectional URL sync for active trip state.
 *
 * Paths:  each Screen maps to a real URL path (/, /flights, /stay, /review, etc.)
 * Data:   active trip state is compressed into ?t= for session continuity (refresh recovery)
 * Share:  /share/:slug paths are resolved via the trips API on mount
 */
export function useUrlSync() {
  const legs = useTripStore((s) => s.legs);
  const origin = useTripStore((s) => s.origin);
  const status = useTripStore((s) => s.status);
  const createdAt = useTripStore((s) => s.createdAt);
  const passengers = useTripStore((s) => s.passengers);
  const loadFromItinerary = useTripStore((s) => s.loadFromItinerary);
  const screen = useSessionStore((s) => s.screen);
  const setScreen = useSessionStore((s) => s.setScreen);
  const showExpiredLinkModal = useSessionStore((s) => s.showExpiredLinkModal);

  // Prevents pushState loop when a screen change came from popstate
  const fromPopstate = useRef(false);
  // Prevents pushing on the very first render (path is already correct on mount)
  const mounted = useRef(false);

  // ── Mount: restore from URL ──────────────────────────────────────────────
  useEffect(() => {
    const { pathname, search } = window.location;
    const params = new URLSearchParams(search);

    // /share/:slug  →  fetch full itinerary from server
    if (pathname.startsWith('/share/')) {
      const slug = pathname.slice('/share/'.length);
      fetchTripShare(slug).then((itinerary) => {
        if (!itinerary) {
          showExpiredLinkModal();
          window.history.replaceState(null, '', '/');
          return;
        }
        loadFromItinerary(itinerary);
        const target = itinerary.status === 'complete'
          ? 'itinerary'
          : itinerary.legs.length > 0
            ? 'decision'
            : 'flight-results';
        fromPopstate.current = true;
        setScreen(target);
        window.history.replaceState(null, '', screenToPath(target));
      });
      mounted.current = true;
      return;
    }

    // Legacy ?trip=<id>  →  fetch from server (backward compat)
    const tripId = params.get('trip');
    if (tripId) {
      const url = new URL(window.location.href);
      url.searchParams.delete('trip');
      window.history.replaceState(null, '', url.toString());

      fetchTripShare(tripId).then((itinerary) => {
        if (!itinerary) {
          showExpiredLinkModal();
          return;
        }
        loadFromItinerary(itinerary);
        const target = itinerary.status === 'complete'
          ? 'itinerary'
          : itinerary.legs.length > 0
            ? 'decision'
            : 'flight-results';
        fromPopstate.current = true;
        setScreen(target);
        window.history.replaceState(null, '', screenToPath(target) + url.search);
      });
      mounted.current = true;
      return;
    }

    // ?t=<encoded>  →  decode inline trip data, use path for screen
    const encoded = params.get(PARAM_KEY);
    if (encoded) {
      const itinerary = decodeItinerary(encoded);
      if (itinerary?.origin) {
        loadFromItinerary(itinerary);
        const pathScreen = pathToScreen(pathname);
        const target = pathScreen ?? (
          itinerary.status === 'complete'
            ? 'itinerary'
            : itinerary.legs.length > 0
              ? 'decision'
              : 'flight-results'
        );
        fromPopstate.current = true;
        setScreen(target);
      }
      mounted.current = true;
      return;
    }

    // Plain path navigation (no trip data) — restore screen from path
    const pathScreen = pathToScreen(pathname);
    if (pathScreen && pathScreen !== 'home') {
      fromPopstate.current = true;
      setScreen(pathScreen);
    }

    mounted.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Screen changes → pushState ───────────────────────────────────────────
  useEffect(() => {
    if (!mounted.current) return;
    if (fromPopstate.current) {
      fromPopstate.current = false;
      return;
    }
    const newPath = screenToPath(screen);
    if (newPath !== window.location.pathname) {
      // Preserve existing ?t= query when pushing new path
      window.history.pushState(null, '', newPath + window.location.search);
    }
  }, [screen]);

  // ── Popstate (browser back/forward) → setScreen ─────────────────────────
  useEffect(() => {
    function handlePopstate() {
      const pathScreen = pathToScreen(window.location.pathname);
      if (pathScreen) {
        fromPopstate.current = true;
        setScreen(pathScreen);
      }
    }
    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Trip data changes → replaceState ?t= ────────────────────────────────
  useEffect(() => {
    if (!origin || screen === 'home') {
      const url = new URL(window.location.href);
      if (url.searchParams.has(PARAM_KEY)) {
        url.searchParams.delete(PARAM_KEY);
        window.history.replaceState(null, '', url.toString());
      }
      return;
    }

    const itinerary = { origin, legs, status, createdAt, passengers };
    const encoded = encodeItinerary(itinerary);
    const url = new URL(window.location.href);
    url.searchParams.set(PARAM_KEY, encoded);
    window.history.replaceState(null, '', url.toString());
  }, [origin, legs, status, createdAt, passengers, screen]);
}
