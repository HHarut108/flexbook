# FlexBook — Master Design Document
> **Version:** 2.0 · **Date:** 2026-04-05 · **Status:** Active source of truth
>
> This document supersedes `ux.md` and `uiux-redesign-v2.md`. Both are retained as historical reference only.

---

## Table of Contents

**Part I — Brand & Identity**
1. [Brand Direction](#1-brand-direction)
2. [Voice & Tone](#2-voice--tone)

**Part II — Design System**
3. [Color Tokens](#3-color-tokens)
4. [Typography](#4-typography)
5. [Spacing & Layout Grid](#5-spacing--layout-grid)
6. [Elevation & Shadows](#6-elevation--shadows)

**Part III — Component Library**
7. [Atoms](#7-atoms)
8. [Molecules](#8-molecules)
9. [Organisms](#9-organisms)

**Part IV — Screens**
10. [Screen Inventory](#10-screen-inventory)
11. [S1 — HomeScreen](#11-s1--homescreen)
12. [S2 — FlightResultsScreen](#12-s2--flightresultsscreen)
13. [S3 — StayDurationScreen](#13-s3--staydurationscreen)
14. [S4 — DecisionScreen](#14-s4--decisionscreen)
15. [S5 — ReturnFlightsScreen](#15-s5--returnflightsscreen)
16. [S6 — ItineraryScreen](#16-s6--itineraryscreen)
17. [S7 — BookingReviewScreen](#17-s7--bookingreviewscreen)

**Part V — UX Flows**
18. [User Journey](#18-user-journey)
19. [Navigation & Back Stack](#19-navigation--back-stack)
20. [Always-Visible Elements](#20-always-visible-elements)

**Part VI — Interaction & Motion**
21. [Interaction Patterns](#21-interaction-patterns)
22. [Motion & Animation](#22-motion--animation)

**Part VII — States**
23. [Loading States](#23-loading-states)
24. [Empty States](#24-empty-states)
25. [Error States](#25-error-states)

**Part VIII — Accessibility**
26. [Colour Contrast](#26-colour-contrast)
27. [Focus & Keyboard](#27-focus--keyboard)
28. [ARIA & Semantics](#28-aria--semantics)

---

## 1. Brand Direction

### Why This Identity

FlexBook is built for **budget-first, plan-later travelers** who want to know where they can go cheapest before they decide whether to go. The design must feel **decisive and kinetic** — not cosy or editorial. Every visual decision should reinforce speed, low cost as a feature (not a limitation), and adventure.

The v1 warm sand + muted teal palette read as a boutique travel blog. v2 shifts to **cool indigo authority + electric orange energy**: the colour of boarding passes and jet engines.

### Wordmark

```
FlexBook
```

- All lowercase
- `fast` and `travel` in **indigo** (`#3730A3`)
- `/` forward-slash in **orange** (`#F97316`) — represents a route, a URL path, a departure
- Font: Inter 900 (black weight), `tracking-[-0.05em]`
- **Never** use ALL CAPS for the wordmark
- **Never** separate the slash from either word

### Short Mark

A `ft` monogram in a 28×28 rounded square (`rounded-lg`), `bg-white/15`, `text-white font-black text-xs` — used in the Progress Bar on indigo background.

### Tagline

> **"Your trip. Your rules. Your price."**

Used only on the HomeScreen below the H1. Not repeated elsewhere.

---

## 2. Voice & Tone

| Context | Tone | Example |
|---|---|---|
| Headlines | Bold, declarative | "Where are you starting?" |
| Body copy | Friendly, direct | "We'll show the cheapest places you can fly next." |
| CTAs | Active verb first | "Continue to the next destination" |
| Error messages | Calm, action-oriented | "Couldn't load flights. Try again." |
| Empty states | Encouraging, not apologetic | "No flights today — try a nearby date, deals change daily." |
| Micro-copy | Informative, brief | "one way" · "estimated" · "avg" |

---

## 3. Color Tokens

### Tailwind Config

```js
colors: {
  bg:              '#F0F4FF',   // Page background — cool pale blue-white
  surface:         '#FFFFFF',   // Card & panel backgrounds
  'surface-2':     '#EEF1F8',   // Depressed surfaces, tags, skeletons

  // Brand — Indigo
  indigo:          '#3730A3',   // Primary brand: headers, wordmark, active states
  'indigo-mid':    '#4F46E5',   // Hover, focused borders
  'indigo-soft':   '#EEF2FF',   // Tinted surfaces, pill bg, info boxes
  'indigo-border': '#C7D2FE',   // Borders on indigo-tinted surfaces

  // Action — Orange
  orange:          '#F97316',   // Prices, primary CTAs, progress bar, wordmark slash
  'orange-dark':   '#EA6C0A',   // CTA hover / pressed
  'orange-soft':   '#FFF7ED',   // Orange tinted surfaces (return screen header)

  // Supporting
  sky:             '#0EA5E9',   // Flight path lines, info badges
  'sky-soft':      '#E0F2FE',
  emerald:         '#10B981',   // "Direct" badge, positive states
  'emerald-soft':  '#D1FAE5',
  gold:            '#F59E0B',   // Weather/sunset accents
  error:           '#EF4444',
  'error-soft':    '#FEE2E2',

  // Text
  'text-primary':  '#0F172A',   // Headlines, body
  'text-secondary':'#334155',   // Secondary body, card descriptions
  'text-muted':    '#64748B',   // Labels, metadata
  'text-xmuted':   '#94A3B8',   // Disabled, placeholder
  'text-on-accent':'#FFFFFF',   // Text on filled orange/indigo

  // Borders
  border:          '#E2E8F0',   // Default
  'border-strong': '#CBD5E1',   // Active / focused
  'border-brand':  '#C7D2FE',   // Indigo context
}
```

### Semantic Role Summary

```
Page background   #F0F4FF  — cool pale blue (not warm sand)
Card surface      #FFFFFF  — pure white (pops off background)
Primary CTA       #F97316  — orange  → speed, energy, "go"
Brand authority   #3730A3  — indigo  → sky, boarding pass, trust
Prices            #F97316  — always orange, always monospace
Direct badge      #10B981  — emerald → "go" signal
Stop badge        #0EA5E9  — sky     → neutral routing info
Return accent     #FFF7ED  — orange-soft → warm "coming home" feel
Error             #EF4444  — standard red
```

---

## 4. Typography

### Font Stack

```
Body:  Inter, system-ui, sans-serif
Mono:  JetBrains Mono, Fira Code, monospace
```

**Google Fonts URL (load in `<head>`):**
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800;0,14..32,900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
```

> **Important:** Weights 800 and 900 are required for the Display XL hero headline on HomeScreen. The v1 font link only went to 700.

### Type Scale

| Role | Size | Weight | Tracking | Line-height | Where used |
|---|---|---|---|---|---|
| Display XL | 3.4rem | 900 | -0.06em | 0.92 | HomeScreen H1 |
| H1 | 1.5rem | 700 | -0.03em | 1.2 | Screen titles |
| H2 | 1.25rem | 600 | -0.02em | 1.3 | Section titles |
| H3 | 1.0rem | 600 | -0.01em | 1.4 | Card titles, city names |
| Body L | 1.0rem | 400/500 | 0 | 1.6 | Main body copy |
| Body M | 0.875rem | 400 | 0 | 1.5 | Supporting text |
| Section Label | 0.7rem | 700 | +0.22em | 1.0 | ALL-CAPS micro labels |
| Mono Price | 1.5rem+ | 700–900 | -0.02em | 1.0 | All prices |
| Mono Code | 0.8rem | 500–600 | 0 | 1.0 | IATA codes, times |

### Hero Headline Treatment (S1)

```
Where are              ← font-black, text-primary, 3.4rem, tracking-[-0.06em]
you starting?          ← "starting?" in text-indigo
                         + orange underline bar (rgba(249,115,22,0.18), h-2, -z-10)
```

---

## 5. Spacing & Layout Grid

### Base Unit: 4px

| Token | px | Tailwind | Primary use |
|---|---|---|---|
| xs | 4 | `gap-1 / p-1` | Icon-to-text, inline tight |
| sm | 8 | `gap-2 / p-2` | Within-card elements |
| md | 12 | `gap-3 / p-3` | Card inner vertical |
| lg | 16 | `gap-4 / p-4` | Standard gap, screen H-padding |
| xl | 20 | `gap-5 / p-5` | Card inner (comfortable) |
| 2xl | 24 | `gap-6 / p-6` | Section gap |
| 3xl | 32 | `p-8` | Hero section top padding |
| 4xl | 48 | `p-12` | Bottom safe-area padding |

### Screen Layout Shell

```
┌─────────────────────────────┐
│  max-w-md (448px) · mx-auto │
│  min-h-screen · bg-bg       │
│                             │
│  ┌────────────────────────┐ │
│  │  ProgressBar   48px    │ │  ← sticky top-0, z-50; hidden on S1 + S7
│  └────────────────────────┘ │
│                             │
│  ┌────────────────────────┐ │
│  │  Screen Content        │ │  ← px-4/px-5, scrollable
│  └────────────────────────┘ │
│                             │
│  ┌────────────────────────┐ │
│  │  Sticky CTA Zone       │ │  ← fixed bottom, px-4, pb-safe
│  │  ~80px + safe area     │ │
│  └────────────────────────┘ │
└─────────────────────────────┘
```

**Special case — FlightResults (S2):**
`h-screen flex flex-col overflow-hidden` — the card list scrolls internally, the header is fixed.

### Border Radius Scale

| Use | Radius | Tailwind |
|---|---|---|
| Pill / badge | 9999px | `rounded-full` |
| Small button / tag | 8px | `rounded-lg` |
| Input / date button | 16px | `rounded-2xl` |
| Card | 20px | `rounded-[20px]` |
| Hero panel | 28px | `rounded-[28px]` |
| Section shell | 24px | `rounded-3xl` |

---

## 6. Elevation & Shadows

Cool blue-slate shadow tones (replaces v1 warm amber):

| Level | Value | Used on |
|---|---|---|
| `shadow-1` | `0 1px 3px rgba(15,23,42,0.06)` | Flat inner items |
| `shadow-2` | `0 4px 12px rgba(15,23,42,0.08)` | Inputs, small cards |
| `shadow-3` | `0 8px 24px rgba(15,23,42,0.08)` + white inset | Card default |
| `shadow-4` | `0 16px 40px rgba(15,23,42,0.12)` + white inset | Hero panels, elevated cards |
| `shadow-cta` | `0 12px 32px rgba(249,115,22,0.28)` | Orange primary CTA |
| `shadow-brand` | `0 12px 32px rgba(55,48,163,0.18)` | Indigo focus state |

---

## 7. Atoms

### `btn-primary`
```
Background: linear-gradient(135deg, #F97316 → #EA6C0A)
Text:       white, font-semibold
Shadow:     shadow-cta
Hover:      brightness(1.08)
Active:     scale-95
Disabled:   opacity-40
Width:      w-full (default)
```

### `btn-secondary`
```
Background: #EEF2FF (indigo-soft)
Text:       #3730A3 (indigo), font-semibold
Border:     1px solid #C7D2FE (indigo-border)
Hover:      bg-indigo/12, border-indigo-mid
```
> Used for: "Wrap up and fly home", "Share trip"

### `btn-outline`
```
Background: white/85, backdrop-blur-sm
Text:       text-primary, font-semibold
Border:     1px solid #E2E8F0
Shadow:     shadow-2
Hover:      border-indigo-mid, text-indigo
```
> Used for: "Back to flight options", "Plan another trip"

### `card`
```
Background: white
Border:     1px solid #E2E8F0
Radius:     rounded-[20px]
Shadow:     shadow-3
Padding:    p-5
Hover (interactive): translateY(-2px), border-indigo-border, shadow-4
```

### `input-field`
```
Background: white
Border:     1px solid #E2E8F0
Shadow:     shadow-2
Focus:      border-indigo-mid + 4px indigo focus ring (rgba(79,70,229,0.12))
Placeholder: text-xmuted (#94A3B8)
```

### `section-label`
```
font-size: 0.7rem · font-weight: 700 · letter-spacing: 0.22em · uppercase · text-muted
```

### `hero-panel`
```
Background: linear-gradient(135deg, rgba(238,242,255,0.98) → rgba(240,244,255,0.95))
Border:     1px solid #C7D2FE
Shadow:     shadow-4 (indigo-tinted)
Radius:     rounded-[28px]
```

### `hero-panel-return` *(ReturnFlights screen)*
```
Background: linear-gradient(135deg, rgba(255,247,237,0.98) → rgba(240,244,255,0.95))
Border:     1px solid rgba(249,115,22,0.25)
Shadow:     shadow-4 (orange-tinted)
```

### `section-shell`
```
Background: white
Border:     1px solid #E2E8F0
Shadow:     0 8px 24px rgba(15,23,42,0.06) + white inset
Radius:     rounded-3xl
```

### `skeleton`
```
Background: linear-gradient(90deg, #EEF1F8 25%, #F8FAFF 50%, #EEF1F8 75%)
Background-size: 200% 100%
Animation: shimmer 1.6s ease-in-out infinite
```

### Pill Variants

| Class | Background | Text | Border | Use |
|---|---|---|---|---|
| `pill-default` | `#EEF1F8` | `#64748B` | `#E2E8F0` | Neutral metadata |
| `pill-brand` | `#EEF2FF` | `#3730A3` | `#C7D2FE` | IATA codes, stop badges |
| `pill-success` | `#D1FAE5` | `#059669` | emerald/30 | "Direct" flight |
| `pill-warning` | `#FFF7ED` | `#EA6C0A` | orange/30 | Book links, prices |
| `pill-sky` | `#E0F2FE` | `#0284C7` | sky/30 | Stop count, routing |

---

## 8. Molecules

### `FlightCard`

```
┌──────────────────────────────────────────┐
│  Ryanair · [Direct ●]  [Portugal ▸]      │  airline + pill-success + pill-brand
│                                          │
│  Lisbon                         $34      │  text-2xl bold + text-2xl mono orange
│  [LIS]                       one way     │  mono pill-default + text-xmuted
│──────────────────────────────────────────│
│  06:00 ✈ 07:45 · 1h 45m       ☀ 22°C   │  font-mono text-secondary + weather
└──────────────────────────────────────────┘
```

Hover: `translateY(-2px)`, `border-indigo-border`, elevated shadow.
Animate: `animate-fade-in` (fadeSlideUp 220ms).

### `ReturnFlightCard`

```
┌──────────────────────────────────────────┐
│  Wizz Air        [Non-stop ●]     $115   │  airline + pill-success + orange price
│                                          │
│  BUD ════════════════════════ EVN        │  indigo→sky gradient bar, 0.5px high
│                                          │
│  06:00         →          10:30  4h 30m  │  mono times + duration
└──────────────────────────────────────────┘
```

For connecting flights:
```
│  BUD ═══•══ VIE ══•═════ EVN            │
```
- Route bar: `h-0.5 bg-gradient-to-r from-indigo to-sky`
- Stop dot: `w-2 h-2 rounded-full bg-white border-2 border-indigo-mid`

### `TripTimeline` Strip

Horizontally scrollable row of leg cards. Auto-scrolls to rightmost on new leg addition.

```
[①] EVN→LIS        [✈]    [②] LIS→BUD   ← current (orange)
Apr 3–6  $86              Apr 6–9  $21
```

- **Past leg** card: `bg-indigo-soft border-indigo-border`, badge `bg-indigo text-white`
- **Current leg** card: `bg-orange-soft border-orange/30`, badge `bg-orange text-white`
- Connector: `<Plane size={10} className="rotate-90 opacity-50" />`

**Visibility rules:**

| Screen | Show when | Last-leg highlight |
|---|---|---|
| S2 Flight Results | ≥ 1 confirmed leg | Yes |
| S3 Stay Duration | ≥ 1 confirmed leg | No (leg not confirmed yet) |
| S4 Decision | Always (≥ 1 leg by definition) | Yes |
| S5 Return Flights | Always | No — labeled "Outbound trip" |

### `ProgressBar`

Sticky top bar, hidden on S1 and S7.

```
┌─────────────────────────────────────────┐
│  [ft]  First flight  ·  EVN ● › LIS    ││  ← indigo fill with orange progress
└─────────────────────────────────────────┘
```

- Background: `rgba(55,48,163,0.97)` + `backdrop-blur-12px`
- `ft` monogram: `w-7 h-7 rounded-lg bg-white/15 text-white font-black text-xs`
- IATA chain: `font-mono`, current IATA in `text-white font-semibold` with orange dot `●` prefix
- Progress pill: `bg-gradient-to-r from-orange to-gold`, grows from 0→100% as stops 0→15

### `DateNavRow`

Used identically in S2 and S5.

```
┌──────┐  ┌─────────────────────────────────┐  ┌──────┐
│  ←   │  │ 📅  Thu, Apr 3   Departing      │  │  →   │
└──────┘  └─────────────────────────────────┘  └──────┘
 w-12 h-12    flex-1, rounded-2xl, bg-white       w-12 h-12
```

- Arrows: `bg-white border border-border rounded-2xl`, hover: `border-indigo-mid text-indigo`
- Center button: hover `border-indigo-mid`, calendar icon hover `text-indigo`
- 400ms debounce; skeleton state activates immediately on arrow tap

### `StayDurationStepper`

```
  [−]              3              [+]
  indigo-soft    font-mono      indigo-soft
  border-indigo  font-black     border-indigo
  hover→bg-indigo text-white    hover→bg-indigo text-white
```
- `−`/`+` buttons: `w-14 h-14 rounded-2xl`
- Number: `text-6xl font-bold font-mono tracking-tight`
- Range: 1–90 nights

---

## 9. Organisms

### HomeScreen Hero Panel

```
FlexBook                    [compass icon]
     ↑ indigo · / · orange

Where are
you starting?   ← 3.4rem font-black, "starting?" in indigo + orange underline
─────────────────────────────────────────
Your trip. Your rules. Your price.   ← text-muted tagline
```

### `HeroPanel` (S2–S6 screen headers)

Indigo-tinted panel (`hero-panel` class) at top of each screen except S1, S5 return, and S7. Carries: back button, screen label, title, and contextual info (IATA pill, date nav, route info).

### `ItineraryLegCard` (S6 Timeline)

Each leg gets an orange stop-number badge (outbound) or indigo return badge:

```
┌──────────────────────────────────────────┐
│  [①]  Stop 1                             │  ← bg-orange badge
│                                          │
│  Yerevan ─── Plane ───────────► Lisbon   │
│  YER                              LIS    │
│  06:00 → 07:45 · Ryanair · Direct · 1h  │
│  📍 3 nights  ☀ 22°C      [Book ↗]      │
└──────────────────────────────────────────┘
```

Return leg badge: `bg-indigo-soft text-indigo border border-indigo-border`

---

## 10. Screen Inventory

| ID | Screen | Route condition | Hidden on |
|---|---|---|---|
| S1 | HomeScreen | Always | — |
| S2 | FlightResultsScreen | After origin selected | — |
| S3 | StayDurationScreen | After flight card tapped | — |
| S4 | DecisionScreen | After stay confirmed | — |
| S5 | ReturnFlightsScreen | After "fly home" chosen | — |
| S6 | ItineraryScreen | After return flight selected | — |
| S7 | BookingReviewScreen | After "Proceed to booking" | ProgressBar |

**7 screens. Linear flow with one loop (S2 → S3 → S4 → S2), then finalize.**

---

## 11. S1 — HomeScreen

**One job:** Let the user pick their origin airport.

**Layout:**
```
px-5 pt-8 pb-12
│
├── Ambient glow divs (indigo top-right, sky top-left)
│
├── Header row
│   ├── Wordmark: FlexBook  (indigo·orange slash·indigo)
│   └── Compass icon button (w-11 h-11, indigo-mid, hover indigo-soft)
│
├── H1: "Where are you starting?" (Display XL, font-black 3.4rem)
│   └── Tagline: "Your trip. Your rules. Your price." (text-muted)
│
├── section-shell: Search box
│   ├── section-label "Start from" (hidden when results showing)
│   └── input-field with left Search icon + right orange ArrowRight button
│
├── [IF showResults] section-shell: Airport results list
│   └── Rows: city · IATA (indigo-mid mono) · name  +  indigo ArrowRight chip
│
└── [IF !showResults]
    ├── section-label "Nearby airports"
    ├── section-shell: Nearby list (list-row rows with MapPin, indigo-soft chip)
    └── Footer note (text-xmuted, text-sm)
```

**Behaviour:** Selecting any airport sets tomorrow as default date and navigates immediately to S2.

---

## 12. S2 — FlightResultsScreen

**One job:** Show up to 10 cheapest destination flights from the current city on a chosen date.

**Layout:** `h-screen flex flex-col overflow-hidden`

```
├── [shrink-0] px-4 pt-4 pb-3: Hero header
│   └── hero-panel
│       ├── Back button + section label (indigo-mid mono) + H2 + IATA pill-brand
│       └── DateNavRow (← date →)
│
├── [shrink-0, IF stopCount > 0] Trip-so-far strip
│   ├── "Trip so far" label  +  running total (text-orange mono)
│   └── TripTimeline (highlightLast=true)
│
└── [flex-1 overflow-y-auto] Results
    ├── Error card (if flightError)
    ├── No-results card (if 0 flights)
    ├── Few-results notice (if < 3 flights)
    ├── FlightCard × 10 (or FlightCardSkeleton × 10)
    ├── "Nothing fitting? Try next day →" nudge (text-orange)
    └── [IF stopCount > 0] "Head home" card button (indigo hover)
```

**Date switching:** 400ms debounce; cards skeleton immediately on tap.

---

## 13. S3 — StayDurationScreen

**One job:** Choose how many nights to stay at the selected destination.

```
├── hero-panel
│   ├── pill-sky "Stay and explore"
│   ├── H2: "How long do you want to explore {city}?"
│   ├── City, country (text-muted)
│   └── [IF recommendation] indigo-soft "Good to know" box (text-indigo)
│
├── [IF prior legs] Trip timeline strip (text-orange total, highlightLast=false)
│
├── StayDurationStepper (−  /  N  /  +)
│
├── card: "Your next flight search opens on {date}"
│
├── btn-primary: "Stay N nights and continue"
└── btn-outline: "Back to flight options"
```

---

## 14. S4 — DecisionScreen

**One job:** Continue the trip OR wrap up and fly home.

```
├── hero-panel
│   ├── pill-brand "Stop N"
│   ├── H2: "{city} feels like a good chapter."
│   ├── Body copy
│   └── indigo-soft info box: next departure date
│
├── Trip timeline (text-orange total, highlightLast=true)
│
└── Actions
    ├── btn-primary  "Continue to the next destination"  [hidden at 15-stop limit]
    ├── [text note when at limit]
    └── btn-secondary  "Wrap up and fly home"
```

---

## 15. S5 — ReturnFlightsScreen

**One job:** Choose the cheapest flight home (up to 3 options).

```
├── hero-panel-return (orange-tinted)
│   ├── orange-soft icon chip + pill-warning "Way home"
│   ├── H2: "Ready to close the loop?"
│   ├── Body copy: "{lastCity} → {originCity}"
│   └── orange-soft route-back info box
│
├── Trip timeline (outbound only, text-orange total, highlightLast=false)
│
├── DateNavRow (← date →)
│
├── Results: ReturnFlightCard × 3 (or ReturnFlightCardSkeleton × 3)
├── "Want a better finish? Try next day →" nudge (text-orange)
└── btn-outline "← Back to trip"
```

**Key difference from S2:** Uses `ReturnFlightCard` (route-focused, not destination-focused). Shows max 3 results. Not de-duplicated.

---

## 16. S6 — ItineraryScreen

**One job:** Display the complete trip and enable sharing / booking.

```
├── hero-panel
│   ├── label "Your route is ready" (text-indigo-mid mono)
│   ├── H2 "Your trip" · "{N} flights"
│   └── Price (text-3xl mono font-black text-orange) · "estimated total"
│
├── Tab toggle: [≡ Timeline] [⊙ Map]
│   Active tab: text-indigo, border-b-2 border-indigo, bg-indigo-soft/40
│
├── Timeline tab: per-leg cards
│   ├── Outbound legs: bg-orange badge, orange price, pill-warning "Book ↗"
│   └── Return leg: bg-indigo-soft badge, orange price, pill-warning "Book ↗"
│
├── Map tab: Leaflet map (lazy-loaded)
│   Pins: numbered, indigo; origin: filled; routes: solid (outbound) / dashed (return)
│
└── Actions
    ├── btn-primary  "Proceed to booking options"  (CreditCard icon)
    ├── btn-secondary  "Share trip"  (Share2 / Check icon)
    └── btn-outline  "Plan another trip"
```

**Share:** Copies `?t=<lz-compressed-itinerary>` URL to clipboard. Tick confirms copy.

---

## 17. S7 — BookingReviewScreen

**One job:** Open each flight's booking link individually. ProgressBar hidden.

```
├── hero-panel
│   ├── Back button (← to S6)
│   ├── Label "Booking review" (text-indigo-mid mono)
│   ├── H2 "Ready to book your trip"
│   └── Total price (text-orange mono bold)
│
├── indigo-soft "Before you book" advisory card (ShieldCheck icon)
│
├── Per outbound leg: card
│   ├── "Ticket N" label · route (originIata → destinationCity destinationIata)
│   ├── Price (text-orange mono)
│   ├── Date · times · airline · duration · direct/stops · stay
│   └── btn-primary "Book this flight ↗"
│
├── Return leg card (if exists)
│   └── btn-primary "Book return flight ↗"
│
└── btn-outline "Back to trip overview"
```

---

## 18. User Journey

```
S1 Origin Search
│  User types → selects airport → default date set → navigate to S2
▼
S2 Flight Results ◄────────────────────────────────────────────┐
│  User adjusts date (← →) or opens DatePickerOverlay          │
│  User taps a FlightCard                               (2nd+)  │
│  [OR: User taps "Head home" CTA] ────────────────────────────┼──► S5
▼                                                               │
S3 Stay Duration                                                │
│  User adjusts stepper → confirms                              │
▼                                                               │
S4 Decision                                                     │
│                                                               │
├── "Continue" ────────────────────────────────────────────────┘
│
└── "Fly home"
        │
        ▼
       S5 Return Flights
        │  User selects return ticket
        ▼
       S6 Itinerary
        │
        └──► S7 Booking Review
```

---

## 19. Navigation & Back Stack

| From | Back destination | Notes |
|---|---|---|
| S2 | S1 (first stop) or S4 (2nd+ stop) | Resets pending flights |
| S3 | S2 | Discards card selection |
| S4 | — | No back; use S2 from "continue" |
| S5 | S4 | Back to decision |
| S6 | — | Actions: S7 or new trip |
| S7 | S6 | Back to itinerary |

---

## 20. Always-Visible Elements

### ProgressBar (S2–S6)

Sticky `top-0 z-50`. Shows:
- `ft` monogram
- Current stop label ("First flight" / "Stop N")
- IATA breadcrumb chain (current IATA in white bold with orange dot prefix)
- Orange progress fill pill (0→100% over 15 stops)

### TripTimeline Strip (S2–S5, from 2nd stop)

```
Trip so far                              $107 (orange)
[①] EVN→LIS  Apr 3–6  $86  [✈]  [②] LIS→BUD  Apr 6–9  $21
```
- Horizontal scroll, auto-scrolls to newest leg
- Indigo badge + indigo-soft background for past legs
- Orange badge + orange-soft background for current/latest leg
- Running total right-aligned in header row, **always in orange mono**

---

## 21. Interaction Patterns

### Touch Targets
All interactive elements ≥ 48×48px. Smaller visual elements use padding to expand hit area.

### Tap Feedback
```css
button { -webkit-tap-highlight-color: transparent; }
active:scale-95   /* all buttons */
transition-all duration-150
```

### Debounce Strategy (Date Navigation)
```
Arrow tap
  → skeleton state activates immediately (optimistic)
  → 400ms debounce timer starts
  → rapid taps reset timer
  → API call fires when timer resolves
  → real cards replace skeletons
```

### Airport Typeahead
- Debounce: 300ms · Min length: 1 char · Max results: 7
- Results: `animate-fade-in` staggered 20ms per row
- No results: "No results. Try a different city or code."

### Date Picker Overlay
- Triggered by tapping the center date button in DateNavRow
- Slides up from bottom (280ms enter)
- Month grid, min date enforced (day after last leg arrival)
- Confirm button at bottom; dismiss by backdrop tap

---

## 22. Motion & Animation

### Tokens

| Name | Duration | Easing | Use |
|---|---|---|---|
| micro | 100ms | ease-out | Button press, hover color |
| fast | 150ms | ease-in-out | Border / color transitions |
| standard | 220ms | `cubic-bezier(0.4,0,0.2,1)` | Card appear, badge update |
| enter | 280ms | `cubic-bezier(0.0,0,0.2,1)` | Screen enter, sheet rise |
| exit | 220ms | `cubic-bezier(0.4,0,1,1)` | Dismiss, fade-out |

### Keyframes

```css
@keyframes fadeSlideUp {        /* card & screen entrance */
  from { opacity:0; transform: translateY(8px); }
  to   { opacity:1; transform: translateY(0); }
}
@keyframes shimmer {            /* skeleton loading */
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
@keyframes scaleIn {            /* badge updates, modal entry */
  from { opacity:0; transform: scale(0.96); }
  to   { opacity:1; transform: scale(1); }
}
```

### Per-Component Rules

| Component | Enter | Interaction | Exit |
|---|---|---|---|
| FlightCard | `animate-fade-in`, stagger 30ms | hover translateY(-2px) 150ms | — |
| DatePickerOverlay | slide-up 280ms | — | slide-down 220ms |
| btn-primary press | scale(0.95) 100ms | shadow-cta pulse | scale(1) 100ms |
| ProgressBar badge update | scaleIn 220ms | — | — |

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
Skeleton shimmer → static `#EEF1F8` background.

---

## 23. Loading States

| Context | Treatment |
|---|---|
| Initial flight search (S2) | 10 × `FlightCardSkeleton` render immediately |
| Return flight search (S5) | 3 × `ReturnFlightCardSkeleton` |
| Date change (S2/S5) | Existing cards fade to 40% + blur(1px); new cards fade in |
| Weather (per-card, S2) | Small pulse placeholder; disappears silently if unresolved |
| Map tab (S6, first open) | Leaflet lazy-loads; pins appear before tiles |

---

## 24. Empty States

All empty state cards use `border border-dashed border-border rounded-[20px] p-6 text-center`.

| Screen | Condition | Message | Recovery |
|---|---|---|---|
| S1 | No airport matches query | "No results. Try a different city or code." | Keep typing |
| S2 | 0 flights on date | "No flights here on this date." | ← Day before / Day after → |
| S2 | 1–2 flights | "Only N option(s) — try nearby dates." | Inline nudge |
| S5 | 0 return flights | "No good route home on this date." | ← Day before / Day after → |
| S6 | Map: no coordinates | Map tab hidden | Auto-select Timeline |

---

## 25. Error States

Error cards: `bg-error-soft border-l-4 border-error rounded-[20px] p-5`.

| Screen | Condition | Message | Recovery |
|---|---|---|---|
| S2/S5 | API error | "Couldn't load flights. Try again." | [Retry] |
| S1 | Airport search failed | "Search unavailable — tap to retry." | Input stays active |
| Weather | Fetch failed | Silent — widget simply absent | — |
| Any | Bad `?t=` URL param | "Couldn't restore this trip." | [Start a new trip] → S1 |

---

## 26. Colour Contrast

All text/background pairs meet **WCAG AA minimum (4.5:1 normal text, 3:1 large text):**

| Foreground | Background | Ratio | Pass |
|---|---|---|---|
| `text-primary` #0F172A | `bg` #F0F4FF | 14.3:1 | ✓ AAA |
| `text-muted` #64748B | `bg` #F0F4FF | 4.6:1 | ✓ AA |
| white | `indigo` #3730A3 | 8.6:1 | ✓ AAA |
| white | `orange` #F97316 | 3.1:1 | ✓ AA (large text only) |
| `indigo` #3730A3 | `indigo-soft` #EEF2FF | 6.2:1 | ✓ AA |
| `text-secondary` #334155 | `surface` #FFFFFF | 9.7:1 | ✓ AAA |

> **Orange on white caveat:** The 3.1:1 ratio passes only for **large text (≥18px regular or ≥14px bold)**. Orange is exclusively used for prices (`≥24px bold`) and CTAs (`16px bold on white` — the button label is always `≥14px semibold`). Never use orange for small body text.

---

## 27. Focus & Keyboard

```css
/* Global focus ring — indigo */
:focus-visible {
  outline: 2px solid #4F46E5;
  outline-offset: 2px;
}
```

- `focus:outline-none` only used when a **custom visible style** replaces it
- `DatePickerOverlay` traps focus while open; returns focus to trigger on close
- All interactive elements ≥ 48×48px touch target (padding if visual is smaller)

---

## 28. ARIA & Semantics

| Element | ARIA |
|---|---|
| FlightCard button | `aria-label="Fly to {city}, ${price}"` |
| Date ← button | `aria-label="Previous day"` |
| Date → button | `aria-label="Next day"` |
| ProgressBar | `role="progressbar"` `aria-label="Trip progress, stop N"` |
| Stepper − | `aria-label="Decrease stay by 1 night"` |
| Stepper + | `aria-label="Increase stay by 1 night"` |
| Skeleton container | `aria-busy="true"` |
| Itinerary tabs | `role="tablist"` / `role="tab"` / `aria-selected` |
| Share button (copied) | `aria-live="polite"` on status region |

---

*End of FlexBook Master Design Document v2.0*
