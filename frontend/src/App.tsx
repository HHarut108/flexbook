import { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
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
import { HomeScreen } from './screens/HomeScreen';
import { HomeScreenV2 } from './screens/HomeScreenV2';
import { HopPlannerScreen } from './screens/HopPlannerScreen';
import { HopPlannerScreenV2 } from './screens/HopPlannerScreenV2';
import { TripPlannerScreenV2 } from './screens/TripPlannerScreenV2';
import { WhenToGoScreenV2 } from './screens/WhenToGoScreenV2';
import { SearchResultsScreen } from './screens/SearchResultsScreen';
import { QuickSearchScreenV2 } from './screens/QuickSearchScreenV2';
import { FlightResultsScreen } from './screens/FlightResultsScreen';
import { StayDurationScreen } from './screens/StayDurationScreen';
import { DecisionScreen } from './screens/DecisionScreen';
import { ReturnFlightsScreen } from './screens/ReturnFlightsScreen';
import { ItineraryScreen } from './screens/ItineraryScreen';
import { BookingReviewScreen } from './screens/BookingReviewScreen';
import { TripDetailsScreen } from './screens/TripDetailsScreen';
import { BookingConciergeScreen } from './screens/BookingConciergeScreen';
import { PlanStayScreen } from './screens/PlanStayScreen';
import { DatePickerScreen } from './screens/DatePickerScreen';
import { SignUpScreen } from './screens/SignUpScreen';
import { VerifyOtpScreen } from './screens/VerifyOtpScreen';
import { LoginScreen } from './screens/LoginScreen';
import { AccountScreen } from './screens/AccountScreen';
import { ComingSoonScreen } from './screens/ComingSoonScreen';
import { AboutScreen } from './screens/AboutScreen';
import { HowItWorksScreenV2 } from './screens/HowItWorksScreenV2';
import { ToolsScreen } from './screens/ToolsScreen';
import { TripPlannerScreen } from './screens/TripPlannerScreen';
import { WhenToGoScreen } from './screens/WhenToGoScreen';
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
    </div>
  );
}
