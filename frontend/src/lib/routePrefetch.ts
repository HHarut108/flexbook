/**
 * Intent-based route prefetching.
 *
 * Pair with the lazy() screens in App.tsx — when a user hovers/focuses a
 * link or button that leads to a route, we kick off the dynamic import()
 * for that screen's chunk so the JS is parsed and ready by the time the
 * click lands. This is the Facebook/Linear/Vercel trick that makes
 * code-split apps still feel instant.
 *
 * Safety:
 *  - Each loader resolves to a no-op promise; we don't touch the result.
 *  - Repeated calls reuse the same in-flight promise (browser de-dupes
 *    the underlying module fetch anyway, but tracking it here also
 *    short-circuits redundant network checks).
 *  - Falls back to a no-op if the path isn't in our registry — adding a
 *    new lazy screen here is opt-in, not mandatory.
 */

type Loader = () => Promise<unknown>;

/**
 * Map of route prefixes → screen-module loaders. Keep these factories
 * identical to the ones in App.tsx so Rollup de-duplicates and a single
 * chunk satisfies both the eventual render and the prefetch.
 *
 * Match is by `startsWith` so dynamic paths like `/trip/:id` work via
 * `/trip/`. Order matters for overlapping prefixes — longest first.
 */
const ROUTE_LOADERS: Array<[prefix: string, loader: Loader]> = [
  ['/hop-planner',      () => import('../screens/HopPlannerScreen')],
  ['/trip-planner',     () => import('../screens/TripPlannerScreen')],
  ['/quick-search',     () => import('../screens/QuickSearchScreenV2')],
  ['/search',           () => import('../screens/SearchResultsScreen')],
  ['/flights',          () => import('../screens/FlightResultsScreen')],
  ['/return',           () => import('../screens/ReturnFlightsScreen')],
  ['/itinerary',        () => import('../screens/ItineraryScreen')],
  ['/review',           () => import('../screens/DecisionScreen')],
  ['/book/concierge',   () => import('../screens/BookingConciergeScreen')],
  ['/book',             () => import('../screens/BookingReviewScreen')],
  ['/plan',             () => import('../screens/PlanStayScreen')],
  ['/stay',             () => import('../screens/StayDurationScreen')],
  ['/date',             () => import('../screens/DatePickerScreen')],
  ['/trip/',            () => import('../screens/TripDetailsScreen')],
  ['/signup',           () => import('../screens/SignUpScreen')],
  ['/login',            () => import('../screens/LoginScreen')],
  ['/verify-email',     () => import('../screens/VerifyOtpScreen')],
  ['/account',          () => import('../screens/AccountScreen')],
  ['/about',            () => import('../screens/AboutScreen')],
  ['/when-to-go',       () => import('../screens/WhenToGoScreen')],
  ['/tools',            () => import('../screens/ToolsScreen')],
  ['/trips',            () => import('../screens/ComingSoonScreen')],
  ['/deals',            () => import('../screens/ComingSoonScreen')],
];

const inFlight = new Map<string, Promise<unknown>>();

/**
 * Begin loading the chunk for the screen behind `path`. Cheap to call
 * repeatedly — subsequent calls hit the in-flight cache and never re-issue
 * the import.
 */
export function prefetchRoute(path: string): void {
  if (typeof path !== 'string' || !path.startsWith('/')) return;
  for (const [prefix, loader] of ROUTE_LOADERS) {
    if (path === prefix || path.startsWith(prefix + '/') || (prefix.endsWith('/') && path.startsWith(prefix))) {
      if (!inFlight.has(prefix)) {
        try {
          inFlight.set(prefix, loader().catch(() => { /* ignore */ }));
        } catch {
          /* import() rejected synchronously — ignore */
        }
      }
      return;
    }
  }
}

/**
 * Convenience set of DOM handlers to drop on a link/button so the chunk
 * starts loading the moment the user signals intent (hover on desktop,
 * touchstart on mobile, focus on keyboard nav).
 *
 *     <Link to="/flights" {...intentPrefetch('/flights')}>Flights</Link>
 */
export function intentPrefetch(path: string) {
  const start = () => prefetchRoute(path);
  return {
    onMouseEnter: start,
    onFocus: start,
    onTouchStart: start,
  } as const;
}
