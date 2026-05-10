import { useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
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

// Flight results and return flights use a fixed-height two-panel layout;
// all other screens are natural document flow.
const FIXED_HEIGHT_PATHS = new Set(['/flights', '/return']);

export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();
  useUrlSync();

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
