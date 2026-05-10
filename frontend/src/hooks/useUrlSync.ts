import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTripStore } from '../store/trip.store';
import { encodeItinerary } from '../utils/url.utils';

const PARAM_KEY = 't';

/**
 * Keeps ?t= in sync with active trip state.
 *
 * Initial hydration from ?t= (on refresh or direct link) happens in main.tsx
 * before React renders, so RequireOrigin sees the correct store state.
 *
 * Share slug resolution (/share/:slug) is handled by ShareRedirect.
 * Browser history is managed by React Router.
 */
export function useUrlSync() {
  const location = useLocation();
  const origin     = useTripStore((s) => s.origin);
  const legs       = useTripStore((s) => s.legs);
  const status     = useTripStore((s) => s.status);
  const createdAt  = useTripStore((s) => s.createdAt);
  const passengers = useTripStore((s) => s.passengers);

  useEffect(() => {
    if (!origin || location.pathname === '/') {
      const url = new URL(window.location.href);
      if (url.searchParams.has(PARAM_KEY)) {
        url.searchParams.delete(PARAM_KEY);
        window.history.replaceState(null, '', url.toString());
      }
      return;
    }

    const encoded = encodeItinerary({ origin, legs, status, createdAt, passengers });
    const url = new URL(window.location.href);
    url.searchParams.set(PARAM_KEY, encoded);
    window.history.replaceState(null, '', url.toString());
  }, [origin, legs, status, createdAt, passengers, location.pathname]);
}
