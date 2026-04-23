import { useState } from 'react';
import { useSessionStore } from './store/session.store';
import { useUrlSync } from './hooks/useUrlSync';
import { ProgressBar } from './components/ProgressBar';
import { Toast } from './components/Toast';
import { AppDrawer } from './components/AppDrawer';
import { ShareModal } from './components/ShareModal';
import { ExpiredLinkModal } from './components/ExpiredLinkModal';
import { HomeScreen } from './screens/HomeScreen';
import { FlightResultsScreen } from './screens/FlightResultsScreen';
import { StayDurationScreen } from './screens/StayDurationScreen';
import { DecisionScreen } from './screens/DecisionScreen';
import { ReturnFlightsScreen } from './screens/ReturnFlightsScreen';
import { ItineraryScreen } from './screens/ItineraryScreen';
import { BookingReviewScreen } from './screens/BookingReviewScreen';

export default function App() {
  const screen = useSessionStore((s) => s.screen);
  const [drawerOpen, setDrawerOpen] = useState(false);
  useUrlSync();

  const appClassName =
    screen === 'flight-results'
      ? 'h-screen bg-bg max-w-[448px] mx-auto flex flex-col overflow-hidden'
      : 'min-h-screen bg-bg max-w-[448px] mx-auto';

  return (
    <div className={appClassName}>
      <ProgressBar onMenuOpen={() => setDrawerOpen(true)} />
      <Toast />
      <ShareModal />
      <ExpiredLinkModal />
      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      {screen === 'home' && <HomeScreen onMenuOpen={() => setDrawerOpen(true)} />}
      {screen === 'flight-results' && <FlightResultsScreen />}
      {screen === 'stay-duration' && <StayDurationScreen />}
      {screen === 'decision' && <DecisionScreen />}
      {screen === 'return-flights' && <ReturnFlightsScreen />}
      {screen === 'itinerary' && <ItineraryScreen />}
      {screen === 'booking-review' && <BookingReviewScreen onMenuOpen={() => setDrawerOpen(true)} />}
      {screen === 'partial-booking' && <BookingReviewScreen partial onMenuOpen={() => setDrawerOpen(true)} />}
    </div>
  );
}
