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
import { HomeScreen } from './screens/HomeScreen';
import { FlightResultsScreen } from './screens/FlightResultsScreen';
import { StayDurationScreen } from './screens/StayDurationScreen';
import { DecisionScreen } from './screens/DecisionScreen';
import { ReturnFlightsScreen } from './screens/ReturnFlightsScreen';
import { ItineraryScreen } from './screens/ItineraryScreen';
import { BookingReviewScreen } from './screens/BookingReviewScreen';
import { PlanStayScreen } from './screens/PlanStayScreen';
import { DatePickerScreen } from './screens/DatePickerScreen';
import { SignUpScreen } from './screens/SignUpScreen';
import { VerifyOtpScreen } from './screens/VerifyOtpScreen';
import { LoginScreen } from './screens/LoginScreen';
import { AccountScreen } from './screens/AccountScreen';
import { ComingSoonScreen } from './screens/ComingSoonScreen';
import { AboutScreen } from './screens/AboutScreen';
import { ToolsScreen } from './screens/ToolsScreen';
import { TripPlannerScreen } from './screens/TripPlannerScreen';
import { WhenToGoScreen } from './screens/WhenToGoScreen';
import { RequireAuth } from './components/RequireAuth';
import { authApi } from './api/auth.api';
import { useAuthStore } from './store/auth.store';
import { hasSessionHint, clearSessionHint } from './utils/sessionHint';

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

  const rootClass = FIXED_HEIGHT_PATHS.has(pathname)
    ? 'h-screen bg-bg max-w-[448px] md:max-w-none mx-auto flex flex-col overflow-hidden'
    : 'min-h-screen bg-bg max-w-[448px] md:max-w-none mx-auto';

  return (
    <div className={rootClass}>
      <ProgressBar onMenuOpen={() => setDrawerOpen(true)} />
      <Toast />
      <ShareModal />
      <ExpiredLinkModal />
      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <Routes>
        <Route path="/" element={<HomeScreen onMenuOpen={() => setDrawerOpen(true)} />} />
        <Route path="/share/:slug" element={<ShareRedirect />} />
        <Route path="/signup" element={<SignUpScreen />} />
        <Route path="/verify-email" element={<VerifyOtpScreen />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/account" element={<AccountScreen />} />
        <Route path="/trips" element={<ComingSoonScreen title="Trips" description="A dedicated space to manage all your past and upcoming trips in one place. Track where you've been, pick up where you left off, and share your journeys — coming soon." onMenuOpen={() => setDrawerOpen(true)} />} />
        <Route path="/deals" element={<ComingSoonScreen title="Deals" description="Curated flight deals, fare alerts, and hand-picked routes at jaw-dropping prices. We're building the smartest deals engine for multi-stop travellers — stay tuned." onMenuOpen={() => setDrawerOpen(true)} />} />
        <Route path="/tools" element={<ToolsScreen onMenuOpen={() => setDrawerOpen(true)} />} />
        <Route path="/when-to-go" element={<WhenToGoScreen />} />
        <Route path="/about" element={<AboutScreen onMenuOpen={() => setDrawerOpen(true)} />} />

        <Route element={<RequireAuth />}>
          <Route path="/trip-planner" element={<TripPlannerScreen />} />
        </Route>

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
