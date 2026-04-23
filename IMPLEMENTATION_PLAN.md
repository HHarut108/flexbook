# FlexBook — Implementation Plan

> **Last updated:** 2026-04-06
> **Status key:** `[ ]` Not started · `[~]` In progress · `[x]` Done · `[!]` Blocked

---

## Overview

FlexBook is a mobile-first trip builder that chains up to 15 one-way cheap flights into multi-stop adventures. No login, no databases—just URL-encoded state, React + Fastify, and pure flexibility.

### Screen flow (current — 7 screens)

```
S1 Origin Search  ──►  S2 Flight Results  ◄──► [DatePickerOverlay]
                              │
                              ▼
                        S3 Stay Duration
                              │
                              ▼
                         S4 Decision
                        ╱            ╲
      Continue destination     Wrap up and fly home
                  │                      │
                  ▼                      ▼
           S2 Flight Results      S5 Return Flights
                                         │
                                         ▼
                                    S6 Itinerary
                                         │
                                         ▼
                                  S7 Booking Review
```

**Key design decisions:**
- **Onboarding is immediate.** Home screen asks "Where are you starting?" and selecting an origin jumps immediately to Flight Results (tomorrow default).
- **No standalone Date Picker screen.** Date changes via ← → arrows or tapping the date bar to open the `DatePickerOverlay` bottom-sheet.
- **Trip-in-progress timeline.** A `TripTimeline` horizontal strip appears on S2, S3, and S4 once the user has ≥ 1 confirmed leg, showing each leg with individual price and date range.
- **Results screen back behavior is contextual.** From the first leg it returns home; mid-journey it returns to the decision screen.
- **Return flights use a different card.** `ReturnFlightCard` shows the full route (BCN → EVN or BCN → BUD → EVN) rather than a destination discovery card.
- **Only the options area scrolls on Flight Results.** Header and trip summary stay fixed.
- **Completed trip leads into booking review.** The itinerary remains shareable, and the positive continuation is a dedicated booking review screen.
- **Booking review supports airline branding.** When `AIRHEX_API_KEY` is configured, the screen shows real airline logos; otherwise it falls back to airline initials.
- **Mock provider respects destination.** When `destinationIata` is passed, the mock returns targeted flights to that city; for cities outside the static list it generates synthetic direct + via-hub options.

### Validation snapshot (2026-04-02)

- `npx tsc --noEmit` (frontend + backend) — passes, zero errors
- `npm run lint` (frontend) — passes, zero errors
- Backend endpoints verified: `/health`, `/airports/search`, `/airports/nearby`, `/airports/nearby-coords`, `/flights/search`, `/weather/batch`, `/airlines/logos`
- Reload loop bug fixed: stable string primitives in `useEffect` deps
- URL state (`?t=`) persists and restores full trip on refresh

---

## Phase 1 — Project Setup & Foundation ✅

**Goal:** Both servers boot, TypeScript compiles, shared types accessible, health check works end-to-end.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | Initialize npm workspaces monorepo | `[x]` | Root `package.json`, workspaces: `packages/*`, `frontend`, `backend` |
| 1.2 | Create `packages/shared` — shared TypeScript types | `[x]` | `City`, `Airport`, `FlightOption`, `WeatherSummary`, `TripLeg`, `Itinerary` |
| 1.3 | Set up backend — Node 20 + Fastify v4 + TypeScript | `[x]` | `tsx watch`, Zod validation, Pino logging |
| 1.4 | Set up frontend — React 18 + Vite + TypeScript + Tailwind v3 | `[x]` | Path aliases, `@fast-travel/shared` resolved via Vite alias |
| 1.5 | Install all dependencies | `[x]` | `axios` used on backend instead of `got` (ESM/CJS incompatibility) |
| 1.6 | Backend: `GET /health` endpoint | `[x]` | Returns `{ success: true, data: { status: "ok", ts } }` |
| 1.7 | Frontend: Axios base client + Vite `/api` proxy | `[x]` | Response envelope unwrapped in interceptor |
| 1.8 | Configure ESLint + Prettier across all packages | `[x]` | All lint errors fixed; passes with zero errors |
| 1.9 | Validate E2E: both servers boot, `/health` returns 200 | `[x]` | Verified via backend logs and API calls |

---

## Phase 2 — Airport Search & Flight Results (Screens S1 → S3) ✅

**Goal:** User can search for an origin city, pick a date, and see 10 real flight options with prices and weather.

### 2A — Airport Data & Search

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.1 | Load and integrate `airports.json` | `[x]` | 5,507 airports from OpenFlights dataset |
| 2.2 | `AirportService.search(query)` — 3-pass fuzzy (exact IATA → starts-with → contains) | `[x]` | Returns top 7, score-sorted then alphabetical |
| 2.3 | `AirportService.nearby(iata)` — Haversine, 150 km radius | `[x]` | Returns up to 6 with `distanceKm` |
| 2.4 | `GET /airports/search?q=` route + Zod validation | `[x]` | |
| 2.5 | `GET /airports/nearby?iata=` route + Zod validation | `[x]` | |
| 2.5b | `GET /airports/nearby-coords?lat=&lng=` route | `[x]` | Added for browser geolocation; used by HomeScreen |

### 2B — Flight Search

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.6 | `SerpApiFlightProvider` — adapter for SerpAPI Google Flights (`serpapi.com/search?engine=google_flights`) | `[x]` | Primary provider; normalises SerpAPI response → `FlightOption[]`; enriches airport names via AirportService; booking URLs point to Google Flights deep links; "fly anywhere" handled by querying 20 popular destinations in parallel |
| 2.6b | `KiwiFlightProvider` — adapter for `api.tequila.kiwi.com` | `[x]` | Fallback when `SERPAPI_API_KEY` absent; normalises Kiwi response → `FlightOption[]`; extracts `viaIatas` and airline code |
| 2.7 | `MockFlightProvider` — local dev fallback | `[x]` | Auto-used when neither `SERPAPI_API_KEY` nor `KIWI_API_KEY` is set; respects `destinationIata`; generates targeted flights for unknown destinations (e.g. EVN); includes airline codes for branding |
| 2.8 | `FlightService.search()` — cache → provider → dedupe → sort → top-N | `[x]` | 5-min cache; `deduplicate` flag; `limit` param (1–10); return search uses `limit=3, deduplicate=false` |
| 2.9 | `GET /flights/search` route | `[x]` | Zod-validated; `limit` param added |

### 2C — Weather

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.10 | `OpenWeatherMapProvider` — forecast + current-weather fallback | `[x]` | ≤5 days: 3-hour forecast; >5 days: current weather proxy |
| 2.11 | `WeatherService.getBatch()` — parallel fetch, per-dest silent fail | `[x]` | 1-hour cache TTL |
| 2.12 | `POST /weather/batch` route | `[x]` | Auto-disabled when `OPENWEATHER_API_KEY` is empty |
| 2.12b | `GET /airlines/logos` route | `[x]` | Looks up signed Airhex logo URLs by airline code; safe fallback when `AIRHEX_API_KEY` is empty |

### 2D — Frontend Screens S1–S3

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.13 | Global layout + Tailwind warm light theme with structured cards and teal accent | `[x]` | Inter + JetBrains Mono fonts |
| 2.14 | Sticky progress bar (stop count + breadcrumb) | `[x]` | Hidden on home screen and booking review |
| 2.15 | **S1 — Home:** search input, autocomplete 7 results, nearby airport pills | `[x]` | Geolocation → `nearby-coords`; selecting origin auto-sets tomorrow and jumps to S2 |
| 2.16 | **`DatePickerOverlay` bottom-sheet component** | `[x]` | Replaces standalone Date Picker screen; opened by tapping date bar on S2/S5 |
| 2.17 | **S2 — Flight Results:** prominent ← date → arrows, tap-to-calendar date bar, 10 cards, skeletons | `[x]` | Reload loop fixed; "Nothing fitting? Try next day →" nudge below cards |
| 2.18 | `FlightCard` component | `[x]` | Airline, destination city, route, time, duration, stops badge, price, weather widget |
| 2.19 | Async weather injection (`useWeatherBatch`) | `[x]` | Silent fail; no widget if unavailable |
| 2.20 | Empty state: no flights → ±1 day quick buttons | `[x]` | |
| 2.21 | Error state: API failure → retry button | `[x]` | |

---

## Phase 3 — Trip Chaining (Screens S4 → S7) ✅

**Goal:** Full multi-stop trip flow — stay durations, continue/return decision, final itinerary with timeline + map.

### 3A — State Management

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1 | Zustand `trip.store` — `origin`, `legs`, `addLeg`, `canContinue`, `reset` | `[x]` | Max 15 non-return legs enforced |
| 3.2 | Zustand `session.store` — current screen, pending flights, selected flight | `[x]` | Screen type: `'home' \| 'flight-results' \| 'stay-duration' \| 'decision' \| 'return-flights' \| 'itinerary' \| 'booking-review'` |
| 3.3 | URL sync — active trip state persisted to `?t=` on every change | `[x]` | `useUrlSync` hook in `App.tsx`; restores screen + trip on refresh |
| 3.4 | Share URL — copy-to-clipboard, restores full completed itinerary | `[x]` | Server-side: `POST /trips` stores itinerary in NodeCache (24h TTL), returns 8-char ID → `?trip=<id>`. `ShareModal` shows link + Copy + 24h notice. `ExpiredLinkModal` on 404. Legacy `?t=` still used for live session continuity only. |

### 3B — Backend Business Logic

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.5 | `stayRecommendations.json` static lookup by IATA | `[x]` | 65 popular destinations; bundled in `public/` for frontend import |
| 3.6 | Return flight search (deduplicate = false, limit = 3) | `[x]` | Shows cheapest 3 options including connections |
| 3.7 | `nextDepartureDate = arrivalDate + stayDurationDays` | `[x]` | `computeNextDeparture` in `date.utils.ts` |

### 3C — Frontend Screens S4–S7

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.8 | **S3 — Stay Duration:** stepper, live departure preview, recommendation text, trip-so-far strip | `[x]` | 1–90 days; `TripTimeline` shown when ≥ 1 prior leg; copy is outcome-focused and traveler-friendly |
| 3.9 | **S4 — Decision:** always-visible `TripTimeline` + total, continue vs fly-home choice | `[x]` | Replaces old collapsible summary; primary CTA is "Continue to the next destination" |
| 3.10 | **S5 — Return Flights:** 3 cheapest options, `ReturnFlightCard` route-focused design | `[x]` | BCN→EVN (direct) or BCN→BUD→EVN (via stop); `TripTimeline` shows outbound legs |
| 3.11 | **S6 — Timeline tab:** per-leg cards, airline, route, time, "Book" links | `[x]` | Itinerary remains shareable and leads forward to booking review |
| 3.12 | **S6 — Map tab:** Leaflet, numbered pins, solid/dashed lines, auto-fit | `[x]` | Lazy-loaded; stops with missing coords silently omitted |
| 3.13 | **S6 — Total price** sum + disclaimer | `[x]` | |
| 3.14 | **S6 — Share CTA** copy-to-clipboard | `[x]` | Replaced toast with `ShareModal`. Share button calls `POST /trips`, opens modal with short link, Copy button (clipboard + execCommand fallback), 24h expiry notice. |
| 3.15 | 15-stop limit guard (store + UI) | `[x]` | |
| 3.15b | **S7 — Booking Review:** ticket list, total estimate, airline logos, bulk-book CTA, per-flight booking links | `[x]` | Final review step after itinerary; logos fall back to initials when unavailable |

### 3D — Trip Progress Visibility ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.16 | `TripTimeline` component — horizontal scrollable strip | `[x]` | Shows all outbound legs; per-leg price + date range; last leg highlighted; auto-scrolls to end |
| 3.17 | `TripTimeline` on S2 (Flight Results) — visible from 2nd stop | `[x]` | "Trip so far · $XXX" header; shows current running total |
| 3.18 | `TripTimeline` on S3 (Stay Duration) — visible from 2nd stop | `[x]` | Running total in header |
| 3.19 | `TripTimeline` on S4 (Decision) — always visible | `[x]` | Replaces old collapsible; total shown inline |
| 3.20 | `TripTimeline` on S5 (Return Flights) — shows outbound legs | `[x]` | Labeled "Outbound trip · $XXX" |
| 3.21 | "Head home" CTA on S2 (Flight Results) — visible from 2nd stop | `[x]` | Card-style button at bottom; shows trip total; navigates to S5 |

### 3E — Return Flight Card ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.22 | `viaIatas?: string[]` added to `FlightOption` shared type | `[x]` | Intermediate stop IATA codes |
| 3.23 | `KiwiFlightProvider` extracts `viaIatas` from route segments | `[x]` | `route.slice(0,-1).map(seg => seg.flyTo)` |
| 3.24 | `MockFlightProvider` populates `viaIatas` for 1-stop mock flights | `[x]` | Hubs: FRA, MUC, IST, ZRH |
| 3.25 | `MockFlightProvider` respects `destinationIata` parameter | `[x]` | Known dest → filtered; unknown dest (e.g. EVN) → 3 synthetic flights: direct + 2 via-hub |
| 3.26 | `ReturnFlightCard` component — ticket-style route card | `[x]` | Route: `BCN ——•—— EVN`; Non-stop / N stop badge; times + duration; price |
| 3.27 | `ReturnFlightCardSkeleton` matching the 3-row layout | `[x]` | |
| 3.28 | Filter same-origin destinations from flight results | `[x]` | `FlightService.ts`: strip flights where `destinationIata === originIata` before dedup — covers all providers |

---

## Phase 4 — Polish, Tests & Deploy

**Goal:** Production-ready: tested, accessible, deployed.

### 4A — Testing

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.1 | Unit tests — `AirportService` (search scoring, Haversine) | `[x]` | Vitest; 16 tests |
| 4.2 | Unit tests — `FlightService` (dedup, sort, top-10, limit) | `[x]` | 7 tests; providers mocked |
| 4.3 | Unit tests — `WeatherService` (batch, silent fail) | `[x]` | 2 tests |
| 4.4 | Unit tests — `url.utils` (encode/decode round-trip) | `[x]` | 6 tests; jsdom environment |
| 4.5 | Unit tests — `date.utils`, `price.utils` | `[x]` | 20 tests |
| 4.6 | Integration tests — API routes with mock providers | `[x]` | 13 tests; Fastify inject; flights + airports + health |
| 4.7 | Frontend component tests — `FlightCard`, `ReturnFlightCard`, `TripTimeline` | `[x]` | 31 tests; React Testing Library |

### 4B — Refinement

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.8 | Fewer-than-3-results inline notice on S2/S5 | `[x]` | Already implemented |
| 4.9 | Map: skip stops with missing coordinates | `[x]` | Already implemented |
| 4.10 | Keyboard accessibility: focus management between screens | `[ ]` | |
| 4.11 | Mobile viewport testing — 375px–428px | `[ ]` | |
| 4.12 | Rate-limit / error handling on flight APIs (429, 503) | `[x]` | `SerpApiRateLimitError`/`SerpApiUnavailableError` and `KiwiRateLimitError`/`KiwiUnavailableError` classes; route returns 429 with `Retry-After` header, 503 for unavailable |
| 4.13 | Environment variable validation at startup | `[x]` | Zod schema in `config.ts`; `SERPAPI_API_KEY`, `KIWI_API_KEY`, `OPENWEATHER_API_KEY`, and `AIRHEX_API_KEY` are optional and default to empty string |

### 4C — Deployment

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.14 | Configure Vercel deployment for `frontend/` | `[ ]` | Deferred — local dev only for now |
| 4.15 | Configure Railway/Render deployment for `backend/` | `[ ]` | Deferred — local dev only for now |
| 4.16 | CORS for production domain | `[ ]` | |
| 4.17 | Smoke test on production URLs | `[ ]` | |

---

## Dependencies & Risks

| Risk | Mitigation |
|------|-----------|
| SerpAPI key unavailable | Falls back to Kiwi if `KIWI_API_KEY` is set, then to mock provider; provider selected automatically based on which keys are present |
| Kiwi API key unavailable | Mock provider auto-used when neither `SERPAPI_API_KEY` nor `KIWI_API_KEY` is set; mock respects `destinationIata` so return-home flow works correctly |
| OpenWeatherMap free tier limits | Silent-fail; 1h cache reduces calls |
| URL compression size limit | 15-stop trip with lz-string fits well under browser URL limits |
| Geolocation permission denied | Graceful fallback — no nearby pills shown |
| Mock returning wrong destination on "Head home" | Fixed: MockFlightProvider now generates synthetic targeted flights for any destination IATA |

---

## Progress Summary

| Phase | Tasks | Done | In Progress | Not Started |
|-------|-------|------|-------------|-------------|
| Phase 1 — Setup | 9 | 9 | 0 | 0 |
| Phase 2 — Search & Flights | 23 | 23 | 0 | 0 |
| Phase 3 — Trip Chaining | 28 | 28 | 0 | 0 |
| Phase 4 — Polish & Deploy | 17 | 4 | 0 | 13 |
| **Total** | **77** | **64** | **0** | **13** |
