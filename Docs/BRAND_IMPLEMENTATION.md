# FlexBook — Brand Implementation Guide

> **Version:** 1.0 · **Date:** 2026-04-05 · **Status:** Active source of truth
>
> This guide explains the reasoning behind brand decisions and how to apply them screen by screen. It bridges the design system token reference (DESIGN_SYSTEM.md) and the screen specifications (DESIGN.md). Read this when you are building a new screen, reviewing a PR for visual correctness, or questioning why a particular color is used where it is.

---

## Table of Contents

1. [Brand Personality](#1-brand-personality)
2. [Colour Application Rules](#2-colour-application-rules)
3. [Hero Panel System](#3-hero-panel-system)
4. [Price Display Standards](#4-price-display-standards)
5. [Interactive States](#5-interactive-states)
6. [Badge/Pill Language](#6-badgepill-language)
7. [Screen Colour Moods](#7-screen-colour-moods)
8. [Typography Hierarchy in Practice](#8-typography-hierarchy-in-practice)
9. [Motion Brand Values](#9-motion-brand-values)
10. [Brand Consistency Checklist](#10-brand-consistency-checklist)

---

## 1. Brand Personality

The FlexBook brand has five core personality attributes. Each one has a direct visual consequence that is not optional — it shapes every UI decision.

### Decisive

> The UI never wastes the user's time with decorative complexity. Every screen does one thing.

**How it is expressed:** Each screen has a single H1 or hero panel headline that states exactly what action is required. There are no carousels, tabs (except the S6 Timeline/Map toggle), or multi-column layouts. The primary CTA is always the largest interactive element on screen, always orange, and always at the bottom of the view.

### Kinetic

> The product is about movement — planes, routes, cities. The UI should feel in motion, not static.

**How it is expressed:** Cards animate in with `fadeSlideUp` (8px upward travel). The compass icon on HomeScreen floats on an 8s loop. The ProgressBar fills with an orange gradient as the trip grows. Interactive cards lift on hover (`translateY(-2px)`). Nothing is frozen; everything responds.

### Smart-budget

> Low cost is the product's core feature, not a limitation. The UI presents budget as a power move, not a compromise.

**How it is expressed:** Prices are shown in orange — the most energetic color in the palette — not grey or muted. They are displayed in monospace, bold, at the largest text size on the card. The direct-flight emerald badge communicates efficiency, not discount. The app never says "cheap" — it says "cheapest" in the copy.

### Trustworthy

> Users are about to make real purchasing decisions. The interface must feel structured and credible.

**How it is expressed:** The indigo brand color is drawn from the world of aviation and fintech — it signals authority without warmth. The hero panels at the top of each screen anchor each step with clear, factual context (routes, dates, costs). IATA codes are shown in monospace with branded indigo treatment. The ProgressBar is always visible, showing exactly where the user is in the booking journey.

### Adventure-forward

> The product is for people who want to go somewhere, not people who are anxious about travel.

**How it is expressed:** Empty states are encouraging, not apologetic ("try a nearby date — deals change daily"). The HomeScreen headline is bold and inviting ("Where are you starting?"). The trip timeline celebrates each leg added with orange badges. The return screen (`hero-panel-return`) has a warm orange tint — coming home is a positive completion, not an escape.

---

## 2. Colour Application Rules

### Indigo (`#3730A3`) — Authority and Structure

Use indigo when the UI needs to communicate structure, progress, or brand identity.

| When | Where |
|---|---|
| ProgressBar background | Always `rgba(55,48,163,0.97)` |
| Hero panel borders and tint | `border-indigo-border`, gradient from `indigo-soft` |
| Active/current step indicators | Badge in TripTimeline, stop labels |
| `pill-brand` | IATA codes, stop count labels |
| Info boxes within hero panels | `bg-indigo-soft border-indigo-border text-indigo` |
| `btn-secondary` text | "Wrap up and fly home" — indigo text on indigo-soft bg |

**Screen-by-screen:** S2 FlightResults hero panel border, S3 StayDuration hero panel, S4 Decision pill-brand "Stop N", S5 ReturnFlights TripTimeline outbound badges, S6 Itinerary tab active state, S7 BookingReview header.

### Orange (`#F97316`) — Energy and Action

Use orange when the UI communicates prices, forward momentum, or the primary action.

| When | Where |
|---|---|
| All price values | Always `text-orange font-mono font-bold` |
| `btn-primary` background | Gradient from `#F97316` to `#EA6C0A` |
| Progress bar fill gradient | From orange to gold |
| Wordmark slash | The "/" in `FlexBook` |
| TripTimeline current leg | `bg-orange` badge, `bg-orange-soft` card |
| Running trip total | Right-aligned in "Trip so far" strip, `text-orange font-mono` |
| "Try next day" nudge text | `text-orange` — lightweight encouragement |

**Screen-by-screen:** Prices on S2/S5 flight cards, CTA buttons on every screen, total in S6 Itinerary header, all individual ticket prices in S7.

### Sky (`#0EA5E9`) — Routing Information

Use sky when communicating neutral flight routing data — stops, connections, flight path visualisation.

| When | Where |
|---|---|
| `pill-sky` | Stop count ("1 stop", "via VIE") |
| Route bar in ReturnFlightCard | `bg-gradient-to-r from-indigo to-sky` — half-pixel route bar |
| Body background ambient glow | Subtle top-left radial gradient in page background |

**Screen-by-screen:** S2 FlightCard stop pills, S5 ReturnFlightCard route bars, S3 "Stay and explore" pill-sky.

### Emerald (`#10B981`) — Positive Go Signal

Use emerald exclusively for direct/non-stop flight confirmation.

| When | Where |
|---|---|
| `pill-success` | "Direct" or "Non-stop" on FlightCard and ReturnFlightCard |
| No other use | Emerald is reserved — do not use it for general success states |

**Screen-by-screen:** S2 FlightCard direct badge, S5 ReturnFlightCard direct badge.

---

## 3. Hero Panel System

Every screen S2–S7 opens with a hero panel. The hero panel is the structural anchor of each screen — it contains the back button, screen label, title, and contextual info. There are exactly two variants.

### Variant 1 — `hero-panel` (Indigo-tinted)

Used on: S2, S3, S4, S6, S7

```
Background: linear-gradient(135deg,
  rgba(238,242,255,0.98) 0%,    ← indigo-soft at near-opaque
  rgba(240,244,255,0.95) 100%   ← bg color at near-opaque
)
Border: 1px solid #C7D2FE       ← indigo-border
Shadow: 0 16px 40px rgba(55,48,163,0.08)  ← indigo-tinted elevation
```

The indigo tint communicates **departure, discovery, forward motion**. Every screen where the user is building their outbound trip uses this variant.

### Variant 2 — `hero-panel-return` (Orange-tinted)

Used on: S5 (ReturnFlightsScreen) only

```
Background: linear-gradient(135deg,
  rgba(255,247,237,0.98) 0%,    ← orange-soft at near-opaque
  rgba(240,244,255,0.95) 100%   ← returns to bg color
)
Border: 1px solid rgba(249,115,22,0.25)   ← orange at 25% opacity
Shadow: 0 16px 40px rgba(249,115,22,0.08) ← orange-tinted elevation
```

### Why the return screen is different

The return screen is the emotional pivot of the user journey. The user has built an outbound adventure (cool indigo energy) and is now closing the loop to come home. The shift from indigo-tinted to orange-tinted is deliberate:

- **Indigo** = discovery, departure, the open road
- **Orange** = warmth, energy, action — but here also "home" — the return completes the journey

The visual shift is subtle (it is a tint shift, not a full color change) but users perceive the difference as a tonal change. It creates a moment of narrative resolution before they see the return flight options.

### Hero Panel Inner Structure

```
┌─────────────────────────────────────────────┐   ← hero-panel or hero-panel-return
│                                             │
│  [← Back]        SCREEN LABEL              │   ← small back button + section-label
│                                             │
│  Screen Title H2                            │   ← text-xl font-semibold text-text-primary
│  Subtitle or contextual info                │   ← text-sm text-text-muted
│                                             │
│  [Contextual element — pill / date nav /    │   ← varies per screen
│   info box / IATA pill]                     │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 4. Price Display Standards

Prices are the product's primary value signal. They must always be immediately recognisable and visually dominant.

### Rules

| Rule | Specification |
|---|---|
| Color | Always `text-orange` (`#F97316`) — no exceptions |
| Font | Always `font-mono` (JetBrains Mono) |
| Weight | Always `font-bold` (700) minimum; use `font-black` (900) for hero prices |
| Minimum size | Never smaller than `text-lg` (18px / 1.125rem) |
| Suffix | Always follow with "one way" or "estimated" in `text-xs text-text-xmuted` |
| Alignment | Right-aligned in card layouts; left-aligned in hero totals |
| Letter-spacing | `tracking-tight` (-0.025em) to compensate for monospace width |

### Price Rendering Pattern

```jsx
// Flight card price (right-aligned)
<div className="text-right">
  <div className="font-mono font-bold text-2xl text-orange tracking-tight">
    ${price}
  </div>
  <div className="text-xs text-text-xmuted">one way</div>
</div>

// Hero total price (left-aligned, larger)
<div>
  <span className="font-mono font-black text-3xl text-orange tracking-tight">
    ${total}
  </span>
  <span className="text-sm text-text-muted ml-2">estimated total</span>
</div>
```

### Screen-by-screen price sizes

| Screen | Context | Size | Weight |
|---|---|---|---|
| S2 FlightResultsScreen | Per-card price | `text-2xl` | `font-bold` |
| S4 DecisionScreen | TripTimeline running total | `text-base` | `font-bold` |
| S5 ReturnFlightsScreen | Per-card price | `text-2xl` | `font-bold` |
| S6 ItineraryScreen | Hero total | `text-3xl` | `font-black` |
| S6 ItineraryScreen | Per-leg price in timeline | `text-xl` | `font-bold` |
| S7 BookingReviewScreen | Header total + per-ticket | `text-2xl` / `text-xl` | `font-bold` |

---

## 5. Interactive States

All interactive elements follow a consistent state system. These are not suggestions — they are required for brand and accessibility compliance.

### State Definitions

| State | Visual treatment | CSS |
|---|---|---|
| Default | Standard appearance per component spec | — |
| Hover | Indigo border on cards/inputs; brightness on buttons | `border-indigo-border` / `filter: brightness(1.08)` |
| Active (press) | Scale down to 95% | `active:scale-95` |
| Focus | 4px indigo focus ring | `box-shadow: 0 0 0 4px rgba(79,70,229,0.12)` |
| Disabled | 40% opacity, cursor not-allowed | `opacity: 0.40; cursor: not-allowed` |

### By Component

**Buttons (all variants):**
```css
/* Active */
transform: scale(0.95);
transition: all 150ms;

/* Disabled */
opacity: 0.40;
cursor: not-allowed;

/* btn-primary hover */
filter: brightness(1.08);

/* btn-secondary hover */
background: rgba(79,70,229,0.12);
border-color: #4F46E5;

/* btn-outline hover */
border-color: #4F46E5;
color: #3730A3;
```

**Input fields:**
```css
/* Focus */
border-color: #4F46E5;
box-shadow: 0 4px 12px rgba(15,23,42,0.06), 0 0 0 4px rgba(79,70,229,0.12);
```

**Interactive cards (FlightCard, list-row):**
```css
/* Hover */
transform: translateY(-2px);
border-color: #C7D2FE;
box-shadow: 0 16px 40px rgba(15,23,42,0.12), 0 2px 0 rgba(255,255,255,0.9) inset;
```

**Date navigation arrows:**
```css
/* Hover */
border-color: #4F46E5;  /* indigo-mid */
color: #3730A3;          /* indigo */
```

### Focus Ring Standard

The 4px focus ring using `rgba(79,70,229,0.12)` is the universal focus indicator for this product. It is:
- Indigo-tinted (consistent with brand)
- Semi-transparent (appears on all backgrounds)
- 4px wide (exceeds WCAG 2.2 focus indicator minimum)
- Applied via `box-shadow` (does not affect layout)

---

## 6. Badge/Pill Language

Each pill variant has a specific communicative role. Using the wrong pill variant sends the wrong signal.

### Pill Variant Reference

| Variant | CSS class | Visual | Message | Example uses |
|---|---|---|---|---|
| Success | `pill-success` | Emerald bg, emerald text | "Go" signal — best routing outcome | "Direct", "Non-stop" |
| Sky | `pill-sky` | Sky bg, sky text | Neutral routing info — factual, not evaluative | "1 stop", "via VIE", stop count |
| Brand | `pill-brand` | Indigo-soft bg, indigo text | Identity or system-level information | IATA codes ("LIS"), "Stop 3", step labels |
| Warning | `pill-warning` | Orange-soft bg, orange-dark text | Action required or booking link | "Book ↗", price range |
| Default | `pill-default` | Surface-2 bg, muted text | Neutral metadata | Duration "1h 45m", nights "3 nights", "avg" |

### Decision Guide

```
Is it a direct flight?              → pill-success (emerald)
Is it routing info (stops, via)?    → pill-sky
Is it a brand/identity label?       → pill-brand (indigo)
Does it require user action?        → pill-warning (orange)
Is it neutral metadata?             → pill-default (grey)
```

### Example Usage Per Screen

**S2 FlightResultsScreen FlightCard:**
```
[Direct ●]    → pill-success    (routing quality)
[LIS]         → pill-brand      (IATA destination code)
[1 stop]      → pill-sky        (routing info)
[1h 45m]      → pill-default    (metadata)
```

**S3 StayDurationScreen hero panel:**
```
[Stay and explore]  → pill-sky   (neutral context, not evaluative)
```

**S4 DecisionScreen hero panel:**
```
[Stop 2]    → pill-brand   (step identity in the journey)
```

**S5 ReturnFlightsScreen hero panel:**
```
[Way home]  → pill-warning  (action context — this is the return booking action)
```

---

## 7. Screen Colour Moods

The app uses a deliberate colour narrative across its 7 screens. This is not decoration — it is spatial storytelling.

### The Mood Map

```
S1  HomeScreen          Neutral / open
    Background: bg (#F0F4FF) + ambient indigo/sky glows
    No hero panel. Pure white space with soft ambient lighting.
    Mood: "Where will you go?" — possibility, openness

S2  FlightResultsScreen  Indigo / departure
    hero-panel (indigo-tinted border + bg)
    Mood: "You're planning your first flight." — authority, structure

S3  StayDurationScreen   Indigo / pause
    hero-panel (indigo-tinted)
    pill-sky "Stay and explore"
    Mood: "You've landed. Now decide how long." — calm, exploratory

S4  DecisionScreen       Indigo / decision
    hero-panel (indigo-tinted)
    pill-brand "Stop N" in orange-soft info box
    Mood: "Next move?" — focused, deliberate

S5  ReturnFlightsScreen  Orange / return
    hero-panel-return (orange-tinted)
    Mood: "You're going home." — warm, complete, earned

S6  ItineraryScreen      Indigo / review
    hero-panel (indigo-tinted) with orange total
    Mood: "Your adventure, laid out." — structured, celebratory

S7  BookingReviewScreen  Indigo / commit
    hero-panel (indigo-tinted)
    Mood: "Time to book." — decisive, trustworthy
```

### The Indigo → Orange → Indigo Arc

```
S1  [neutral]
S2  [indigo — outbound departure]
S3  [indigo — outbound stay]
S4  [indigo — outbound decision]
S5  [ORANGE — return pivot]  ← the emotional turning point
S6  [indigo — review complete trip]
S7  [indigo — commit to booking]
```

The single orange screen (S5) is intentional. It creates a visual moment that marks the end of the outbound journey and the beginning of the return. Users who have gone through the flow several times will recognise this shift as a meaningful signal.

---

## 8. Typography Hierarchy in Practice

For each screen, here is how the type roles map to actual UI elements.

### S1 — HomeScreen

| Role | Text | Style |
|---|---|---|
| Wordmark | `FlexBook` | Inter 900, tracking -0.05em, indigo + orange |
| Display XL (H1) | "Where are you starting?" | 3.4rem, font-black, "starting?" in text-indigo |
| Tagline | "Your trip. Your rules. Your price." | text-sm, text-text-muted |
| Section Label | "START FROM" / "NEARBY AIRPORTS" | section-label class |
| Body | Airport name in result row | text-sm text-text-secondary |
| Mono Code | IATA code (e.g. "EVN") | font-mono text-xs text-indigo-mid |

### S2 — FlightResultsScreen

| Role | Text | Style |
|---|---|---|
| Hero Label | "FLIGHT RESULTS" | section-label, mono, text-indigo-mid |
| H2 | "Flights from Yerevan" | text-xl font-semibold |
| H3 (card) | City name "Lisbon" | text-xl font-bold text-text-primary |
| Price | "$34" | text-2xl font-mono font-bold text-orange |
| Suffix | "one way" | text-xs text-text-xmuted |
| Metadata | "06:00 → 07:45 · 1h 45m" | text-xs font-mono text-text-secondary |

### S3 — StayDurationScreen

| Role | Text | Style |
|---|---|---|
| H2 | "How long do you want to explore Lisbon?" | text-xl font-semibold |
| Hero sub | "Lisbon, Portugal" | text-sm text-text-muted |
| Stepper number | "3" | text-6xl font-bold font-mono |
| CTA | "Stay 3 nights and continue" | btn-primary (white semibold) |

### S4 — DecisionScreen

| Role | Text | Style |
|---|---|---|
| H2 | "Lisbon feels like a good chapter." | text-xl font-semibold |
| Info text | "Next departure: Apr 9" | text-sm text-text-secondary |
| Total label | "TRIP SO FAR" | section-label |
| Total price | "$107" | text-base font-mono font-bold text-orange |

### S5 — ReturnFlightsScreen

| Role | Text | Style |
|---|---|---|
| H2 | "Ready to close the loop?" | text-xl font-semibold |
| Sub | "Budapest → Yerevan" | text-sm text-text-muted |
| Price | "$115" | text-2xl font-mono font-bold text-orange |
| Route bar label | "BUD ═══════════ EVN" | font-mono text-xs with gradient bar |

### S6 — ItineraryScreen

| Role | Text | Style |
|---|---|---|
| Hero Label | "YOUR ROUTE IS READY" | section-label, text-indigo-mid mono |
| H2 | "Your trip · 3 flights" | text-xl font-semibold |
| Hero Total | "$222" | text-3xl font-mono font-black text-orange |
| Total suffix | "estimated total" | text-sm text-text-muted |
| Leg label | "Stop 1" | orange badge, text-white text-xs font-bold |

### S7 — BookingReviewScreen

| Role | Text | Style |
|---|---|---|
| Hero Label | "BOOKING REVIEW" | section-label, text-indigo-mid mono |
| H2 | "Ready to book your trip" | text-xl font-semibold |
| Total | "$222" | text-2xl font-mono font-bold text-orange |
| Ticket label | "TICKET 1" | section-label |
| Route label | "EVN → LIS" | font-mono text-indigo |
| CTA | "Book this flight ↗" | btn-primary |

---

## 9. Motion Brand Values

Motion in FlexBook is governed by three values. Any animation that violates these values should be removed.

### Fast (≤220ms for all interactive transitions)

Standard transitions are 150ms (`duration-150`). Card and screen entrances are 220ms (`animate-fade-in`). Nothing exceeds 280ms except the DatePickerOverlay enter animation.

**Why:** Users are making quick decisions — date comparisons, flight selections, city choices. Slow animations create friction between intent and action.

**Rule:** If an animation lasts longer than 280ms, it must be justified by the complexity of the transition (e.g. an overlay entering from off-screen). If it is a state change or a feedback animation, cap it at 150ms.

### Purposeful (every animation communicates meaning)

| Animation | Meaning |
|---|---|
| `fadeSlideUp` on FlightCard | "This card arrived from a fresh data fetch" |
| `shimmer` on skeleton | "Content is loading — I know where it will be" |
| `scaleIn` on ProgressBar badge | "Your progress has been recorded" |
| `float` on compass icon | "This is a live, active interface — not a static page" |
| `translateY(-2px)` on card hover | "This item is interactive — you can tap it" |
| `scale(0.95)` on button press | "Your action has been received" |

**Rule:** Do not add animations for visual interest. Every animation must communicate a state change, a data arrival, or an interaction confirmation.

### Interruptible (no blocking animations)

All animations in FlexBook are cosmetic — they can be interrupted by the user at any point without consequence. There are no animation locks, no "wait for animation to complete" patterns, no sequences that must finish before the next action is available.

**Rule:** Never gate user interaction behind an animation completing. The date navigation debounce is a data concern (avoid excessive API calls), not an animation lock.

**Reduced motion:** All animations collapse to `0.01ms` via the global media query. The product is fully functional without any animation.

---

## 10. Brand Consistency Checklist

Run through this list before shipping any new screen or component. It covers the most common brand deviations found in PRs.

### Visual Tokens

- [ ] **1. Prices are orange, mono, bold, ≥18px.** Check every instance of a monetary value. `text-orange font-mono font-bold text-lg` minimum.

- [ ] **2. Hero panel variant is correct.** Outbound screens (S2–S4, S6–S7) use `.hero-panel`. Return screen (S5) uses `.hero-panel-return`. HomeScreen has no panel.

- [ ] **3. Direct flight badge is `pill-success` (emerald).** Not `pill-sky`, not `pill-brand`. Emerald = go signal.

- [ ] **4. Section labels use `.section-label` class.** Not inline `text-[0.7rem] font-bold tracking-[...]`. The class exists — use it.

- [ ] **5. The wordmark slash is orange.** In every rendering of `FlexBook`, the "/" is `text-orange`. White in reversed variant, never grey or indigo.

### Layout and Spacing

- [ ] **6. Interactive touch targets are ≥48×48px.** Arrow buttons, close buttons, back buttons — all need at least 48px hit area via padding if the visual is smaller.

- [ ] **7. Cards use `.card` class, not custom border/shadow.** The card box-shadow includes the white inset highlight. Custom cards will look flat and inconsistent.

- [ ] **8. The ProgressBar is present on S2–S6 and absent on S1 and S7.** Check `App.tsx` visibility logic. The ProgressBar is rendered by the parent, not the screen.

### Interaction

- [ ] **9. All buttons have `active:scale-95`.** Check that the `btn-primary`, `btn-secondary`, and `btn-outline` classes are used — not custom styled buttons.

- [ ] **10. Input focus ring is 4px indigo.** If using a custom input, add `box-shadow: 0 0 0 4px rgba(79,70,229,0.12)` on `:focus`.

### Typography

- [ ] **11. IATA codes use `font-mono`.** `EVN`, `LIS`, `BUD` in the ProgressBar, TripTimeline, and flight cards must be monospace.

- [ ] **12. Section label text is ALL CAPS.** The `.section-label` class handles this via `text-transform: uppercase`. If overriding, ensure uppercase is preserved.

### Animation

- [ ] **13. New cards/items use `animate-fade-in` with stagger.** If displaying a list of results, each item should have `animate-fade-in` with a `style={{ animationDelay: '${i * 30}ms' }}`.

- [ ] **14. No animation exceeds 280ms** unless it is a sheet/overlay entering from off-screen.

### Accessibility

- [ ] **15. `prefers-reduced-motion` is handled.** No new `animation:` or `transition:` properties added in component CSS — rely on Tailwind utilities which are covered by the global media query in `index.css`.
