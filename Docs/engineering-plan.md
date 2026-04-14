# MVP Implementation Plan — Trip Planner

---

## Alignment Note

For the current MVP, [\_docs_product-definition.md](/Users/harut/Desktop/Fast-Travel-Assistant/Docs/_docs_product-definition.md) and [prd-alignment-decisions.md](/Users/harut/Desktop/Fast-Travel-Assistant/Docs/prd-alignment-decisions.md) should override older technical exploration in this plan.

Current guidance:

- Prioritize functionality, user flow, and product rules
- Treat URL-based trip state and share links as the MVP default
- Do not treat server-stored itinerary sessions as a required foundation for the first implementation pass
- Keep per-leg booking on the final itinerary; no separate "Book all flights" action in MVP
- Treat the current localhost behavior as a 7-screen flow ending in a booking review step
- Treat route-home search as currently showing the cheapest 3 options, not 10

---

## Conventions

- **[BE]** = backend task
- **[FE]** = frontend task
- **[SH]** = shared (types, contracts, config)
- **[EXT]** = requires external API / account
- Tasks marked 🔴 are on the critical path
- Tasks marked 🟡 can be parallelized or deferred
- Tasks marked 🟢 are low-risk, can be done anytime

---

## Phase 1: Project Setup & Foundation

### Goal
A running monorepo with both frontend and backend servers booting, shared types compiled, linting enforced, and a working health check end-to-end. No features — just infrastructure that will never need to be redone.

---

### Backend Tasks

| # | Task | Priority |
|---|---|---|
| BE-1 | Init Node.js + TypeScript + Fastify project | 🔴 |
| BE-2 | Configure `tsconfig.json`, path aliases (`@shared/*`) | 🔴 |
| BE-3 | Set up ESLint + Prettier, enforce on commit | 🟢 |
| BE-4 | Create `GET /health` endpoint returning `{ status: "ok", timestamp }` | 🔴 |
| BE-5 | Set up environment config with Zod (`config.ts`) — validate all env vars on boot | 🔴 |
| BE-6 | Set up structured logging with Pino | 🟢 |
| BE-7 | Create standard response envelope middleware (`{ success, data }` / `{ success, error }`) | 🔴 |
| BE-8 | Set up global error handler — catches unhandled errors, returns structured 500 | 🔴 |
| BE-9 | Set up rate limiting plugin (60 req/min on `/flights/*`, 120 on everything else) | 🟡 |
| BE-10 | Set up in-memory cache (`node-cache`) with helper wrapper | 🔴 |
| BE-11 | Load `airports.json` static dataset into memory on boot, validate it loads correctly | 🔴 |
| BE-12 | Set up Vitest + write one smoke test (health endpoint) | 🟡 |

---

### Frontend Tasks

| # | Task | Priority |
|---|---|---|
| FE-1 | Init React 18 + TypeScript + Vite project | 🔴 |
| FE-2 | Configure Tailwind CSS v3, custom theme tokens (colors, fonts from UX spec) | 🔴 |
| FE-3 | Configure path aliases (`@shared/*`, `@/`) in `vite.config.ts` and `tsconfig.json` | 🔴 |
| FE-4 | Set up React Router v6 with placeholder routes for all 7 screens | 🔴 |
| FE-5 | Install and configure Zustand — create empty `trip.store.ts` with correct shape | 🔴 |
| FE-6 | Install Axios, create `api/client.ts` with base URL from env, interceptors for envelope unwrap | 🔴 |
| FE-7 | Create `AppLayout` component — sticky progress bar slot + scrollable content + sticky CTA slot | 🔴 |
| FE-8 | Create global `Toast` component and hook (`useToast`) | 🟡 |
| FE-9 | Create `ErrorBoundary` wrapping the whole app | 🟡 |
| FE-10 | Verify FE can call BE `/health` and render response — proves API connectivity | 🔴 |
| FE-11 | Set up ESLint + Prettier matching BE config | 🟢 |

---

### Shared Tasks

| # | Task | Priority |
|---|---|---|
| SH-1 | Init `packages/shared` as npm workspace package | 🔴 |
| SH-2 | Write all TypeScript interfaces: `City`, `Airport`, `FlightOption`, `WeatherSummary`, `TripLeg`, `Itinerary`, `ItineraryStatus` | 🔴 |
| SH-3 | Write `FlightSearchParams`, `WeatherRequest`, `WeatherBatchResponse` | 🔴 |
| SH-4 | Configure monorepo root `package.json` with npm workspaces | 🔴 |
| SH-5 | Verify shared types importable from both BE and FE with zero errors | 🔴 |

---

### Dependencies
- Node.js 20 LTS installed
- npm workspaces supported (npm 7+)
- SerpAPI API key obtained [EXT] 🔴 (primary) — or Kiwi/Tequila as fallback [EXT] 🟡
- OpenWeatherMap API key obtained [EXT] 🟡
- Vercel account for FE deploy [EXT] 🟡
- Railway/Render account for BE deploy [EXT] 🟡

---

### Suggested Order of Work

```
1. SH-1, SH-4          monorepo structure first
2. BE-1, FE-1          both projects init in parallel
3. SH-2, SH-3          shared types (unblocks everything else)
4. SH-5                verify type imports work
5. BE-2 → BE-5 → BE-7 → BE-8   BE core config chain
6. BE-10, BE-11        cache + airport dataset
7. BE-4, BE-12         health check + smoke test
8. FE-2 → FE-3 → FE-4  FE config chain
9. FE-5, FE-6          Zustand + Axios
10. FE-7               AppLayout (unblocks all screen work)
11. FE-10              end-to-end connectivity proof
12. BE-3, BE-6, BE-9, FE-8, FE-9, FE-11   cleanup and polish
```

---

### What Can Be Mocked First
- Airport dataset: use a 10-row subset of `airports.json` during setup
- All screen content: placeholder `<div>Screen N</div>` components
- API responses: hardcoded JSON in route handlers during initial FE work

---

### Definition of Done
- [ ] `npm run dev` starts both BE and FE with zero errors
- [ ] Shared types compile from both BE and FE
- [ ] `GET /health` returns 200
- [ ] FE loads in browser, router renders 7 placeholder screens
- [ ] FE `api/client.ts` successfully calls BE `/health` and logs response
- [ ] Linting passes with zero warnings on both projects
- [ ] Airports dataset loads into memory on BE boot (log: *"Loaded 3,420 airports"*)

---

## Phase 2: Search & Flight Results

### Goal
A user can type a city, select an airport, pick a date, and see 10 real flight cards with prices. Weather loads asynchronously into those cards. Date switching works. This is the first moment the product feels real.

---

### Backend Tasks

| # | Task | Priority |
|---|---|---|
| BE-13 | Implement airport search: `GET /airports/search?q=` — fuzzy match against in-memory dataset | 🔴 |
| BE-14 | Implement nearby airports: `GET /airports/nearby?iata=` — Haversine distance calculation | 🟡 |
| BE-15 | Implement `SerpApiFlightProvider` — primary adapter using SerpAPI Google Flights; parallel queries for "fly anywhere" searches; enriches airport names via AirportService | 🔴 |
| BE-15b | Implement `KiwiFlightProvider` — fallback adapter for `api.tequila.kiwi.com` | 🟡 |
| BE-16 | Implement `FlightService`: cache check → provider call → normalize → deduplicate → sort → return 10 | 🔴 |
| BE-17 | Implement `GET /flights/search` route with Zod validation | 🔴 |
| BE-18 | Implement `normalizeProviderFlight()` — maps provider raw response to `FlightOption`, returns null on invalid | 🔴 |
| BE-19 | Implement provider timeout wrapper (8s) and structured error responses | 🔴 |
| BE-20 | Implement OpenWeatherMap adapter: `OpenWeatherMapProvider` | 🟡 |
| BE-21 | Implement `WeatherService`: batch fetch in parallel, cache per `(lat, lng, date)` 1hr | 🟡 |
| BE-22 | Implement `POST /weather/batch` route with Zod validation | 🟡 |
| BE-23 | Write unit tests: `normalizeProviderFlight` with valid/invalid/partial data | 🟡 |
| BE-24 | Write unit tests: `FlightService` dedup + sort logic with mock data | 🟡 |

---

### Frontend Tasks

| # | Task | Priority |
|---|---|---|
| FE-12 | Build `S1 HomeScreen` — search input, autofocus, keyboard handling | 🔴 |
| FE-13 | Build `AirportSuggestionList` — calls `GET /airports/search`, debounced 300ms, max 7 results | 🔴 |
| FE-14 | Build `NearbyAirportPills` — calls `GET /airports/nearby` after selection, horizontal scroll | 🟡 |
| FE-15 | Build inline date selection flow — arrows + calendar overlay, min/max date enforcement | 🔴 |
| FE-16 | Build `TripProgressBar` component — dot progress, stop count, breadcrumb | 🔴 |
| FE-17 | Build `S3 FlightResultsScreen` shell — header, date switcher area, card list area | 🔴 |
| FE-18 | Build `FlightCard` component — all fields, interaction states (default/hover/pressed/selected) | 🔴 |
| FE-19 | Build `SkeletonCard` component — shimmer animation, matches FlightCard dimensions | 🔴 |
| FE-20 | Build `DateSwitcher` component — prev/next arrows, date label, disabled states, debounce | 🔴 |
| FE-21 | Build calendar bottom sheet — opens on date label tap, same constraints | 🟡 |
| FE-22 | Wire `flights.api.ts` — `GET /flights/search` call, loading/error/success states | 🔴 |
| FE-23 | Wire `weather.api.ts` — `POST /weather/batch`, inject results into flight cards async | 🟡 |
| FE-24 | Build `WeatherWidget` component — icon + temp, loading pulse, silent fail | 🟡 |
| FE-25 | Wire Zustand store: `setOrigin`, `pendingDate` state after S1→S2→S3 flow | 🔴 |
| FE-26 | Build `useFlightSearch` hook — manages loading, error, results, triggers weather batch | 🔴 |
| FE-27 | Build empty state: no flights found + quick jump buttons | 🔴 |
| FE-28 | Build error state: flight search failed + retry button | 🔴 |

---

### Dependencies
- BE-11 (airports dataset) must be done
- SerpAPI key must be active [EXT] 🔴 (or Kiwi as fallback)
- Phase 1 complete

---

### Suggested Order of Work

```
// Backend first (unblocks FE with real data faster than mocks)
1. BE-13                airport search (pure, no external API)
2. BE-15 → BE-18       SerpAPI adapter + normalization
3. BE-16 → BE-17       FlightService + route
4. BE-19               timeout + error handling
5. BE-14               nearby airports (lower priority, pure)
6. BE-20 → BE-21 → BE-22   weather (can run parallel to FE work)

// Frontend (can start with mocks before BE is ready)
7. FE-16               TripProgressBar (used everywhere)
8. FE-12 → FE-13       S1 search + autocomplete
9. FE-15               S2 date picker
10. FE-18 → FE-19      FlightCard + Skeleton (mock data OK)
11. FE-17 → FE-20      S3 shell + date switcher
12. FE-22 → FE-26      wire real API + hook
13. FE-25              Zustand wiring S1→S2→S3
14. FE-23 → FE-24      weather async layer
15. FE-14, FE-21       nearby airports + bottom sheet calendar
16. FE-27, FE-28       empty + error states
```

---

### What Can Be Mocked First

```typescript
// Mock flight results for FE development (in /api/flights.route.ts)
const MOCK_FLIGHTS: FlightOption[] = [
  {
    flightId: "mock_001",
    originIata: "BCN", originCity: "Barcelona",
    destinationIata: "LIS", destinationCity: "Lisbon",
    destinationCountry: "Portugal",
    destinationLat: 38.7749, destinationLng: -9.1342,
    departureDatetime: "2025-05-10T06:00:00Z",
    arrivalDatetime: "2025-05-10T07:45:00Z",
    durationMinutes: 105,
    airlineName: "Ryanair", stops: 0,
    priceUsd: 34,
    bookingUrl: "https://www.google.com/flights#search;f=BCN;t=LIS;d=2025-05-10;tt=o"
  },
  // ... 9 more
]
```

- Use `MOCK_FLIGHTS` until `SerpApiFlightProvider` is wired
- Use `MOCK_AIRPORTS` (10 rows) until full dataset search is confirmed working
- Weather can be mocked as `null` on all cards initially

---

### Definition of Done
- [ ] User can type "Barcelona" and see BCN + other airports in dropdown
- [ ] User can select BCN, see nearby airports GRO and REU as pills
- [ ] User can pick a date and arrive at S3
- [ ] S3 shows 10 skeleton cards immediately, then real flight data
- [ ] Prices are real, from SerpAPI (or Kiwi fallback)
- [ ] Date switcher prev/next loads new results without page refresh
- [ ] Weather icons and temperatures appear on cards within 3 seconds
- [ ] If flight API fails, error state shows with retry button
- [ ] If no flights found, empty state shows with ±1 day quick buttons
- [ ] Progress bar shows *"Stop 1"*

---

## Phase 3: Itinerary & Trip Chaining

### Goal
The full trip-building loop works end-to-end: select a flight → set stay → decide → repeat up to 15 times → head home. State persists in URL. The 15-stop limit is enforced. This phase makes the product functional.

Alignment update: if implementation starts from the current product decisions, prioritize FE trip state, URL restore, and user flow first. The `/itineraries/*` backend work listed below should be treated as optional future enhancement unless the team explicitly chooses a server-session architecture.

---

### Backend Tasks

| # | Task | Priority |
|---|---|---|
| BE-25 | Implement `POST /itineraries` — create itinerary in-memory store, return UUID | 🔴 |
| BE-26 | Implement `POST /itineraries/:id/legs` — validate continuity, add leg | 🔴 |
| BE-27 | Implement `PATCH /itineraries/:id/legs/:stopIndex/stay` — compute nextDepartureDate, lookup recommendation | 🔴 |
| BE-28 | Implement `GET /itineraries/:id/next-flights` — derive origin/date from last leg, call FlightService | 🔴 |
| BE-29 | Implement `GET /itineraries/:id/return-flights` — derive return route, call FlightService | 🔴 |
| BE-30 | Implement `PATCH /itineraries/:id/legs/:stopIndex/date` — update pending search date | 🟡 |
| BE-31 | Implement `POST /itineraries/:id/finalize` — validate complete chain, compute summary | 🔴 |
| BE-32 | Implement `GET /itineraries/:id` — return full itinerary (used for share URL restore) | 🔴 |
| BE-33 | Build static `stayRecommendations.json` — top 100 backpacker destinations with suggested days | 🟡 |
| BE-34 | Set itinerary cache TTL: 24hr during planning, extend to 30 days on finalize | 🟡 |
| BE-35 | Write unit tests: leg continuity validation edge cases | 🟡 |
| BE-36 | Write unit tests: `POST /finalize` validation (missing stay, wrong return leg, etc.) | 🟡 |

---

### Frontend Tasks

| # | Task | Priority |
|---|---|---|
| FE-29 | Build `S4 StayDurationScreen` — stepper, live date preview, recommendation text | 🔴 |
| FE-30 | Build `StayDurationStepper` component — +/- buttons, 44px targets, long-press +7 | 🔴 |
| FE-31 | Build `DepartureDatePreview` — live updates, warning if > 10 months ahead | 🔴 |
| FE-32 | Build `RecommendationText` component — hidden if no data, advisory only | 🟡 |
| FE-33 | Build `S5 DecisionScreen` — continue-to-next-destination + fly-home buttons, location display | 🔴 |
| FE-34 | Build `ContinueTripButton` — accent fill, stops remaining label, hidden at stop 15 | 🔴 |
| FE-35 | Build `HeadHomeButton` — outline, shows home city | 🔴 |
| FE-36 | Build `TripTimeline` — always-visible trip summary strip for current route | 🔴 |
| FE-37 | Build decision summary card — compact current-location display on S4 | 🔴 |
| FE-38 | Wire `itineraries.api.ts` — all itinerary endpoints | 🔴 |
| FE-39 | Wire full Zustand store: `addStop`, `setStatus`, `canContinue`, derived getters | 🔴 |
| FE-40 | Implement URL state: `syncToUrl` + `hydrateFromUrl` with lz-string | 🔴 |
| FE-41 | Implement page refresh restore — `hydrateFromUrl` on app mount, navigate to correct screen | 🔴 |
| FE-42 | Wire S3 flight selection → S4 stay duration → S5 decision full flow | 🔴 |
| FE-43 | Wire S5 "Continue trip" → back to S3 with new origin/date from itinerary | 🔴 |
| FE-44 | Wire S5 "Head home" → S6 return search using `GET /return-flights` | 🔴 |
| FE-45 | Wire S6 return flight selection → `POST /finalize` → navigate to S7 shell | 🔴 |
| FE-46 | Enforce 15-stop limit in store guard + hide "Continue" button | 🔴 |
| FE-47 | Build loading transition screens: "Adding to your trip..." + "Building your itinerary..." | 🟡 |
| FE-48 | Build back navigation for all screen transitions | 🔴 |

---

### Dependencies
- Phase 2 complete
- `FlightService` (BE-16) working — needed for next-flights and return-flights
- lz-string installed on FE

---

### Suggested Order of Work

```
// Backend (chain of dependencies)
1. BE-25               create itinerary (prerequisite for all others)
2. BE-26               add leg (core mutation)
3. BE-27               set stay (enables next-flights)
4. BE-28               next-flights (enables continue flow)
5. BE-29               return-flights (enables head home flow)
6. BE-31               finalize (enables S7)
7. BE-32               get itinerary (enables share URL)
8. BE-30, BE-33, BE-34, BE-35, BE-36   lower priority, parallel

// Frontend (depends on store wiring first)
9. FE-39               Zustand store fully wired
10. FE-40 → FE-41     URL state + restore
11. FE-38              API client for all itinerary endpoints
12. FE-37 → FE-29 → FE-30 → FE-31   S4 components
13. FE-33 → FE-34 → FE-35 → FE-36   S5 components
14. FE-42              wire S3 → S4 → S5
15. FE-43              continue trip loop
16. FE-44 → FE-45     head home → finalize
17. FE-46              15-stop enforcement
18. FE-48              back navigation
19. FE-32, FE-47       recommendation text + loading transitions
```

---

### What Can Be Mocked First

- `POST /itineraries` can return a hardcoded UUID initially
- `GET /next-flights` can reuse `GET /flights/search` mock before BE logic is wired
- Zustand store can be tested with hardcoded `TripLeg` objects before API wiring
- S5 Decision screen can be built with hardcoded "Lisbon, 4 nights" before store is connected

```typescript
// Temporary mock for development in store
const MOCK_LEG: TripLeg = {
  stopIndex: 1,
  flightId: "mock_001",
  originIata: "BCN", originCity: "Barcelona",
  destinationIata: "LIS", destinationCity: "Lisbon",
  destinationCountry: "Portugal",
  destinationLat: 38.7749, destinationLng: -9.1342,
  departureDatetime: "2025-05-10T06:00:00Z",
  arrivalDatetime: "2025-05-10T07:45:00Z",
  durationMinutes: 105,
  airlineName: "Ryanair", stops: 0,
  priceUsd: 34,
  bookingUrl: "https://www.google.com/flights#search;f=BCN;t=LIS;d=2025-05-10;tt=o",
  stayDurationDays: 4,
  nextDepartureDate: "2025-05-14",
  isReturn: false
}
```

---

### Definition of Done
- [ ] User can select flight → set stay → see decision screen
- [ ] "Continue to the next destination" loads new flights from current destination
- [ ] "Head home" shows return flights back to origin
- [ ] Selecting return flight and finalizing navigates to S7 shell
- [ ] Trip state survives page refresh (URL restore works)
- [ ] Shared URL opens the correct trip in correct state
- [ ] 15-stop limit enforced: "Continue" hidden at stop 15
- [ ] Back navigation works on all screens without losing state
- [ ] Recommendation text appears for known cities, hidden for unknown
- [ ] Running price total shown in "Trip so far" collapsible

---

## Phase 4: Timeline + Map

### Goal
The final itinerary screen is fully rendered: timeline alternates flight rows and stay blocks with booking links; map shows numbered pins with polylines and tooltips. Tab switching works. Share URL is functional.

---

### Backend Tasks

| # | Task | Priority |
|---|---|---|
| BE-37 | Confirm `POST /finalize` response includes all data needed for timeline render | 🔴 |
| BE-38 | Confirm `GET /itineraries/:id` returns complete leg array with weather | 🔴 |
| BE-39 | Verify booking URL fallback logic in normalization (Google Flights deep link when primary URL missing) | 🔴 |
| BE-40 | Test `GET /itineraries/:id` with expired ID returns correct 404 | 🟡 |

Phase 4 is primarily frontend work. Backend is mostly verification and edge case hardening.

---

### Frontend Tasks

| # | Task | Priority |
|---|---|---|
| FE-49 | Build `S7 ItineraryScreen` shell — header, tab toggle, sticky action bar | 🔴 |
| FE-50 | Build `ItineraryHeader` — "Your Trip" title, route summary, stats row (dates, nights, total price) | 🔴 |
| FE-51 | Build `TabToggle` component — Timeline / Map, instant switch, tab state preserved | 🔴 |
| FE-52 | Build `TimelineView` component — ordered list of flight rows + stay rows | 🔴 |
| FE-53 | Build `TimelineFlightRow` — leg number, origin→destination, times, airline, stops, price, weather, Book button | 🔴 |
| FE-54 | Build `TimelineStayRow` — city, country, nights, date range | 🔴 |
| FE-55 | Build `BookButton` — outline pill, shows price, opens `bookingUrl` in new tab, fallback to search | 🔴 |
| FE-56 | Build `TotalPriceRow` — sum of all legs, disclaimer text, missing price note | 🔴 |
| FE-57 | Build `buildItinerarySummary()` utility — derives `ItinerarySummary` from `Itinerary` | 🔴 |
| FE-58 | Build `buildTimelineItems()` utility — produces ordered flight/stay item array | 🔴 |
| FE-59 | Install Leaflet + react-leaflet, configure in Vite | 🔴 |
| FE-60 | Build `MapView` component — Leaflet map, auto-fit bounds | 🔴 |
| FE-61 | Build `buildMapData()` utility — produces pins + segments from itinerary | 🔴 |
| FE-62 | Render numbered pins on map (origin = star, stops = numbered circles, all in accent green) | 🔴 |
| FE-63 | Render polylines: solid for outbound, dashed for return | 🔴 |
| FE-64 | Build pin tooltip — city, arrival date, stay nights; dismiss on tap-outside | 🔴 |
| FE-65 | Build map empty state — hide tab if < 2 pins have valid coordinates | 🟡 |
| FE-66 | Build `StickyActionBar` — Share trip (copy URL + toast) + Book flights (scroll to first leg) | 🔴 |
| FE-67 | Implement share URL: copy `window.location.href` to clipboard, show "Link copied!" toast | 🔴 |
| FE-68 | Implement `GET /itineraries/:id` restore on S7 direct load (shared link) | 🔴 |
| FE-69 | Build itinerary expired / not found error state | 🟡 |
| FE-70 | Build map loading state (loading dots while Leaflet initializes) | 🟡 |
| FE-71 | Build "Building your itinerary..." transition from S6 → S7 | 🟡 |

---

### Dependencies
- Phase 3 complete (itinerary must be finalizable)
- Leaflet + react-leaflet installed
- `buildItinerarySummary`, `buildTimelineItems`, `buildMapData` utilities before rendering

---

### Suggested Order of Work

```
// Utilities first (pure functions, testable in isolation)
1. FE-57               buildItinerarySummary
2. FE-58               buildTimelineItems
3. FE-61               buildMapData

// Timeline (simpler, no external library)
4. FE-49 → FE-50 → FE-51   S7 shell + header + tabs
5. FE-52 → FE-53 → FE-54   TimelineView + rows
6. FE-55 → FE-56            BookButton + TotalPriceRow

// Map (Leaflet setup first)
7. FE-59               Leaflet install + Vite config
8. FE-60               MapView shell
9. FE-62 → FE-63       pins + polylines
10. FE-64              pin tooltips

// Actions + restore
11. FE-66 → FE-67      sticky bar + share URL
12. FE-68 → FE-69      shared link restore + expired state

// Polish
13. FE-65, FE-70, FE-71   empty/loading states
14. BE-37 → BE-40          BE verification pass
```

---

### What Can Be Mocked First

```typescript
// Hardcode a complete itinerary for building the timeline/map
// without needing to run through the full booking flow
const MOCK_ITINERARY: Itinerary = {
  origin: { iata: "BCN", name: "Barcelona–El Prat Airport", city: { id: "city:barcelona", name: "Barcelona", countryCode: "ES", countryName: "Spain", lat: 41.3851, lng: 2.1734 }, timezone: "Europe/Madrid" },
  legs: [
    { stopIndex: 1, flightId: "mock_001", originIata: "BCN", originCity: "Barcelona", destinationIata: "LIS", destinationCity: "Lisbon", destinationCountry: "Portugal", destinationLat: 38.7749, destinationLng: -9.1342, departureDatetime: "2025-05-10T06:00:00Z", arrivalDatetime: "2025-05-10T07:45:00Z", durationMinutes: 105, airlineName: "Ryanair", stops: 0, priceUsd: 34, bookingUrl: "https://www.google.com/flights#search;f=BCN;t=LIS;d=2025-05-10;tt=o", stayDurationDays: 4, nextDepartureDate: "2025-05-14", isReturn: false },
    { stopIndex: 2, flightId: "mock_002", originIata: "LIS", originCity: "Lisbon", destinationIata: "BCN", destinationCity: "Barcelona", destinationCountry: "Spain", destinationLat: 41.3851, destinationLng: 2.1734, departureDatetime: "2025-05-14T09:00:00Z", arrivalDatetime: "2025-05-14T11:10:00Z", durationMinutes: 130, airlineName: "Vueling", stops: 0, priceUsd: 41, bookingUrl: "https://www.google.com/flights#search;f=LIS;t=BCN;d=2025-05-14;tt=o", stayDurationDays: 0, nextDepartureDate: "2025-05-14", isReturn: true }
  ],
  status: "complete",
  createdAt: "2025-04-01T10:00:00Z",
  completedAt: "2025-04-01T10:08:00Z"
}
```

Load this mock directly into `S7 ItineraryScreen` during development so timeline and map can be built and tested without going through the full flow.

---

### Definition of Done
- [ ] Timeline renders all legs and stay blocks in correct order
- [ ] Each leg shows: origin→destination, times, airline, duration, stops, price, weather
- [ ] Each stay block shows: city, nights, date range
- [ ] "Book · $XX" button on each leg opens correct URL in new tab
- [ ] Map renders all destination pins with numbers
- [ ] Origin pin is visually distinct (star shape)
- [ ] Lines connect pins in trip order; return line is dashed
- [ ] Tapping a pin shows tooltip; tapping elsewhere dismisses it
- [ ] Map auto-fits to show all pins
- [ ] Tab switching between Timeline and Map works instantly
- [ ] Timeline scroll position preserved when switching tabs
- [ ] "Share trip" copies URL to clipboard, shows toast
- [ ] Opening a shared URL restores the complete itinerary
- [ ] Total price shown, disclaimer shown
- [ ] Missing price handled with partial total + disclaimer

---

## Phase 5: QA, Polish & Deployment Readiness

### Goal
The product is production-ready: no broken flows, no visual regressions on mobile, environment-based config deployed, error monitoring in place, and both FE and BE accessible via public URLs.

---

### Backend Tasks

| # | Task | Priority |
|---|---|---|
| BE-41 | Full API contract review — check every endpoint response matches shared types | 🔴 |
| BE-42 | Test all error paths manually: SerpAPI/Kiwi down, OWM down, bad IATA, expired itinerary | 🔴 |
| BE-43 | Add request logging: log method, route, status, duration on every request | 🟡 |
| BE-44 | Configure CORS: allow FE origin only (not `*`) | 🔴 |
| BE-45 | Set up `.env.production` with real API keys, validate against Zod schema | 🔴 |
| BE-46 | Deploy to Railway/Render — verify cold start time < 5s | 🔴 |
| BE-47 | Smoke test production endpoints: `/health`, `/airports/search`, `/flights/search` | 🔴 |
| BE-48 | Add Sentry (or equivalent) for error tracking — free tier sufficient | 🟡 |
| BE-49 | Document all environment variables in `README.md` | 🟢 |
| BE-50 | Review rate limit settings under simulated load (manual, not full load test) | 🟡 |

---

### Frontend Tasks

| # | Task | Priority |
|---|---|---|
| FE-72 | Full flow walkthrough on mobile (real device or BrowserStack) — iPhone + Android | 🔴 |
| FE-73 | Fix all tap target issues (minimum 44×44px enforced) | 🔴 |
| FE-74 | Test and fix all back navigation edge cases | 🔴 |
| FE-75 | Test URL restore across all trip states (mid-planning, complete, shared link) | 🔴 |
| FE-76 | Test 15-stop limit enforcement end-to-end | 🔴 |
| FE-77 | Test all empty states trigger correctly | 🔴 |
| FE-78 | Test all error states trigger correctly (use network throttle/block in DevTools) | 🔴 |
| FE-79 | Audit and fix any layout overflow issues on small screens (320px width) | 🟡 |
| FE-80 | Verify Leaflet renders correctly on mobile (touch events, zoom) | 🔴 |
| FE-81 | Set FE environment variable `VITE_API_BASE_URL` pointing to production BE | 🔴 |
| FE-82 | Deploy to Vercel — verify production build compiles with zero TS errors | 🔴 |
| FE-83 | Test full user flow on production URLs (not localhost) | 🔴 |
| FE-84 | Add `<meta>` tags: title, description, viewport, og:title, og:description | 🟡 |
| FE-85 | Add favicon and PWA manifest (minimal — just icon and name) | 🟢 |
| FE-86 | Verify booking links open correctly on mobile (new tab behavior) | 🔴 |
| FE-87 | Check and fix any z-index conflicts (sticky bar, progress bar, tooltips, toasts) | 🟡 |
| FE-88 | Lighthouse audit — target: Performance > 75, Accessibility > 80 | 🟡 |

---

### Suggested Order of Work

```
// Parallel tracks
Track A (BE deploy)           Track B (FE QA)
─────────────────────         ──────────────────────────
BE-44 (CORS)                  FE-72 (mobile walkthrough)
BE-45 (env config)            FE-73 (tap targets)
BE-41 (contract review)       FE-74 (back navigation)
BE-42 (error path testing)    FE-75 (URL restore testing)
BE-46 (deploy)                FE-76, FE-77, FE-78 (edge cases)
BE-47 (smoke test)            FE-79, FE-80 (layout + map)

// Then connect
FE-81 (point FE at prod BE)
FE-82 (deploy FE to Vercel)
FE-83 (full flow on prod URLs)

// Polish
BE-43, BE-48, BE-49, BE-50
FE-84, FE-85, FE-87, FE-88
```

---

### What Can Be Mocked First

Nothing new mocked in this phase — this phase removes all mocks and validates real behavior.

**Mock removal checklist:**
- [ ] No `MOCK_FLIGHTS` remaining in route handlers
- [ ] No `MOCK_ITINERARY` in S7 screen
- [ ] No hardcoded `itineraryId` in FE
- [ ] All `console.log` debug statements removed
- [ ] No `TODO` comments in critical paths

---

### Definition of Done
- [ ] Full flow works on production URLs: BCN → choose flight → stay → continue → head home → itinerary
- [ ] No TypeScript errors in production build
- [ ] No console errors in browser on any screen
- [ ] All error states tested and working with real API failures
- [ ] Mobile layout correct on 375px and 390px screen widths
- [ ] Share URL works: open in incognito, itinerary renders correctly
- [ ] CORS configured correctly (no browser CORS errors)
- [ ] BE deployed and responding within 3s on cold start
- [ ] FE deployed and loads FCP < 3s on 4G mobile
- [ ] Booking links open in new tab on mobile
- [ ] Map works on mobile touch (pinch zoom, tap pins)

---

## Recommended Build Order — One Engineer

```
Week 1: Foundation + Search
─────────────────────────────────────────────────────
Mon  Phase 1 entirely — monorepo, BE boot, FE boot, shared types, health check
Tue  BE: airport search + nearby airports (no external API, fast wins)
Tue  BE: SerpAPI adapter + normalization (get real flights working ASAP)
Wed  BE: FlightService + /flights/search route
Wed  FE: TripProgressBar + S1 HomeScreen + AirportSuggestionList
Thu  FE: S2 DatePicker + S3 FlightResultsScreen shell
Thu  FE: FlightCard + SkeletonCard + DateSwitcher
Fri  FE: Wire S1→S2→S3 with real API calls
Fri  BE+FE: Weather batch endpoint + async card injection

Week 2: Trip Chaining
─────────────────────────────────────────────────────
Mon  BE: POST /itineraries + POST /legs + PATCH /stay
Tue  BE: GET /next-flights + GET /return-flights + POST /finalize + GET /:id
Wed  FE: Zustand full wiring + lz-string URL state
Wed  FE: S4 StayDurationScreen + stepper + live date preview
Thu  FE: S5 DecisionScreen + collapsible chain
Thu  FE: Wire full S3→S4→S5→continue loop
Fri  FE: Wire S5→S6 return flow + S6→finalize
Fri  FE: Back navigation + page refresh restore

Week 3: Itinerary + Polish
─────────────────────────────────────────────────────
Mon  FE: buildItinerarySummary + buildTimelineItems + buildMapData utilities
Tue  FE: S7 shell + ItineraryHeader + TabToggle + StickyActionBar
Tue  FE: TimelineView + FlightRow + StayRow + BookButton
Wed  FE: Leaflet setup + MapView + pins + polylines
Wed  FE: Pin tooltips + map empty state + map loading state
Thu  FE: Share URL + itinerary restore from shared link
Thu  BE+FE: Full QA pass — all empty/error/edge cases
Fri  BE: Deploy to Railway + configure CORS + smoke test
Fri  FE: Deploy to Vercel + point at prod BE + final walkthrough
```

---

## Recommended Build Order — Small Team (3 Engineers)

```
Engineer A: Backend       Engineer B: Frontend Core    Engineer C: Frontend UI
─────────────────────────────────────────────────────────────────────────────

Week 1
──────
A: Phase 1 BE setup       B: Phase 1 FE setup          C: Phase 1 FE setup (pair w/ B)
A: SerpAPI adapter +      B: TripProgressBar +          C: FlightCard + SkeletonCard
   normalization             S1 HomeScreen                 + WeatherWidget
A: FlightService +        B: S2 DatePicker +            C: DateSwitcher component
   /flights/search           AirportSuggestionList
A: Weather endpoints      B: S3 shell + wire API        C: S4 StayDuration components

Week 2
──────
A: POST /itineraries      B: Zustand full wiring +      C: S5 DecisionScreen +
   + POST /legs              URL state                     TripChainCollapsible
A: PATCH /stay +          B: Wire S3→S4→S5 loop         C: S6 Return results
   recommendations
A: GET /next-flights      B: Continue trip wiring        C: Back navigation +
   + return-flights                                         loading transitions
A: POST /finalize +       B: S6→finalize→S7 shell        C: All empty states +
   GET /:id                                                 error states

Week 3
──────
A: BE QA + error          B: buildItinerarySummary       C: Leaflet setup +
   path hardening +          + buildTimelineItems            MapView + pins
   deploy                    + S7 timeline render
A: CORS + env config      B: StickyActionBar +           C: Pin tooltips +
   + smoke tests             share URL + restore             polylines + tab toggle
A: Sentry + logging       B: Mobile QA pass              C: Mobile QA pass
                          B: Production testing          C: Production testing
```

**Sync points (daily):**
- End of each day: A exposes any new endpoint → B and C point FE at it or update mock
- If BE endpoint is blocked: B and C use mocks and continue; no waiting

---

## Highest-Risk Items — Build These Early

These are the items most likely to cause schedule slippage, architectural rework, or complete blockers if discovered late.

---

### Risk 1 🔴 SerpAPI Response Quality
**What can go wrong:** SerpAPI may have rate limits, return sparse data for some routes, or have inconsistent field presence. Normalization bugs discovered late cascade everywhere. SerpAPI returns airport names (not city names), which require enrichment via AirportService.

**Mitigate by:** Building and testing `SerpApiFlightProvider` + `normalizeProviderFlight` in Week 1 Day 2. Run it against 10 real searches before building anything that depends on it. Log every discarded record. Verify city enrichment works for all returned airports.

---

### Risk 2 🔴 URL State Encoding at 15 Stops
**What can go wrong:** lz-string encoded trip state at 15 stops + return leg may exceed browser URL limits or produce broken URLs on some mobile browsers.

**Mitigate by:** Test URL encoding with a full 15-stop mock object in Week 2 before building the continue-trip loop. Measure compressed URL length. If > 1800 chars, first reduce the stored payload to essential trip fields before considering any server-side fallback.

---

### Risk 3 🔴 Leaflet on Mobile
**What can go wrong:** Leaflet touch events on iOS Safari behave differently than desktop. Pinch-to-zoom can conflict with page scroll. Map may not render correctly inside a flex/scroll container.

**Mitigate by:** Install Leaflet and render a single pin on a real mobile device at the start of Phase 4 — before building all the map logic. Resolve container sizing and scroll conflicts with a simple test before investing in polylines and tooltips.

---

### Risk 4 🔴 Flight Continuity Validation (BE)
**What can go wrong:** `POST /itineraries/:id/legs` origin-continuity validation is subtle. Off-by-one on stop indices, timezone mismatches on datetime comparison, and concurrent requests could all produce silent state corruption.

**Mitigate by:** Write the unit tests for `confirmLeg` before wiring the FE. Test: correct leg, wrong origin, departure before arrival, stop 16, return leg pointing at wrong destination. These are the cases that are hard to catch via manual QA.

---

### Risk 5 🟡 Flight API Key / Quota
**What can go wrong:** SerpAPI has per-month search quotas on paid tiers. If the quota is exhausted, the app automatically falls back to Kiwi (if `KIWI_API_KEY` is set), then to mock.

**Mitigate by:** Get the SerpAPI key on Day 1. Use mock flight data during all FE component development. Only hit the real API when testing the normalization layer and during integration testing. The fallback chain (SerpAPI → Kiwi → Mock) means development is never fully blocked by a single API outage.

---

### Risk 6 🟡 Shared Type Drift
**What can go wrong:** As the API evolves during Phases 2–4, shared types in `packages/shared` get out of sync with actual BE responses and FE expectations. TypeScript catches this — but only if the build is actually run.

**Mitigate by:** Run `tsc --noEmit` as part of the dev startup script on both BE and FE. Any type error fails the server start. This makes drift immediately visible rather than discoverable at integration time.

---

### Risk Summary Table

| Risk | Likelihood | Impact | When to Tackle |
|---|---|---|---|
| SerpAPI data quality | High | Critical | Week 1 Day 2 |
| URL state at 15 stops | Medium | High | Week 2 Day 1 |
| Leaflet mobile issues | Medium | High | Phase 4 Day 1 |
| Leg continuity validation | Medium | High | Before FE wiring |
| SerpAPI quota | Medium | High | Day 1 (get key; Kiwi + mock as fallback) |
| Shared type drift | Low | Medium | Ongoing (fail-fast build) |
