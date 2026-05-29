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

function boot() {
  // Start loading the airport index immediately so it's warm before the user types.
  prefetchAirportIndex();

  // Boot analytics before render so the first pageview is captured.
  initAnalytics();

  // Hydrate trip state from ?t= before React renders so that RequireOrigin
  // sees the correct store state when the user refreshes on an inner route.
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get('t');
  if (encoded) {
    try {
      const itinerary = decodeItinerary(encoded);
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
}

// Canonical-host guard. The app must run same-origin with its /api proxy
// (production sends session cookies same-origin — no VITE_API_URL). The apex
// flexbook.space is canonical; www redirects to it. A service-worker-cached
// client stuck on www serves its cached shell and never sees that redirect, so its
// same-origin /api calls hit a cross-origin redirect the browser refuses to
// follow for credentialed requests — surfacing as "couldn't reach the flights
// service". Eject such clients to the apex before any /api call fires.
const CANONICAL_HOST = 'flexbook.space';
if (window.location.hostname === `www.${CANONICAL_HOST}`) {
  const { pathname, search, hash } = window.location;
  window.location.replace(`https://${CANONICAL_HOST}${pathname}${search}${hash}`);
} else {
  boot();
}
