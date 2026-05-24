import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTripStore } from '../store/trip.store';
import { encodeItinerary } from '../utils/url.utils';

const PARAM_KEY = 't';
const DEBOUNCE_MS = 150;

export function useUrlSync() {
  const location = useLocation();
  const origin     = useTripStore((s) => s.origin);
  const legs       = useTripStore((s) => s.legs);
  const status     = useTripStore((s) => s.status);
  const createdAt  = useTripStore((s) => s.createdAt);
  const passengers = useTripStore((s) => s.passengers);

  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const lastEncodedRef = useRef('');

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      if (!origin || location.pathname === '/') {
        const url = new URL(window.location.href);
        if (url.searchParams.has(PARAM_KEY)) {
          url.searchParams.delete(PARAM_KEY);
          window.history.replaceState(null, '', url.toString());
          lastEncodedRef.current = '';
        }
        return;
      }

      const encoded = encodeItinerary({ origin, legs, status, createdAt, passengers });
      if (encoded === lastEncodedRef.current) return;
      lastEncodedRef.current = encoded;

      const url = new URL(window.location.href);
      url.searchParams.set(PARAM_KEY, encoded);
      window.history.replaceState(null, '', url.toString());
    }, DEBOUNCE_MS);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [origin, legs, status, createdAt, passengers, location.pathname]);
}
