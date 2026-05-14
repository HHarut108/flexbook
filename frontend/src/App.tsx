import { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useUrlSync } from './hooks/useUrlSync';
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
import { authApi } from './api/auth.api';
import { useAuthStore } from './store/auth.store';

// Flight results and return flights use a fixed-height two-panel layout;
// all other screens are natural document flow.
const FIXED_HEIGHT_PATHS = new Set(['/flights', '/return']);

export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();
  const { setUser, setLoading, loading: authLoading } = useAuthStore();
  useUrlSync();

  useEffect(() => {
    authApi.getMe()
      .then(({ user }) => setUser(user))
      .catch(() => setLoading(false));
  }, []);

  const rootClass = FIXED_HEIGHT_PATHS.has(pathname)
    ? 'h-screen bg-bg max-w-[448px] md:max-w-none mx-auto flex flex-col overflow-hidden'
    : 'min-h-screen bg-bg max-w-[448px] md:max-w-none mx-auto';

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 size={32} className="text-indigo animate-spin" />
      </div>
    );
  }

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
