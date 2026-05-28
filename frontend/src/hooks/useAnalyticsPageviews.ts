import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { capturePageview } from '../lib/analytics';

/**
 * Captures a PostHog $pageview on every route change (and on initial mount),
 * since this is a client-side SPA where the browser never reloads.
 */
export function useAnalyticsPageviews(): void {
  const { pathname } = useLocation();
  useEffect(() => {
    capturePageview();
  }, [pathname]);
}
