import { Suspense, useState, useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useUrlSync } from './hooks/useUrlSync';
import { useAnalyticsPageviews } from './hooks/useAnalyticsPageviews';
import { ProgressBar } from './components/ProgressBar';
import { Toast } from './components/Toast';
import { AppDrawer } from './components/AppDrawer';
import { ShareModal } from './components/ShareModal';
import { ExpiredLinkModal } from './components/ExpiredLinkModal';
import { RequireOrigin } from './components/RequireOrigin';
import { ShareRedirect } from './components/ShareRedirect';
import { V2DevToggle } from './components/V2DevToggle';
// Home stays eager — it's the most common landing page and skipping the
// Suspense round-trip on first paint saves ~30-50 ms of jank. Every other
// screen is code-split via lazyNamed() so the initial bundle ships with only
// the chrome + the route the user actually lands on.
import { HomeScreen } from './screens/HomeScreen';
import { HomeScreenV2 } from './screens/HomeScreenV2';
import { lazyNamed } from './lib/lazyNamed';
import { authApi } from './api/auth.api';
import { useAuthStore } from './store/auth.store';
import { hasSessionHint, clearSessionHint } from './utils/sessionHint';
import { useV2 } from './lib/layoutFlag';
import { prefetchVisaCountries } from './hooks/useVisaCountries';
import { apiClient } from './api/client';

const ME_TIMEOUT_MS = 3000;

// Flight results and return flights use a fixed-height two-panel layout;
// all other screens are natural document flow.
const FIXED_HEIGHT_PATHS = new Set(['/flights', '/return']);

// ── Lazy screens ────────────────────────────────────────────────────────────
// Each entry maps to its own Rollup chunk. Naming them via the magic
// `webpackChunkName`-equivalent comment isn't needed under Vite/Rollup —
// chunk names default to the file name, which is what we want.
const HopPlannerScreen      = lazyNamed(() => import('./screens/HopPlannerScreen'),      'HopPlannerScreen');
const HopPlannerScreenV2    = lazyNamed(() => import('./screens/HopPlannerScreenV2'),    'HopPlannerScreenV2');
const TripPlannerScreen     = lazyNamed(() => import('./screens/TripPlannerScreen'),     'TripPlannerScreen');
const TripPlannerScreenV2   = lazyNamed(() => import('./screens/TripPlannerScreenV2'),   'TripPlannerScreenV2');
const WhenToGoScreen        = lazyNamed(() => import('./screens/WhenToGoScreen'),        'WhenToGoScreen');
const WhenToGoScreenV2      = lazyNamed(() => import('./screens/WhenToGoScreenV2'),      'WhenToGoScreenV2');
const SearchResultsScreen   = lazyNamed(() => import('./screens/SearchResultsScreen'),   'SearchResultsScreen');
const QuickSearchScreenV2   = lazyNamed(() => import('./screens/QuickSearchScreenV2'),   'QuickSearchScreenV2');
const FlightResultsScreen   = lazyNamed(() => import('./screens/FlightResultsScreen'),   'FlightResultsScreen');
const StayDurationScreen    = lazyNamed(() => import('./screens/StayDurationScreen'),    'StayDurationScreen');
const DecisionScreen        = lazyNamed(() => import('./screens/DecisionScreen'),        'DecisionScreen');
const ReturnFlightsScreen   = lazyNamed(() => import('./screens/ReturnFlightsScreen'),   'ReturnFlightsScreen');
const ItineraryScreen       = lazyNamed(() => import('./screens/ItineraryScreen'),       'ItineraryScreen');
const BookingReviewScreen   = lazyNamed(() => import('./screens/BookingReviewScreen'),   'BookingReviewScreen');
const TripDetailsScreen     = lazyNamed(() => import('./screens/TripDetailsScreen'),     'TripDetailsScreen');
const BookingConciergeScreen= lazyNamed(() => import('./screens/BookingConciergeScreen'),'BookingConciergeScreen');
const PlanStayScreen        = lazyNamed(() => import('./screens/PlanStayScreen'),        'PlanStayScreen');
const DatePickerScreen      = lazyNamed(() => import('./screens/DatePickerScreen'),      'DatePickerScreen');
const SignUpScreen          = lazyNamed(() => import('./screens/SignUpScreen'),          'SignUpScreen');
const VerifyOtpScreen       = lazyNamed(() => import('./screens/VerifyOtpScreen'),       'VerifyOtpScreen');
const LoginScreen           = lazyNamed(() => import('./screens/LoginScreen'),           'LoginScreen');
const AccountScreen         = lazyNamed(() => import('./screens/AccountScreen'),         'AccountScreen');
const ComingSoonScreen      = lazyNamed(() => import('./screens/ComingSoonScreen'),      'ComingSoonScreen');
const AboutScreen           = lazyNamed(() => import('./screens/AboutScreen'),           'AboutScreen');
const HowItWorksScreenV2    = lazyNamed(() => import('./screens/HowItWorksScreenV2'),    'HowItWorksScreenV2');
const ToolsScreen           = lazyNamed(() => import('./screens/ToolsScreen'),           'ToolsScreen');

// Suspense fallback: keep the chrome (ProgressBar/Toast) on screen and leave
// the route slot empty. A spinner would flicker on every navigation because
// most chunks resolve under 100 ms once cached. Empty state = no jank.
const RouteFallback = () => null;

export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();
  const { setUser, setLoading } = useAuthStore();
  useUrlSync();
  useAnalyticsPageviews();
  const v2 = useV2();
  const openDrawer = () => setDrawerOpen(true);

  useEffect(() => {
    // Warm the visa-service + country list as early as possible so the
    // requirement pills on Flight Results land instantly instead of after
    // a Render free-tier cold start. Idempotent — safe to call on every mount.
    prefetchVisaCountries();
    // Cheap ping to wake the backend dyno before the user kicks off a
    // search. Fire-and-forget; cold starts on Render free tier are ~5-15s
    // so paying that cost in the background saves it from the first search.
    apiClient.get('/health').catch(() => { /* ignore */ });
  }, []);

  // Reset scroll on route change. Without this, react-router preserves the
  // previous scroll offset — so navigating from a long page (home footer) to
  // a tool page lands the user mid-form. Skip on /flights and /return which
  // own their own scroll containers.
  useEffect(() => {
    if (FIXED_HEIGHT_PATHS.has(pathname)) return;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);

  useEffect(() => {
    // First-time visitors have no session hint → skip /me entirely so the UI
    // never waits on a cold backend just to discover they're logged out.
    if (!hasSessionHint()) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), ME_TIMEOUT_MS);

    authApi.getMe(controller.signal)
      .then(({ user }) => setUser(user))
      .catch((err: Error & { status?: number }) => {
        if (err.status === 401) clearSessionHint();
        setLoading(false);
      })
      .finally(() => window.clearTimeout(timeoutId));

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [setUser, setLoading]);

  // V2 marketing/tool pages are properly responsive — drop the legacy 448px
  // mobile cap so layouts breathe naturally between 449px and the md
  // breakpoint (768px). V1 keeps its narrow-column flow because the booking
  // funnel was tuned for that width.
  const widthCap = v2 ? '' : 'max-w-[448px] md:max-w-none mx-auto';
  const rootClass = FIXED_HEIGHT_PATHS.has(pathname)
    ? `h-screen bg-bg ${widthCap} flex flex-col overflow-hidden`
    : `min-h-screen bg-bg ${widthCap}`;

  return (
    <div className={rootClass}>
      <ProgressBar onMenuOpen={() => setDrawerOpen(true)} />
      <Toast />
      <ShareModal />
      <ExpiredLinkModal />
      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <V2DevToggle />

      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route
            path="/"
            element={
              v2 ? <HomeScreenV2 onMenuOpen={openDrawer} /> : <HomeScreen onMenuOpen={openDrawer} />
            }
          />
          <Route
            path="/hop-planner"
            element={
              v2 ? <HopPlannerScreenV2 onMenuOpen={openDrawer} /> : <HopPlannerScreen onMenuOpen={openDrawer} />
            }
          />
          <Route path="/search" element={<SearchResultsScreen onMenuOpen={() => setDrawerOpen(true)} />} />
          <Route path="/trip/:id" element={<TripDetailsScreen onMenuOpen={() => setDrawerOpen(true)} />} />
          <Route path="/book/concierge/:tripId" element={<BookingConciergeScreen onMenuOpen={() => setDrawerOpen(true)} />} />
          {v2 && <Route path="/quick-search" element={<QuickSearchScreenV2 onMenuOpen={openDrawer} />} />}
          <Route path="/share/:slug" element={<ShareRedirect />} />
          <Route path="/signup" element={<SignUpScreen />} />
          <Route path="/verify-email" element={<VerifyOtpScreen />} />
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/account" element={<AccountScreen />} />
          <Route path="/trips" element={<ComingSoonScreen title="Trips" description="A dedicated space to manage all your past and upcoming trips in one place. Track where you've been, pick up where you left off, and share your journeys — coming soon." onMenuOpen={() => setDrawerOpen(true)} />} />
          <Route path="/deals" element={<ComingSoonScreen title="Deals" description="Curated flight deals, fare alerts, and hand-picked routes at jaw-dropping prices. We're building the smartest deals engine for multi-stop travellers — stay tuned." onMenuOpen={() => setDrawerOpen(true)} />} />
          <Route path="/tools" element={<ToolsScreen onMenuOpen={() => setDrawerOpen(true)} />} />
          <Route path="/when-to-go" element={v2 ? <WhenToGoScreenV2 onMenuOpen={openDrawer} /> : <WhenToGoScreen />} />
          <Route
            path="/about"
            element={
              v2 ? <HowItWorksScreenV2 onMenuOpen={openDrawer} /> : <AboutScreen onMenuOpen={openDrawer} />
            }
          />

          <Route
            path="/trip-planner"
            element={v2 ? <TripPlannerScreenV2 onMenuOpen={openDrawer} /> : <TripPlannerScreen />}
          />

          {/* Legacy paths that pre-date the /hop-planner and /trip-planner rename.
              Vercel rewrites send all unknown paths to the SPA, so without these
              fallbacks the router would render an empty shell. Redirects in
              vercel.json catch most real-world hits at the edge with a 301; this
              keeps local dev and any non-Vercel host correct too. */}
          <Route path="/trip-builder" element={<Navigate to="/hop-planner" replace />} />
          <Route path="/budget-planner" element={<Navigate to="/trip-planner" replace />} />

          <Route element={<RequireOrigin />}>
            <Route path="/date"         element={<DatePickerScreen />} />
            <Route path="/flights"      element={<FlightResultsScreen />} />
            <Route path="/stay"         element={<StayDurationScreen />} />
            <Route path="/review"       element={<DecisionScreen />} />
            <Route path="/return"       element={<ReturnFlightsScreen />} />
            <Route path="/itinerary"    element={<ItineraryScreen />} />
            <Route path="/book"         element={<BookingReviewScreen onMenuOpen={() => setDrawerOpen(true)} />} />
            <Route path="/book/partial" element={<BookingReviewScreen partial onMenuOpen={() => setDrawerOpen(true)} />} />
            <Route path="/plan"         element={<PlanStayScreen />} />
          </Route>
        </Routes>
      </Suspense>
    </div>
  );
}
