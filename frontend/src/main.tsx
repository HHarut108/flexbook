import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import { useTripStore } from './store/trip.store';
import { decodeItinerary } from './utils/url.utils';
import './store/theme.store';
import './index.css';
import { prefetchAirportIndex } from './lib/airportIndex';
import { initAnalytics } from './lib/analytics';

// Start loading the airport index immediately so it's warm before the user types.
prefetchAirportIndex();

// Boot analytics before render so the first pageview is captured.
initAnalytics();

// Hydrate trip state from ?t= before React renders so that RequireOrigin
// sees the correct store state when the user refreshes on an inner route.
const _params = new URLSearchParams(window.location.search);
const _encoded = _params.get('t');
if (_encoded) {
  try {
    const itinerary = decodeItinerary(_encoded);
    if (itinerary?.origin) {
      useTripStore.getState().loadFromItinerary(itinerary);
    }
  } catch {
    // malformed ?t= — ignore, user lands on home
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>,
);
