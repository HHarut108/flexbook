# FlexBook

FlexBook is a mobile-first trip builder for budget travelers who discover adventures through cheap flights, not fixed destinations.

Start from your current city, discover the cheapest next places to fly, choose how long to stay, and build a spontaneous multi-stop route step by step. Once your trip is complete, review it and move into booking—all without logging in or leaving your browser.

## Product Summary

- **Audience:** Spontaneous explorers, budget travelers, backpackers, solo travelers, couples, remote workers
- **Core idea:** Price-first discovery (flights lead, destinations follow) instead of destination-first planning
- **Primary value:** Turn cheap flights into real, multi-stop trips built step by step
- **Platform:** Mobile-first web app
- **Brand promise:** "Your trip. Your rules. Your price."

## Current User Flow

1. Home screen
   - Asks: `Where are you starting?`
   - User searches for a city or airport
   - Nearby airport suggestions can be shown

2. Flight results
   - Shows the cheapest next-hop options from the current city
   - Date can be adjusted
   - Mid-trip back action returns to the previous decision step

3. Stay duration
   - User chooses how many nights to stay in the selected destination

4. Decision screen
   - User decides whether to continue to the next destination or wrap up and fly home

5. Return flights
   - Shows route-home options back to the original origin city

6. Trip itinerary
   - Shows the completed trip in timeline or map view
   - Includes estimated total price and per-flight details

7. Booking review
   - Final review step before booking
   - Shows all tickets, dates, prices, airlines, airline logos, and booking links

## Current UX Direction

- Bright, warm, travel-oriented UI
- Cleaner and more structured layout system
- Consumer-friendly copy, not developer-style wording
- Onboarding focused on one clear question and one clear action
- Planning flow focused on simple choices:
  - choose a starting airport
  - choose the next cheap destination
  - choose how long to stay
  - continue or go home
  - review and book

## Current Product Decisions

- The product is optimized for functionality, use cases, and PRD clarity over deep technical complexity
- Share/restore is URL-based for MVP
- Refresh should preserve the trip state
- Outbound search is destination discovery first
- Return search is route-back-home first
- Final user continuation after trip completion is `Proceed to booking options`
- Booking is per-flight, using individual booking links

## What Is Already Implemented

- Home airport search flow
- Nearby airport suggestions
- Cheapest next-flight browsing
- Stay duration selection
- Mid-trip decision step
- Return-home flight selection
- Trip timeline view
- Trip map view
- Shareable trip URL
- Booking review screen
- Plan Stay screen — per-city guide with live hotels, attractions, restaurants, and a day-by-day sketch, fetched dynamically from Google Places for any destination worldwide

## Project Structure

- [`frontend/`](./frontend): React + Vite frontend
- [`backend/`](./backend): backend services and APIs
- [`packages/shared/`](./packages/shared): shared types and contracts
- [`Docs/`](./Docs): detailed product, UX, architecture, and planning documentation
- [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md): implementation tracking

## Documentation Map

- [`Docs/prd-alignment-decisions.md`](./Docs/prd-alignment-decisions.md): aligned product decisions
- [`Docs/_docs_product-definition.md`](./Docs/_docs_product-definition.md): product definition
- [`Docs/ux.md`](./Docs/ux.md): UX guidance
- [`Docs/engineering-plan.md`](./Docs/engineering-plan.md): engineering plan
- [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md): practical progress tracker

## Local Preview

Run the app from the project root:

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run build
npm run lint
npm run test
```

Optional backend API keys:

```bash
SERPAPI_API_KEY=your_serpapi_api_key_here
KIWI_API_KEY=your_kiwi_tequila_api_key_here
AIRHEX_API_KEY=your_airhex_api_key_here
GOOGLE_PLACES_API_KEY=your_google_places_api_key_here
```

`SERPAPI_API_KEY` enables real flight data via Google Flights (SerpAPI). If absent, the app falls back to `KIWI_API_KEY` (Kiwi/Tequila). If neither key is set, the mock provider is used automatically (suitable for development and testing).

`AIRHEX_API_KEY` enables real airline logos on the booking review screen. Without it, the app falls back to simple airline initials.

`GOOGLE_PLACES_API_KEY` powers the Plan Stay screen — hotels, tourist attractions, and restaurants for any destination via the Google Places API (Text Search). Without it, the `/city-guide` and `/restaurants` endpoints return 503.

## Backend Caching

The backend uses a two-tier in-memory cache (`node-cache`) that separates stable flight schedule data from volatile price data. The cache is shared across all users for the same search key — a popular origin+date pair is only fetched from the external API once per TTL window regardless of how many users search it simultaneously.

### Cache layers

| Layer | Cache key | TTL |
|-------|-----------|-----|
| Schedule | `flights:schedule:{IATA}:{YYYY-MM-DD}:{dest\|any}` | 45 min (same day) · 8 h (future) · skip (past) |
| Price | `flights:price:{flightId}` | 15 min soft / 30 min hard (< 72 h away) · 30 min soft / 60 min hard (> 72 h) |

**Schedule cache** stores everything stable: airline, flight number, departure/arrival times, route metadata. It is never invalidated early.

**Price cache** uses stale-while-revalidate: when a price entry exceeds its soft TTL it is returned immediately with `priceStatus: "stale"` while a background refresh updates the cache for the next request. The hard TTL (2× soft) keeps stale entries available during the refresh window.

### Flight search response format

```json
{
  "success": true,
  "data": {
    "origin": "EVN",
    "date": "2026-05-05",
    "cacheStatus": "schedule_cached",
    "results": [
      {
        "flightId": "EVN-BUD-W6-2026-05-05",
        "airline": "Wizz Air",
        "departureTime": "2026-05-05T10:30:00+04:00",
        "priceInfo": {
          "amount": 129,
          "currency": "USD",
          "provider": "kiwi",
          "deeplink": "https://...",
          "priceUpdatedAt": "2026-05-04T14:20:00Z",
          "priceStatus": "cached"
        }
      }
    ]
  }
}
```

`cacheStatus` is `"live"` (provider was called) or `"schedule_cached"` (served from cache).  
`priceStatus` per flight is `"live"` (just fetched), `"cached"` (within soft TTL), or `"stale"` (soft TTL passed, refresh in progress).

### Configurable TTL values

All TTL constants are exported from `backend/src/utils/flightCache.ts` as the `CACHE_TTL` object and can be adjusted in one place without touching business logic.

## Current Focus

The current focus of the project is:

- improving UX clarity
- making the planning flow more intuitive
- refining the visual structure and travel-friendly interface
- making the completed-trip flow naturally lead into booking

## Notes

- This `README.md` is the simple top-level overview for the whole project.
- The `Docs/` folder contains the deeper supporting documentation.
- If documentation ever conflicts, the latest aligned product direction should be updated here and in `Docs/prd-alignment-decisions.md`.
