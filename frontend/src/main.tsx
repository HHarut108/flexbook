import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import { useTripStore } from './store/trip.store';
import { useSessionStore } from './store/session.store';
import { decodeItinerary, decodeSession } from './utils/url.utils';
import { initAnalytics, track, AnalyticsEvent } from './lib/analytics';
import './store/theme.store';
import './index.css';
import { prefetchAirportIndex } from './lib/airportIndex';

function boot() {
  // Start loading the airport index immediately so it's warm before the user types.
  prefetchAirportIndex();

  // Boot analytics before render so the first pageview is captured.
  initAnalytics();

  // Hydrate trip + session state from ?t= and ?s= before React renders so
  // that RequireOrigin sees the correct store state when the user refreshes
  // on an inner route. ?s= carries the in-progress picker state
  // (selectedFlight, selectedDate) that StayDurationScreen relies on.
  const params = new URLSearchParams(window.location.search);
  const encodedTrip = params.get('t');
  const encodedSession = params.get('s');
  const pathname = window.location.pathname;

  let hydratedTrip = false;
  if (encodedTrip) {
    const itinerary = decodeItinerary(encodedTrip);
    if (itinerary?.origin) {
      useTripStore.getState().loadFromItinerary(itinerary);
      hydratedTrip = true;
    }
  }

  if (encodedSession) {
    const session = decodeSession(encodedSession);
    if (session) {
      const store = useSessionStore.getState();
      if (session.selectedFlight) store.setSelectedFlight(session.selectedFlight);
      if (session.selectedDate) store.setSelectedDate(session.selectedDate);
    }
  }

  // If the user lands on a deep route without recoverable trip state, log it
  // so we can see how often this actually happens in production. Helps us
  // distinguish "URL was truncated by a proxy" from "user typed the URL"
  // from "we lost it ourselves".
  if (pathname !== '/' && !hydratedTrip) {
    track(AnalyticsEvent.UrlStateRecoveryFailed, {
      pathname,
      hasTripParam: !!encodedTrip,
      hasSessionParam: !!encodedSession,
      tripParamLength: encodedTrip?.length ?? 0,
    });
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
