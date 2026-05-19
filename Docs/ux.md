# UX Design Specification — Trip Planner MVP

> **Last updated:** 2026-04-03

---

## Design Principles (Informing Every Decision)

- **One thing at a time.** Each screen has one job. No competing CTAs.
- **Progress is visible.** User always knows where they are in the trip chain.
- **Structured and welcoming.** The UI should feel clear, warm, and travel-friendly.
- **Mobile-first, thumb-friendly.** Primary actions at bottom. Content scrolls up.
- **Never a dead end.** Every error has an action. Every empty state has a next step.

For current localhost behavior, Sections 1–5 of this document are the source of truth. Older wireframe examples deeper in the file are legacy supporting material only when they do not conflict with those sections.

---

## Palette & Type (Reference Only)

```
Background:     #F6F0E7
Surface:        #FFFDF9
Surface-2:      #EFE5D8
Border:         #DED2C3
Accent:         #12756D
Text primary:   #23313A
Text secondary: #6F7A80
Text muted:     #6F7A80
Font:           Inter (body) + JetBrains Mono (prices, codes, dates)
```

---

## 1. Main Screens

```
S1  Home / Origin Search
S2  Flight Results            ← date nav built-in; calendar via overlay
S3  Stay Duration
S4  Decision (Continue vs Head Home)
S5  Return Flights            ← route-focused ticket cards, not destination cards
S6  Itinerary (Timeline + Map)
S7  Booking Review
```

Total: **7 screens.** Linear flow with one loop (S2 → S3 → S4 → S2), then a final booking review step.

> **Removed:** Standalone Date Picker screen (was S2 in earlier design). Date selection is now handled inline via:
> - ← → arrows on the date bar (±1 day)
> - Tapping the date bar to open the `DatePickerOverlay` calendar bottom-sheet

---

## 2. Main Components Per Screen

### S1 — Home / Origin Search

```
┌─────────────────────────────────┐
│  [Logo/Wordmark]                │  ← top left, small
│                                 │
│  "Where are you starting?"      │  ← H1
│                                 │
│  ┌─────────────────────────┐   │
│  │ 🔍  Type a city or      │   │
│  │     airport...          │   │  ← search input, full width
│  └─────────────────────────┘   │
│                                 │
│  ┌──────────────────────────┐  │
│  │  EVN  Yerevan            │  │  ← autocomplete result
│  │  BCN  Barcelona          │  │
│  │  LHR  London Heathrow    │  │
│  └──────────────────────────┘  │
│                                 │
│  [Nearby airports pills]        │  ← geolocation-powered
│  ○ GRO  98km   ○ REU  112km   │
│                                 │
└─────────────────────────────────┘
```

**Behaviour:** Selecting an airport immediately sets tomorrow as the departure date and navigates to S2 — no intermediate date step.

**Components:**
- `SearchInput` — large, autofocused on mount
- `AirportSuggestionList` — max 7 items, tappable rows
- `NearbyAirportPills` — horizontal scroll, populated via `navigator.geolocation` → `/airports/nearby-coords`

---

### S2 — Flight Results

```
┌─────────────────────────────────┐
│  [TripProgress]  Stop 1         │  ← global progress bar
│─────────────────────────────────│
│  ← Back    Cheapest flights     │
│             from EVN Yerevan    │
│                                 │
│  ┌────┐ ┌────────────────┐ ┌────┐
│  │  ← │ │ 📅 Thu, Apr 3  │ │  →  │  ← date nav row
│  └────┘ └────────────────┘ └────┘
│─────────────────────────────────│
│  Trip so far          $86       │  ← shown from 2nd stop onwards
│  [●1 EVN→LIS Apr3-6] ✈ [...]   │  ← TripTimeline strip (horizontal scroll)
│─────────────────────────────────│
│  [▾ Cyprus  1 flight   $47]    │  ← cheapest country, expanded
│  │  [Larnaca LCA · Direct]    │ │  ← compact row card (city · IATA · time · $)
│  [▸ Italy   3 flights  $94]   │  ← collapsed; tap to expand
│  [▸ France  2 flights  $114]  │
│  [▸ Turkey  2 flights  $115]  │
│  ...                            │
│                                 │
│  Nothing fitting?  Try next →   │  ← nudge below last group
│─────────────────────────────────│
│  ┌──────────────────────────┐  │
│  │  Head home  ⌂  · $86    │  │  ← shown from 2nd stop; navigates to S5
│  └──────────────────────────┘  │
└─────────────────────────────────┘
```

**Components:**
- `TripProgressBar` — sticky global header
- Date nav row: `ChevronLeft` button · `Calendar` date button (opens `DatePickerOverlay`) · `ChevronRight` button
- `TripTimeline` — horizontal scrollable strip (visible from 2nd stop); shows running total
- **Stops filter pills:** `Direct from $X` · `1 stop from $X` (mutually exclusive)
- **Country accordion:** one section per destination country, sorted by min price ascending; cheapest country is expanded by default. Each section header shows country name, flight count, and "from $X" min price. Inside an expanded section: compact `FlightCard` rows sorted by price ascending.
- "Nothing fitting? Try next day →" text button
- "Head home" card-style CTA (visible from 2nd stop)
- `DatePickerOverlay` — bottom-sheet calendar, opened on date bar tap

---

### S3 — Stay Duration

```
┌─────────────────────────────────┐
│  [TripProgress]  Stop 2         │
│─────────────────────────────────│
│  How long do you want to stay   │
│  in Lisbon?                     │  ← H1
│  Choose the stay that feels     │
│  right, then continue toward    │  ← supporting value copy
│  the cheapest next destination  │
│─────────────────────────────────│
│  A helpful starting point       │  ← recommendation label
│  A great first plan is 3 days   │  ← recommendation copy
│  in Lisbon                      │
│─────────────────────────────────│
│  Trip so far          $86       │  ← shown from 2nd stop onwards
│  [●1 EVN→LIS Apr3-6] ✈ [...]   │  ← TripTimeline (no highlight — nothing new yet)
│─────────────────────────────────│
│                                 │
│       −       3       +         │  ← large stepper
│                                 │
│  ┌──────────────────────────┐  │
│  │  You'll stay in Lisbon   │  │
│  │  for 3 nights and leave  │  │  ← live departure preview
│  │  on Fri, Apr 9           │  │
│  └──────────────────────────┘  │
│                                 │
│  [Confirm 3 nights]             │  ← primary CTA
│  [Back]                         │  ← secondary
└─────────────────────────────────┘
```

**Components:**
- `TripTimeline` — shown when ≥ 1 prior leg; running total in header; no highlight (leg not confirmed yet)
- `StayDurationStepper` — large +/− with number display; 1–90 range
- `DepartureDatePreview` — live natural-language summary of stay length plus leave date
- `RecommendationText` — friendly suggestion copy; hidden if no data for destination

---

### S4 — Decision Screen

```
┌─────────────────────────────────┐
│  [TripProgress]  Stop 2         │
│─────────────────────────────────│
│  Budapest feels like a good     │
│  chapter.                       │  ← H1
│─────────────────────────────────│
│  Trip so far              $107  │
│  [●1 EVN→LIS Apr3-6] ✈         │  ← TripTimeline — always visible; last leg highlighted
│  [●2 LIS→BUD Apr6-9]           │
│─────────────────────────────────│
│  ┌─────────────────────────┐   │
│  │  Continue to the next   │  │
│  │  destination            │  │  ← primary, accent fill
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │  Wrap up and fly home   │  │  ← secondary, outline
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

> **Changed from earlier design:** Trip history is **always visible** as a `TripTimeline` strip (not collapsible). The last leg is highlighted with an accent border so the user instantly knows where they are. Total shown inline in the section header.

**Components:**
- `TripTimeline` — always visible; last leg accent-highlighted; running total right-aligned
- "Continue to the next destination" — primary accent fill button; hidden (not disabled) at 15-stop limit
- "Wrap up and fly home" — outline button; always shown

---

### S5 — Return Flights

```
┌─────────────────────────────────┐
│  ⌂  Head home                   │  ← Home icon + heading
│     Budapest → Yerevan          │  ← route known; fixed
│─────────────────────────────────│
│  Outbound trip            $107  │
│  [●1 EVN→LIS] ✈ [●2 LIS→BUD]  │  ← TripTimeline (outbound legs, no highlight)
│─────────────────────────────────│
│  ┌────┐ ┌─────────────────┐ ┌────┐
│  │  ← │ │ 📅  Departing   │ │  →  │  ← date nav (same pattern as S2)
│  └────┘ └─────────────────┘ └────┘
│─────────────────────────────────│
│  3 cheapest options back to     │
│  Yerevan — including connections│
│                                 │
│  ┌──────────────────────────┐  │   ← ReturnFlightCard (non-stop)
│  │ Wizz Air      Non-stop $115│  │
│  │ BUD ─────────────── EVN  │  │
│  │ 06:00  →  10:30    4h 30m│  │
│  └──────────────────────────┘  │
│                                 │
│  ┌──────────────────────────┐  │   ← ReturnFlightCard (1 stop via VIE)
│  │ Austrian       1 stop  $89│  │
│  │ BUD ──•── VIE ──•── EVN  │  │
│  │ 06:00  →  14:15   8h 15m │  │
│  └──────────────────────────┘  │
│                                 │
│  Nothing fitting?  Try next →   │  ← nudge
│─────────────────────────────────│
│  [← Back to trip]               │
└─────────────────────────────────┘
```

> **Different from S2 cards:** S5 uses `ReturnFlightCard` — a ticket-style component that shows the **route**, not the destination. Origin and destination are already known (last stop → home city). The card visualises the full IATA chain: `BUD ──•── VIE ──•── EVN` for connecting flights.

**Components:**
- `TripTimeline` — outbound legs, labeled "Outbound trip · $XXX"; no last-leg highlight
- Date nav row (same as S2)
- `ReturnFlightCard` — route-focused; IATA sequence with connector dots; Non-stop/N stop badge; times + duration; price
- `ReturnFlightCardSkeleton` × 3 during load
- "Nothing fitting? Try next day →" nudge
- "← Back to trip" outline button

---

### S6 — Itinerary (Final Screen)

```
┌─────────────────────────────────┐
│  ✈ Your Trip                    │  ← header
│  EVN → LIS → BUD → EVN         │  ← route summary
│  Apr 3–9 · 6 nights · $196     │  ← stats row (accent price)
│                                 │
│  ┌──────────────┬──────────┐   │
│  │  ≡ Timeline  │  ⊙ Map   │   │  ← tab toggle
│  └──────────────┴──────────┘   │
│─────────────────────────────────│
│                                 │
│  [Active tab content]           │  ← scrollable
│                                 │
│─────────────────────────────────│
│  [↗ Share trip]                │  ← sticky bottom
└─────────────────────────────────┘
```

**Components:**
- `ItineraryHeader` — title, route, total price (accent), stats
- `TabToggle` — Timeline / Map
- `TimelineView` — per-leg flight rows + stay rows + total row
- `TripMap` (Leaflet) — numbered pins, solid/dashed polylines, auto-fit bounds
- Share CTA — copies `?t=` URL to clipboard

---

### S7 — Booking Review

```
┌─────────────────────────────────┐
│  ←  Booking options             │
│  Ready to book your trip        │  ← header + total
│  $295 estimated total           │
│─────────────────────────────────│
│  Plan breakdown                 │
│  EVN → ATH → VIE → MAD → ATH   │
│─────────────────────────────────│
│  [Book all at once]             │  ← opens booking tabs
│                                 │
│  [Airline logo]  EVN → ATH      │
│  Mon, Apr 6  10:00 → 15:30      │
│  Vueling · 5h 30m · $42         │
│  [Book this flight →]           │
│                                 │
│  [Airline logo]  ATH → VIE      │
│  Thu, Apr 9  10:00 → 14:00      │
│  Iberia · 4h · $54             │
│  [Book this flight →]           │
└─────────────────────────────────┘
```

**Components:**
- `BookingReviewHeader` — title, total estimate, route summary
- `BookingActionPanel` — `Book all at once` plus guidance about multiple tabs
- `BookingCard` — airline logo or fallback initials, route, date, departure, arrival, duration, airline, price, booking CTA
- Back action — returns to itinerary overview

---

## 3. User Journey Through Screens

```
S1 Origin Search
│
│  User types city → selects airport
│  → system sets tomorrow as default date → navigates immediately to S2
▼
S2 Flight Results                    ◄────────────────────┐
│                                                         │
│  User adjusts date via ← → arrows                      │
│  or taps date bar → DatePickerOverlay bottom-sheet      │
│  User browses cards, taps one                           │
│                                                 (2nd+)  │
│  [OR: User taps "Head home" CTA] ──────────────────────┼──► S5
▼                                                         │
S3 Stay Duration                                          │
│                                                         │
│  User adjusts stepper → confirms                        │
▼                                                         │
S4 Decision                                               │
│                                                         │
├─── "Continue to the next destination" ────────────────┘
│
└─── "Wrap up and fly home"
         │
         ▼
        S5 Return Flights
         │
         │  User selects return ticket
         ▼
        S6 Itinerary
         │
         ▼
        S7 Booking Review
```

**Back navigation:**

```
S2 ← → S1   (changes origin, resets trip)
S3 ← → S2   (discards card selection, back to results)
S4 ← → S3   (re-opens stay duration for last stop) [via S2 "Head home" → S5 directly]
S5 ← → S4   (back to decision screen)
S6 ← → S5/S7 depending on action
S7 ← → S6
```

---

## 4. Suggested Layout and Hierarchy

### Global Layout (Mobile)

```
┌─────────────────────────────────┐
│  STATUS BAR                     │  ← OS-level
├─────────────────────────────────┤
│  TRIP PROGRESS BAR              │  ← sticky, 48px, shown during S2–S5
├─────────────────────────────────┤
│                                 │
│  SCREEN CONTENT                 │  ← scrollable area
│                                 │
├─────────────────────────────────┤
│  STICKY ACTION / CTA            │  ← fixed bottom, 80px + safe area
└─────────────────────────────────┘
```

### Type Hierarchy

```
H1  — 28px, semibold     — screen title ("Where are you starting?")
H2  — 20px, semibold     — section title ("Budapest, Hungary")
H3  — 16px, medium       — card title (destination city)
Body — 14px, regular     — supporting text
Mono — 14px, JetBrains   — prices, codes, dates
Small — 12px, regular    — labels, tags, metadata
```

### Spacing System

```
4px  — micro gaps (icon to text)
8px  — tight (within a card)
16px — standard (between elements)
24px — section gap
32px — screen padding top
16px — screen padding horizontal
```

---

## 5. What Should Be Visible at All Times

Once the trip starts (after S1), these elements are always visible:

**TripProgressBar (sticky top, ~48px):**
- Stop count: *"Stop 2"*
- Mini breadcrumb IATA chain (scrolls horizontally at 4+ stops)
- Hidden on S1 and S7

**TripTimeline strip (S2–S5, visible from 2nd stop):**
```
Trip so far                  $107
[●1 EVN→LIS  Apr 3–6  $86] ✈ [●2 LIS→BUD  Apr 6–9  $21]
```
- Horizontal scroll; auto-scrolls to most recent leg
- Each leg card: stop badge · route · date range · price
- Last leg highlighted with accent border (current location)
- Running total right-aligned in the section header

**Why always visible:** The user is building a chain across multiple screens. Showing where they've been and what they've spent keeps them oriented and confident.

---

## 6. What Should Be Expandable / Collapsible

### Weather on Flight Cards

- Temperature + icon always visible on card
- Tapping weather widget shows small tooltip: *"Forecast for Apr 3"* or *"Average for this time of year"*
- Tooltip dismisses on tap-outside

### Long City Names in Progress Bar

- Progress bar breadcrumb truncates city names to 3-char IATA codes when there are 3+ stops
- Full names shown in the TripTimeline strip

> **Note:** The old collapsible "Trip so far" section on the Decision screen has been replaced by the always-visible `TripTimeline` strip. No collapsible trip chain exists any longer.

---

## 7. How the TripTimeline Strip Works

The `TripTimeline` component is a horizontally scrollable row of leg cards:

```
Trip so far                          $107
[●1 EVN→LIS  Apr 3–6  $86] ✈ [●2 LIS→BUD  Apr 6–9  $21]
```

**Per-leg card anatomy:**
```
●N  Origin → Destination
    Apr 6 – Apr 9  $21
```

- Stop number badge — accent-filled for the current/last leg; muted for prior legs
- Route as city names (not just IATA)
- Date range: arrival date – departure date (from `stayDurationDays`)
- Price in accent mono
- `✈` separator between leg cards

**Scroll behaviour:**
- Auto-scrolls to the rightmost (newest) leg when a new one is added
- Scrollable when more legs than fit in viewport

**Visibility rules per screen:**

| Screen | Visible when | Last leg highlight |
|---|---|---|
| S2 Flight Results | ≥ 1 confirmed leg | Yes — shows current city |
| S3 Stay Duration | ≥ 1 confirmed leg | No — next leg not confirmed yet |
| S4 Decision | Always (≥ 1 leg by definition) | Yes |
| S5 Return Flights | Always | No — labeled "Outbound trip" |

---

## 8. How to Show Flight Options — Grouped by Country (S2)

Results are grouped into a collapsible accordion **by destination country**. The country containing the cheapest deal sits at the top and is expanded by default; the rest are collapsed. This keeps the page short on mobile while still surfacing every destination on the date.

### Group header

```
┌─────────────────────────────────────┐
│  ▾  Cyprus    1 flight     from $47 │  ← caret · country · count · min price
└─────────────────────────────────────┘
```

- Tap anywhere on the header to expand/collapse.
- Sort: groups sorted by `min(priceUsd)` ascending. Flights with no country fall into an "Other" bucket pinned to the end.
- Default expansion: only the first (cheapest) group; user toggles are tracked as explicit overrides so re-renders don't fight the user.

### Compact `FlightCard` row (inside an expanded group)

```
┌────────────────────────────────────────────┐
│  Larnaca  LCA  Direct              $47   › │  ← city · IATA · stops · price · chevron
│  Wizz Air · 14:05 ✈ 15:15 · 2h 10m · ☀22° │  ← airline · times · duration · weather
└────────────────────────────────────────────┘
```

- Two lines, dense. Single tap selects the flight.
- For 1-stop flights, top line shows `1 stop via BUD` instead of `Direct`.
- Weather hidden under `md` breakpoint; duration hidden under `sm` — keeps mobile rows clean.

**List behavior:**
- 6 row skeletons render on screen mount while data loads.
- Real groups replace skeletons as data arrives.
- Weather fills into cards independently (never blocks card render).
- Changing date or origin resets group expansion (cheapest reopens).
- Stops filter (Direct / 1 stop) re-groups on the filtered subset.
- "Nothing fitting? Try next day →" nudge appears below the last group.

---

## 9. How Return Flight Cards Work (ReturnFlightCard — S5)

S5 uses a **different card component** from S2. The destination is already known — the user is choosing a *ticket* between two fixed cities, not discovering a destination.

### Non-stop card

```
┌──────────────────────────────────────┐
│  Wizz Air              Non-stop $115 │  ← airline + badge + price
│                                      │
│  BUD ────────────────────── EVN      │  ← IATA route line
│                                      │
│  06:00  →  10:30             4h 30m  │  ← times + total duration
└──────────────────────────────────────┘
```

### 1-stop card

```
┌──────────────────────────────────────┐
│  Austrian Airlines      1 stop   $89 │
│                                      │
│  BUD ────•──── VIE ────•──── EVN     │  ← via dots mark connection points
│                                      │
│  06:00  →  14:15             8h 15m  │
└──────────────────────────────────────┘
```

**Route line rules:**
- All IATAs in sequence: `[origin, ...viaIatas, destination]`
- Origin and destination in primary text weight
- Via IATAs in muted text weight
- `•` connector dots mark layover points
- Flex-grow connector lines between IATAs

**Badge:**
- Non-stop: accent-tinted pill `Non-stop`
- 1 stop: neutral pill `1 stop`
- 2+ stops: neutral pill `2 stops`

---

## 10. How Date Switching Should Feel (S2 and S5)

```
┌────┐  ┌─────────────────────────────┐  ┌────┐
│  ← │  │ 📅  Departing               │  │  → │
│    │  │    Thu, Apr 3               │  │    │
└────┘  └─────────────────────────────┘  └────┘
  w-12    flex-1 (tappable → calendar)    w-12
```

- **← and → arrows** are prominent standalone buttons (48×48px) — the primary date-change action
- **Center date button** opens `DatePickerOverlay` bottom-sheet for exact date selection
- 400ms debounce on arrow taps; rapid taps coalesce into the final date
- Flight cards immediately show skeletons on date change; replace with results when ready

**DatePickerOverlay:**
- Slides up from bottom on tap
- Standard month grid, min date enforced (day after last leg arrival)
- Confirm button at bottom; dismiss via backdrop tap or swipe down

---

## 11. How Stay Duration Should Be Selected

### Stay Duration Stepper

```
┌─────────────────────────────────┐
│                                 │
│       −       3       +         │
│                                 │
└─────────────────────────────────┘
   [56px]  [large font]  [56px]   ← tap targets
```

- Large `−` and `+` buttons, 56×56px
- Center number: 60px mono font
- `−` disabled (greyed) at value = 1; `+` disabled at value = 90
- Live departure preview updates in real time: *"You'd leave on Fri, Apr 6"*
- Recommendation text (muted, 12px) from `stayRecommendations.json`; hidden if no data

---

## 12. How the Decision Screen Works (S4)

```
┌─────────────────────────────────┐
│  Budapest feels like a good     │  ← H1
│  chapter.                       │
│─────────────────────────────────│
│  Trip so far              $107  │  ← header with total
│  [●1 EVN→LIS Apr3-6 $86] ✈    │  ← TripTimeline (always visible)
│  [●2 LIS→BUD Apr6-9 $21]       │
│─────────────────────────────────│
│  [ Continue to the next         │  ← primary, accent fill
│    destination ]                │
│  [ Wrap up and fly home ]       │  ← secondary, outline
└─────────────────────────────────┘
```

**Button rules:**
- "Continue to the next destination" hidden entirely (not disabled) when 15-stop limit reached
- At limit: muted text explains that the trip has reached the current stop limit
- "Wrap up and fly home" always visible regardless of stop count

> **Fly home is also reachable from S2.** If the user is on the Flight Results screen and decides not to pick another destination, the fly-home card at the bottom of S2 takes them directly to S5. This allows ad-hoc trip termination without going through the Decision screen.

---

## 13. How the Final Itinerary Page Should Look

### Overall Structure

```
┌─────────────────────────────────┐
│  ✈ Your Trip                    │
│  EVN → LIS → BUD → EVN         │
│  Apr 3–9 · 6 nights · $196     │
│                                 │
│  ┌──────────────┬──────────┐   │
│  │  ≡ Timeline  │  ⊙ Map   │   │
│  └──────────────┴──────────┘   │
│─────────────────────────────────│
│                                 │
│  [Active tab content]           │
│                                 │
│─────────────────────────────────│
│  [↗ Share trip]                │
└─────────────────────────────────┘
```

### Timeline View

Each item alternates between **flight rows** and **stay rows:**

```
─────────────────────────────────────
 LEG 1                          $86
 Yerevan  ─────────────────►  Lisbon
 06:00                          07:30
 Ryanair · Direct · 1h 30m
 ☀ 18°C on arrival              [Book →]
─────────────────────────────────────
 📍 Lisbon, Portugal
    3 nights · Apr 3 → Apr 6
─────────────────────────────────────
 LEG 2                          $21
 Lisbon  ──────────────────►  Budapest
 06:00                          11:00
 EasyJet · Direct · 5h
 ☁ 14°C on arrival              [Book →]
─────────────────────────────────────
 📍 Budapest, Hungary
    3 nights · Apr 6 → Apr 9
─────────────────────────────────────
 LEG 3  RETURN                  $89
 Budapest  ──•── Vienna ──•──  Yerevan
 06:00                          14:15
 Austrian Airlines · 1 stop · 8h 15m
                                [Book →]
─────────────────────────────────────
 Total flights: $196
 Prices are estimates. Confirm at booking.
─────────────────────────────────────
```

### Map View

- Leaflet map, lazy-loaded on first tab open
- Numbered pins in accent green; origin = filled star
- Outbound route = solid line; return route = dashed line
- Auto-fits bounds to show all pins with padding
- Tapping a pin shows tooltip: city, arrival date, stay nights
- Stops with missing coordinates silently omitted

---

## 14. Empty States

### No airports found (S1)

```
  ✈  No airports found
     Try a different city or airport code
```

### No flights found (S2 / S5)

```
  No flights on this date.

  ← Day before       Day after →
```

Quick jump buttons are larger tap targets — prominent recovery action.

### Fewer than 3 flights found (S2)

Inline notice above cards: *"Only 2 options on this date. Try a different day for more."*

### No return flights found (S5)

```
  No return flights on this date.

  ← Day before       Day after →
```

### Map has no valid coordinates (S6)

Map tab hidden or replaced: *"Map unavailable for this trip — View timeline instead"*

---

## 15. Error States

### Flight search failed (S2 / S5)

```
  Couldn't load flights.

  [↺  Retry]
```

Retry fires the same search. TripProgressBar stays visible above.

### Airport search failed (S1)

Inline below input: *"Search unavailable — tap to retry."* Input stays enabled.

### Weather failed

Silent — weather widget simply doesn't appear on the card. No placeholder.

### Invalid or corrupted trip link (?t= param)

```
  Couldn't restore this trip from the link.

  [  Start a new trip  ]
```

CTA returns to S1.

---

## 16. Loading States

### Initial flight search (S2 / S5)

- S2: 10 skeleton cards render immediately
- S5: 3 skeleton cards (`ReturnFlightCardSkeleton`)
- Skeletons replaced by real cards as data arrives

### Date switch loading

Cards fade to 40% opacity and shimmer. New cards fade in at full opacity (200ms).

### Weather loading (async, per card — S2 only)

Small pulse placeholder in the weather area; disappears silently if never resolves.

### Map initialization (S6, Map tab first open)

Leaflet initializes on tab open. Pins appear before all tiles load — expected and acceptable.

---

## Screen Summary Table

| Screen | Primary Action | Secondary Action | Back Destination |
|---|---|---|---|
| S1 Origin | Select airport → auto-navigate to S2 | Select nearby pill | — |
| S2 Flight Results | Tap flight card | Shift date via ← →; Head home (2nd+ stop) | S1 |
| S3 Stay Duration | Confirm nights | Adjust stepper | S2 |
| S4 Decision | Continue to the next destination | Wrap up and fly home | S2 (via continue) |
| S5 Return Flights | Tap return ticket | Shift date via ← → | S4 |
| S6 Itinerary | Proceed to booking options | Share trip | — |
| S7 Booking Review | Book all at once or book a ticket | Back to trip overview | S6 |
