# FlexBook — Developer Implementation Guide

> **Version:** 1.0 · **Date:** 2026-04-05 · **Status:** Active source of truth
>
> This guide is for developers building new screens, components, or features. It covers practical patterns, code examples, and common mistakes. Read DESIGN_SYSTEM.md for token values and BRAND_IMPLEMENTATION.md for brand intent.

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [CSS Class Reference](#2-css-class-reference)
3. [Tailwind Token Reference](#3-tailwind-token-reference)
4. [Component Patterns](#4-component-patterns)
5. [Screen Shell Template](#5-screen-shell-template)
6. [FlightCard Usage](#6-flightcard-usage)
7. [TripTimeline Usage](#7-triptimeline-usage)
8. [Skeleton Patterns](#8-skeleton-patterns)
9. [Animation Application](#9-animation-application)
10. [Accessibility Checklist](#10-accessibility-checklist)
11. [Common Mistakes](#11-common-mistakes)
12. [File Locations](#12-file-locations)

---

## 1. Quick Start

### 3 steps to add a new screen following the design system

**Step 1 — Create the screen file**

Create `frontend/src/screens/MyNewScreen.tsx`. Every screen is a single default-exported function. The ProgressBar is rendered by `App.tsx` — never render it inside a screen.

```tsx
// frontend/src/screens/MyNewScreen.tsx
export function MyNewScreen() {
  return (
    <div className="px-4 pt-4 pb-24 flex flex-col gap-4">
      <div className="hero-panel">
        {/* Screen header content */}
      </div>
      {/* Screen body */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-8 max-w-[448px] mx-auto">
        <button className="btn-primary">Continue</button>
      </div>
    </div>
  );
}
```

**Step 2 — Register the screen in App.tsx**

Add the screen name to the store's screen type and render it in `App.tsx`:

```tsx
// In App.tsx, add to the screen conditional rendering:
{screen === 'my-new-screen' && <MyNewScreen />}
```

**Step 3 — Add navigation**

Use `useSessionStore` to navigate:

```tsx
const setScreen = useSessionStore((s) => s.setScreen);
// ...
<button className="btn-primary" onClick={() => setScreen('my-new-screen')}>
  Go to new screen
</button>
```

The ProgressBar visibility and the screen's container class (`h-screen flex flex-col overflow-hidden` vs `min-h-screen`) are handled in `App.tsx` — update the relevant condition there if the new screen needs the locked-scroll layout (like FlightResultsScreen).

---

## 2. CSS Class Reference

All custom classes are defined in `frontend/src/index.css` under `@layer components`. Tailwind utility classes are available everywhere — these are only the custom named classes.

### Button Classes

| Class | Description | Use when |
|---|---|---|
| `.btn-primary` | Full-width orange gradient button, white semibold text, CTA shadow | Primary forward-progress action |
| `.btn-secondary` | Full-width indigo-soft background, indigo text, indigo-border border | Soft alternative (e.g. "Fly home") |
| `.btn-outline` | Full-width frosted white background, default border | Back nav or non-committal action |

All button classes include: `w-full text-center font-semibold py-3.5 px-6 rounded-2xl active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed`

You do not need to add these utilities manually — they are baked into the class definitions.

### Card and Container Classes

| Class | Description | Use when |
|---|---|---|
| `.card` | White surface, 20px radius, shadow-3 with inset, indigo-border hover | Any information container |
| `.section-shell` | White surface, 24px radius, shadow-section | Grouping related input/result items |
| `.hero-panel` | Indigo-tinted gradient panel, 28px radius | Screen header on outbound screens (S2–S4, S6, S7) |
| `.hero-panel-return` | Orange-tinted gradient panel, 28px radius | Screen header on S5 only |
| `.list-row` | White surface, 20px radius, translateY hover, indigo-border hover | Tappable list items inside section-shell |

### Input Class

| Class | Description | Use when |
|---|---|---|
| `.input-field` | White input, 16px radius, shadow-2, 4px indigo focus ring | Text input fields |

### Pill Classes

| Class | Description | Message |
|---|---|---|
| `.pill` | Base pill — inline-flex, rounded-full, px-3 py-1, text-xs font-semibold | (base — do not use alone) |
| `.pill-default` | Surface-2 bg, muted text, default border | Neutral metadata |
| `.pill-brand` | Indigo-soft bg, indigo text, indigo border | Identity, IATA, step labels |
| `.pill-success` | Emerald-soft bg, emerald text, emerald border | Direct/non-stop flight |
| `.pill-warning` | Orange-soft bg, orange-dark text, orange border | Action required, booking |
| `.pill-sky` | Sky-soft bg, sky text, sky border | Routing info, stop count |

### Label and Skeleton Classes

| Class | Description |
|---|---|
| `.section-label` | 0.7rem, 700, tracking-[0.22em], uppercase, text-muted |
| `.skeleton` | Shimmer gradient background, rounded-xl, animated |

---

## 3. Tailwind Token Reference

Every custom color token defined in `frontend/tailwind.config.js`. Use these as Tailwind class suffixes: `bg-{token}`, `text-{token}`, `border-{token}`.

### Background Tokens

| Token | Hex | Tailwind class |
|---|---|---|
| `bg` | `#F0F4FF` | `bg-bg` |
| `surface` | `#FFFFFF` | `bg-surface` |
| `surface-2` | `#EEF1F8` | `bg-surface-2` |
| `indigo` | `#3730A3` | `bg-indigo` |
| `indigo-mid` | `#4F46E5` | `bg-indigo-mid` |
| `indigo-soft` | `#EEF2FF` | `bg-indigo-soft` |
| `orange` | `#F97316` | `bg-orange` |
| `orange-dark` | `#EA6C0A` | `bg-orange-dark` |
| `orange-soft` | `#FFF7ED` | `bg-orange-soft` |
| `sky` | `#0EA5E9` | `bg-sky` |
| `sky-soft` | `#E0F2FE` | `bg-sky-soft` |
| `emerald` | `#10B981` | `bg-emerald` |
| `emerald-soft` | `#D1FAE5` | `bg-emerald-soft` |
| `gold` | `#F59E0B` | `bg-gold` |
| `error` | `#EF4444` | `bg-error` |
| `error-soft` | `#FEE2E2` | `bg-error-soft` |

### Text Tokens

| Token | Hex | Tailwind class |
|---|---|---|
| `text-primary` | `#0F172A` | `text-text-primary` |
| `text-secondary` | `#334155` | `text-text-secondary` |
| `text-muted` | `#64748B` | `text-text-muted` |
| `text-xmuted` | `#94A3B8` | `text-text-xmuted` |

### Border Tokens

| Token | Hex | Tailwind class |
|---|---|---|
| `border` | `#E2E8F0` | `border-border` |
| `border-strong` | `#CBD5E1` | `border-border-strong` |
| `border-brand` | `#C7D2FE` | `border-border-brand` |
| `indigo-border` | `#C7D2FE` | `border-indigo-border` |

### Font Family Tokens

| Token | Stack | Tailwind class |
|---|---|---|
| `sans` | Inter, system-ui, sans-serif | `font-sans` (default) |
| `mono` | JetBrains Mono, Fira Code, monospace | `font-mono` |

### Animation Tokens

| Token | Definition | Tailwind class |
|---|---|---|
| `fade-in` | fadeSlideUp 220ms ease-out | `animate-fade-in` |
| `scale-in` | scaleIn 220ms ease-out | `animate-scale-in` |
| `shimmer` | shimmer 1.6s ease-in-out infinite | `animate-shimmer` (via `.skeleton`) |
| `float` | float 8s ease-in-out infinite | `animate-float` |

---

## 4. Component Patterns

### Hero Panel Header

```tsx
<div className="hero-panel mb-4">
  {/* Back button row */}
  <div className="flex items-center gap-3 mb-4">
    <button
      className="w-8 h-8 flex items-center justify-center rounded-xl
                 bg-white/60 border border-indigo-border hover:bg-white
                 transition-all duration-150"
      onClick={() => setScreen('previous-screen')}
      aria-label="Go back"
    >
      <ArrowLeft size={16} className="text-text-secondary" />
    </button>
    <span className="section-label font-mono text-indigo-mid tracking-wider">
      SCREEN LABEL
    </span>
  </div>

  {/* Title */}
  <h2 className="text-xl font-semibold text-text-primary mb-1">
    Screen Title
  </h2>
  <p className="text-sm text-text-muted">Subtitle or contextual info</p>

  {/* Optional: pill or date nav */}
  <div className="mt-3">
    <span className="pill-brand">LIS</span>
  </div>
</div>
```

### Card with Hover

```tsx
<div className="card hover:-translate-y-0.5 hover:border-indigo-border
                hover:shadow-[0_16px_40px_rgba(15,23,42,0.12)]
                transition-all duration-150 cursor-pointer"
     onClick={handleClick}>
  <h3 className="text-base font-semibold text-text-primary mb-1">
    Card Title
  </h3>
  <p className="text-sm text-text-secondary">Card description</p>
</div>
```

For interactive cards that are `<button>` elements (like FlightCard), the hover styles should be on the button element:

```tsx
<button
  className="card w-full text-left transition-all duration-150
             active:scale-[0.98] hover:-translate-y-0.5
             hover:border-indigo-border
             hover:shadow-[0_16px_40px_rgba(15,23,42,0.12)]"
  onClick={handleClick}
>
  {/* card content */}
</button>
```

### Pill Badge

```tsx
{/* Direct flight */}
<span className="pill-success">Direct</span>

{/* Stop count */}
<span className="pill-sky">2 stops</span>

{/* IATA code */}
<span className="pill-brand">LIS</span>

{/* With icon */}
<span className="pill-warning">
  <ExternalLink size={10} />
  Book ↗
</span>

{/* Neutral metadata */}
<span className="pill-default">3 nights</span>
```

### Section Label + Content Shell

```tsx
<div className="section-shell px-5 py-4 flex flex-col gap-3">
  <p className="section-label">NEARBY AIRPORTS</p>

  {airports.map((airport) => (
    <button
      key={airport.iata}
      className="list-row"
      onClick={() => handleSelect(airport)}
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-text-primary">
            {airport.city.name}
          </span>
          <span className="text-xs text-text-muted ml-2">
            {airport.name}
          </span>
        </div>
        <span className="font-mono text-xs font-semibold text-indigo-mid
                         bg-indigo-soft px-2 py-0.5 rounded-full">
          {airport.iata}
        </span>
      </div>
    </button>
  ))}
</div>
```

### Date Nav Row

```tsx
<div className="flex items-center gap-2">
  {/* Previous day */}
  <button
    className="w-12 h-12 flex items-center justify-center
               bg-white border border-border rounded-2xl
               hover:border-indigo-mid hover:text-indigo
               transition-all duration-150 shrink-0"
    onClick={() => shiftDate(-1)}
    aria-label="Previous day"
  >
    <ChevronLeft size={18} />
  </button>

  {/* Date display */}
  <button
    className="flex-1 h-12 flex items-center gap-2 px-4
               bg-white border border-border rounded-2xl
               hover:border-indigo-mid transition-all duration-150"
    onClick={() => setShowCalendar(true)}
    aria-label="Open date picker"
  >
    <Calendar size={15} className="text-text-muted" />
    <span className="text-sm font-medium text-text-primary">{formattedDate}</span>
    <span className="text-xs text-text-muted ml-auto">Departing</span>
  </button>

  {/* Next day */}
  <button
    className="w-12 h-12 flex items-center justify-center
               bg-white border border-border rounded-2xl
               hover:border-indigo-mid hover:text-indigo
               transition-all duration-150 shrink-0"
    onClick={() => shiftDate(1)}
    aria-label="Next day"
  >
    <ChevronRight size={18} />
  </button>
</div>
```

### Trip Total Display

```tsx
{/* "Trip so far" strip header */}
<div className="flex items-center justify-between px-4 mb-2">
  <p className="section-label">TRIP SO FAR</p>
  <span className="font-mono font-bold text-base text-orange">
    {formatPrice(totalPrice(legs))}
  </span>
</div>

{/* Hero panel total */}
<div className="flex items-baseline gap-2 mt-2">
  <span className="font-mono font-black text-3xl text-orange tracking-tight">
    {formatPrice(total)}
  </span>
  <span className="text-sm text-text-muted">estimated total</span>
</div>
```

---

## 5. Screen Shell Template

The exact JSX structure every screen should follow. ProgressBar is rendered by `App.tsx` — screens start from the content below it.

### Standard Screen (scrollable)

```tsx
export function MyScreen() {
  return (
    // Container — px-4 horizontal padding, top padding after ProgressBar,
    // pb-24 to clear fixed CTA zone at bottom
    <div className="px-4 pt-4 pb-24 flex flex-col gap-4">

      {/* Hero panel */}
      <div className="hero-panel">
        {/* back button + label + title */}
      </div>

      {/* [Conditional] TripTimeline strip */}
      {legs.length >= 1 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="section-label">TRIP SO FAR</p>
            <span className="font-mono font-bold text-base text-orange">
              {formatPrice(total)}
            </span>
          </div>
          <TripTimeline legs={legs} highlightLast={true} />
        </div>
      )}

      {/* Screen-specific body content */}
      <div className="flex flex-col gap-3">
        {/* content */}
      </div>

      {/* Fixed CTA zone */}
      <div className="fixed bottom-0 left-0 right-0 max-w-[448px] mx-auto px-4 pb-8 pt-3
                      bg-gradient-to-t from-bg via-bg/95 to-transparent flex flex-col gap-3">
        <button className="btn-primary">Primary Action</button>
        <button className="btn-outline">Secondary / Back</button>
      </div>

    </div>
  );
}
```

### Locked-scroll Screen (FlightResults layout)

Used only for screens where the card list must scroll independently while the header is fixed. Currently only `FlightResultsScreen`.

```
App.tsx sets the container to:
  'h-screen bg-bg max-w-[448px] mx-auto flex flex-col overflow-hidden'
```

The screen then uses:

```tsx
export function FlightResultsScreen() {
  return (
    <>
      {/* Fixed header — does not scroll */}
      <div className="shrink-0 px-4 pt-4 pb-3">
        <div className="hero-panel">
          {/* ... */}
        </div>
        {/* TripTimeline strip */}
      </div>

      {/* Scrollable results list */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 flex flex-col gap-3">
        {flights.map((flight, i) => (
          <FlightCard key={flight.id} flight={flight} ... />
        ))}
      </div>
    </>
  );
}
```

---

## 6. FlightCard Usage

### FlightCard Props

```tsx
interface Props {
  flight: FlightOption;       // Required — flight data from the API
  weather?: WeatherSummary;   // Optional — per-destination weather
  onSelect: (flight: FlightOption) => void;  // Required — tap handler
}
```

### When to use FlightCard

Use `FlightCard` (from `components/FlightCard.tsx`) on the **FlightResultsScreen (S2)** only. It is designed for destination-discovery — the city name is the primary heading, price is secondary but prominent.

```tsx
import { FlightCard, FlightCardSkeleton } from '../components/FlightCard';

// Loading state
{isLoading && Array.from({ length: 10 }).map((_, i) => (
  <FlightCardSkeleton key={i} />
))}

// Loaded state
{!isLoading && flights.map((flight, i) => (
  <FlightCard
    key={flight.id}
    flight={flight}
    weather={weatherMap[flight.destinationIata]}
    onSelect={handleFlightSelect}
    style={{ animationDelay: `${i * 30}ms` }}
    className="animate-fade-in"
  />
))}
```

### When to use ReturnFlightCard

Use `ReturnFlightCard` (from `components/ReturnFlightCard.tsx`) on the **ReturnFlightsScreen (S5)** only.

```tsx
interface Props {
  flight: FlightOption;       // Required
  onSelect: (flight: FlightOption) => void;  // Required
}
```

Key differences from FlightCard:
- No `weather` prop — weather is not shown on return flights
- Route bar is the visual focus (IATA chain with indigo-to-sky gradient)
- Maximum 3 results shown (not 10)
- The price is right-aligned in the top row, not in the center block

```tsx
import { ReturnFlightCard, ReturnFlightCardSkeleton } from '../components/ReturnFlightCard';

{isLoading && Array.from({ length: 3 }).map((_, i) => (
  <ReturnFlightCardSkeleton key={i} />
))}

{!isLoading && flights.slice(0, 3).map((flight, i) => (
  <ReturnFlightCard
    key={flight.id}
    flight={flight}
    onSelect={handleReturnSelect}
    style={{ animationDelay: `${i * 30}ms` }}
    className="animate-fade-in"
  />
))}
```

---

## 7. TripTimeline Usage

`TripTimeline` is in `components/TripTimeline.tsx`.

```tsx
interface Props {
  legs: TripLeg[];
  highlightLast?: boolean;   // Default: true
}
```

The component automatically filters out the return leg (only shows outbound legs). It returns `null` if there are no outbound legs — no need to guard it externally.

The component auto-scrolls to the newest leg when `legs.length` changes.

### `highlightLast=true` vs `highlightLast=false`

| Value | Effect | When to use |
|---|---|---|
| `true` (default) | Last leg card has orange badge + orange-soft background | When the last confirmed leg is the one being highlighted (S2, S4) |
| `false` | All legs have indigo badge + indigo-soft background — no leg stands out | When the trip is in a neutral state (S3 — leg not yet confirmed; S5 — labeled "Outbound trip") |

### Visibility per screen

| Screen | Show TripTimeline when | `highlightLast` |
|---|---|---|
| S2 FlightResultsScreen | `legs.filter(l => !l.isReturn).length >= 1` | `true` |
| S3 StayDurationScreen | `legs.filter(l => !l.isReturn).length >= 1` | `false` |
| S4 DecisionScreen | Always (≥1 leg by definition) | `true` |
| S5 ReturnFlightsScreen | Always (≥1 leg by definition) | `false` |

```tsx
// S2 usage
{outboundLegs.length >= 1 && (
  <TripTimeline legs={legs} highlightLast={true} />
)}

// S3 usage
{outboundLegs.length >= 1 && (
  <TripTimeline legs={legs} highlightLast={false} />
)}

// S5 usage (always shown)
<TripTimeline legs={legs} highlightLast={false} />
```

---

## 8. Skeleton Patterns

Skeletons must match the card anatomy they are replacing. When cards load in, spatial memory (the skeleton's dimensions) makes the transition feel smooth rather than jumpy.

### Rules

1. Each skeleton block uses the `.skeleton` class — never `animate-pulse` alone on a div
2. Skeleton dimensions should match the real content dimensions as closely as possible
3. Rounded corners: `rounded` for text blocks, `rounded-full` for pill-shaped elements
4. Wrap the whole skeleton in `.card` with `space-y-{n}` for the same card container

### FlightCard Skeleton

Matches the 3-row anatomy of FlightCard:
- Row 1: airline text + two pill-shaped badges
- Row 2: city text block (large) + price block (right)
- Row 3: times line

```tsx
export function FlightCardSkeleton() {
  return (
    <div className="card space-y-3">
      {/* Row 1: airline + pills */}
      <div className="flex items-center gap-2">
        <div className="skeleton h-3 w-20 rounded" />
        <div className="skeleton h-5 w-14 rounded-full" />
        <div className="skeleton h-5 w-18 rounded-full" />
      </div>
      {/* Row 2: city + price */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="skeleton h-7 w-36 rounded" />    {/* city name */}
          <div className="skeleton h-5 w-10 rounded-full" /> {/* IATA pill */}
        </div>
        <div className="skeleton h-8 w-16 rounded" />    {/* price */}
      </div>
      {/* Row 3: times */}
      <div className="skeleton h-4 w-48 rounded" />
    </div>
  );
}
```

### ReturnFlightCard Skeleton

Matches the 3-row anatomy of ReturnFlightCard:
- Row 1: airline + pill (left), price (right)
- Row 2: route bar (IATA + line + IATA)
- Row 3: departure + arrival times

```tsx
export function ReturnFlightCardSkeleton() {
  return (
    <div className="card space-y-4">
      {/* Row 1 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-5 w-16 rounded-full" />
        </div>
        <div className="skeleton h-7 w-14 rounded" />
      </div>
      {/* Row 2: route bar */}
      <div className="flex items-center gap-2">
        <div className="skeleton h-4 w-10 rounded" />    {/* origin IATA */}
        <div className="skeleton h-0.5 flex-1 rounded-full" /> {/* bar */}
        <div className="skeleton h-4 w-10 rounded" />    {/* destination IATA */}
      </div>
      {/* Row 3: times */}
      <div className="flex items-center justify-between">
        <div className="skeleton h-4 w-32 rounded" />
        <div className="skeleton h-3 w-12 rounded" />
      </div>
    </div>
  );
}
```

### Custom Skeleton for a New Card

When writing a skeleton for a new component, trace the actual card layout first:

```
1. Identify how many visual rows the card has
2. For each row, identify:
   - Which elements are text? → skeleton h-{height} w-{width} rounded
   - Which are pill/badge? → skeleton h-5 w-{width} rounded-full
   - Which are image/icon? → skeleton h-{size} w-{size} rounded (or rounded-full)
3. Wrap the whole thing in .card space-y-{gap}
4. Use .skeleton class — not custom background colors
```

---

## 9. Animation Application

### `animate-fade-in`

Apply to any element that appears as a result of a data load or screen transition.

```tsx
// Single element
<div className="card animate-fade-in">...</div>

// List with stagger
{items.map((item, i) => (
  <div
    key={item.id}
    className="card animate-fade-in"
    style={{ animationDelay: `${i * 30}ms` }}
  >
    ...
  </div>
))}
```

Maximum stagger delay: 10 items × 30ms = 270ms total spread. Do not stagger more than 10 items.

### `animate-scale-in`

Apply to elements that pop in as an update or confirmation — not as a list entrance.

```tsx
// ProgressBar badge update
<span className="pill-brand animate-scale-in">Stop {stopCount}</span>

// Modal/overlay entry
<div className="hero-panel animate-scale-in">...</div>
```

### `animate-float`

Apply to ambient decorative elements only. Currently used on the compass icon on HomeScreen.

```tsx
<div className="animate-float">
  <Compass size={28} className="text-indigo-mid" />
</div>
```

Do not apply to interactive elements — floating interactive elements are confusing.

### Stagger with CSS Variables (advanced)

For precise stagger control when generating styles dynamically:

```tsx
<div
  className="animate-fade-in"
  style={{ animationDelay: `${index * 30}ms`, animationFillMode: 'both' }}
>
```

`animationFillMode: 'both'` ensures the element starts invisible and stays visible after the animation — prevents flash-of-content before the delay resolves.

### Transition Classes

For interactive state transitions (hover, focus, active), always use `transition-all duration-150`:

```tsx
<button className="btn-primary transition-all duration-150">...</button>
// btn-primary already includes this — don't add it again

// For custom interactive elements:
<div className="border border-border hover:border-indigo-border
                transition-all duration-150">
```

---

## 10. Accessibility Checklist

### aria-labels on icon-only buttons

Any button that contains only an icon (no visible text) must have an `aria-label`:

```tsx
// Wrong
<button onClick={goBack}><ArrowLeft size={16} /></button>

// Correct
<button
  onClick={goBack}
  aria-label="Go back to flight options"
>
  <ArrowLeft size={16} />
</button>

// Date navigation
<button
  onClick={() => shiftDate(-1)}
  aria-label="Previous day"
>
  <ChevronLeft size={18} />
</button>

<button
  onClick={() => shiftDate(1)}
  aria-label="Next day"
>
  <ChevronRight size={18} />
</button>
```

### Focus rings

The `.input-field` class has the 4px indigo focus ring built in. For custom interactive elements, add it manually:

```tsx
// Custom focusable element
<div
  tabIndex={0}
  className="card cursor-pointer focus:outline-none"
  style={{ '--focus-ring': '0 0 0 4px rgba(79,70,229,0.12)' } as React.CSSProperties}
  onFocus={(e) => e.currentTarget.style.boxShadow = '0 0 0 4px rgba(79,70,229,0.12)'}
  onBlur={(e) => e.currentTarget.style.boxShadow = ''}
>
```

Or use Tailwind's `focus:ring` utilities for simpler cases:

```tsx
<button className="btn-primary focus:ring-4 focus:ring-indigo/20 focus:outline-none">
```

### Touch targets

All interactive elements must have a minimum tap target of 48×48px. If the visual is smaller, add padding:

```tsx
// Visual 16px icon, 48px tap target
<button
  className="w-12 h-12 flex items-center justify-center rounded-xl
             hover:bg-indigo-soft transition-colors"
  aria-label="Close"
>
  <X size={16} />
</button>

// ❌ Wrong — 24px tap target
<button className="p-1" aria-label="Close">
  <X size={16} />
</button>
```

### Reduced motion

Never write new `@keyframes` or custom CSS `animation:` properties. Use only Tailwind animation utilities (`animate-fade-in`, `animate-scale-in`) — these are automatically disabled by the global `prefers-reduced-motion` rule in `index.css`.

If you must write a custom CSS transition in a component's inline style, guard it:

```tsx
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

<div style={{
  transition: prefersReducedMotion ? 'none' : 'transform 150ms ease-out'
}}>
```

### Semantic HTML

Use the correct HTML element for the job — it provides built-in accessibility:

```tsx
// Navigation between screens → use <button>
<button onClick={() => setScreen('home')}>Back</button>

// External booking link → use <a>
<a
  href={bookingUrl}
  target="_blank"
  rel="noopener noreferrer"
  aria-label={`Book ${flight.airlineName} flight — opens in new tab`}
  className="btn-primary"
>
  Book this flight ↗
</a>

// Card that is interactive → use <button>
<button className="card w-full text-left" onClick={handleSelect}>

// Section heading → use <h2>, <h3> in correct hierarchy
<h2 className="text-xl font-semibold">Flights from Yerevan</h2>
```

### Meaningful link text for booking

Screen reader users tab through all links. Avoid "click here" or bare "$34":

```tsx
// Wrong
<a href={url} className="btn-primary">Book ↗</a>

// Correct
<a
  href={url}
  aria-label={`Book ${airlineName} flight to ${city} for ${formatPrice(price)}`}
  className="btn-primary"
>
  Book this flight ↗
</a>
```

---

## 11. Common Mistakes

### Mistake 1 — Using `text-text-primary` for prices

**Wrong:** `<span className="text-text-primary font-bold text-2xl">{price}</span>`

**Fix:** `<span className="text-orange font-mono font-bold text-2xl">{price}</span>`

Prices are always orange. This is not a style preference — it is a brand requirement.

---

### Mistake 2 — Using `text-indigo` for prices

**Wrong:** `<span className="text-indigo font-mono font-bold">{price}</span>`

**Fix:** `<span className="text-orange font-mono font-bold">{price}</span>`

Indigo is for structure and authority, orange is for prices and actions.

---

### Mistake 3 — Rendering ProgressBar inside a screen

**Wrong:** `<ProgressBar />` inside `FlightResultsScreen.tsx`

**Fix:** ProgressBar is rendered exactly once, in `App.tsx`. It reads its own visibility state from the store. Never import or render it in a screen component.

---

### Mistake 4 — Using `hero-panel-return` on outbound screens

**Wrong:** Using `hero-panel-return` on S2, S3, S4, S6, or S7.

**Fix:** `hero-panel-return` is for S5 (ReturnFlightsScreen) only. All other screens use `hero-panel`.

---

### Mistake 5 — Adding `animate-fade-in` without `animationFillMode: 'both'`

**Wrong:** Items are invisible briefly before their stagger delay kicks in, then flash in.

**Fix:** Add `style={{ animationFillMode: 'both', animationDelay: '...' }}` to ensure items start invisible and stay visible.

---

### Mistake 6 — Using `pill-sky` for a direct flight badge

**Wrong:** `<span className="pill-sky">Direct</span>`

**Fix:** `<span className="pill-success">Direct</span>`

Emerald is the "go" signal. Sky is for routing info. Using sky for "Direct" sends the wrong semantic signal.

---

### Mistake 7 — Using custom border/shadow values on cards

**Wrong:**
```tsx
<div className="bg-white rounded-2xl border border-gray-200 shadow-md p-5">
```

**Fix:**
```tsx
<div className="card">
```

The `.card` class includes the correct shadow with white inset highlight, the correct 20px radius, and the correct border color. Recreating it manually produces a flat, slightly-off result.

---

### Mistake 8 — Using `text-accent` for prices

This token does not exist in the design system. The correct token is `text-orange`.

**Wrong:** `className="text-accent"`

**Fix:** `className="text-orange"`

---

### Mistake 9 — Omitting `font-mono` on IATA codes

**Wrong:** `<span className="font-bold text-xs text-indigo-mid">LIS</span>`

**Fix:** `<span className="font-mono font-bold text-xs text-indigo-mid">LIS</span>`

IATA codes, flight times, prices, and stepper numbers all use `font-mono`.

---

### Mistake 10 — Touch targets under 48px

**Wrong:** `<button className="p-1"><X size={14} /></button>` — this produces a ~22px target.

**Fix:** `<button className="w-12 h-12 flex items-center justify-center"><X size={14} /></button>`

The 48px minimum applies to all interactive elements, not just primary actions.

---

## 12. File Locations

### Frontend source structure

```
frontend/
├── index.html                 — HTML shell, font links, favicon reference
├── tailwind.config.js         — Color tokens, font families, keyframes, animations
├── src/
│   ├── index.css              — @layer components (all named CSS classes)
│   ├── main.tsx               — React entry point
│   ├── App.tsx                — Root: ProgressBar, screen routing, container class
│   │
│   ├── screens/               — One file per screen (7 screens)
│   │   ├── HomeScreen.tsx
│   │   ├── FlightResultsScreen.tsx
│   │   ├── StayDurationScreen.tsx
│   │   ├── DecisionScreen.tsx
│   │   ├── ReturnFlightsScreen.tsx
│   │   ├── ItineraryScreen.tsx
│   │   ├── BookingReviewScreen.tsx
│   │   └── DatePickerScreen.tsx
│   │
│   ├── components/            — Shared/reusable components
│   │   ├── ProgressBar.tsx
│   │   ├── FlightCard.tsx      — FlightCard + FlightCardSkeleton
│   │   ├── ReturnFlightCard.tsx — ReturnFlightCard + ReturnFlightCardSkeleton
│   │   ├── TripTimeline.tsx
│   │   ├── TripMap.tsx         — Leaflet map (lazy-loaded)
│   │   └── DatePickerOverlay.tsx
│   │
│   ├── store/                 — Zustand state
│   │   ├── session.store.ts   — UI/session state (screen, dates, search results)
│   │   └── trip.store.ts      — Trip data (origin, legs, return flight)
│   │
│   ├── hooks/                 — Data-fetching hooks
│   │   ├── useFlightSearch.ts
│   │   ├── useAirportSearch.ts
│   │   ├── useWeatherBatch.ts
│   │   └── useUrlSync.ts
│   │
│   └── utils/                 — Pure utility functions
│       ├── date.utils.ts      — formatDate, formatTime, durationLabel, formatShortDate
│       ├── price.utils.ts     — formatPrice, totalPrice
│       ├── url.utils.ts       — URL state encoding/decoding
│       └── map.utils.ts       — Coordinate helpers for TripMap
```

### Documentation

```
Docs/
├── DESIGN.md                  — Master design document (screen specs, component anatomy)
├── DESIGN_SYSTEM.md           — Token reference (this system's companion doc)
├── LOGO_SPECS.md              — Logo, wordmark, favicon specifications
├── BRAND_IMPLEMENTATION.md    — Brand application guide, screen moods, checklists
├── IMPLEMENTATION_GUIDE.md    — This file — developer patterns and quick reference
├── architecture.md            — System architecture, backend/frontend split
├── api-design.md              — API contract, endpoint specs
├── data-models.md             — Shared TypeScript types (FlightOption, TripLeg, etc.)
└── business-logic.md          — Core rules (max 15 stops, stateless BE, URL state)
```

### Shared types package

```
packages/shared/               — @fast-travel/shared
└── src/
    └── types.ts               — FlightOption, TripLeg, Airport, WeatherSummary, etc.
```

Import shared types:
```tsx
import { FlightOption, TripLeg, Airport, WeatherSummary } from '@fast-travel/shared';
```

### Backend

```
backend/
├── src/
│   ├── routes/                — Express route handlers
│   ├── services/              — Flight search, weather, airport search
│   └── utils/                 — Shared backend utilities
└── ...
```

The backend is stateless. All trip state lives in the frontend URL (via `useUrlSync`) and Zustand stores. The backend never stores session data.
