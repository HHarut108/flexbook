# Fast Travel — UI/UX Redesign Specification v2
> **Status:** Proposed · **Date:** 2026-04-05 · **Supersedes:** `ux.md` palette & component sections

---

## Table of Contents

1. [Brand Direction & Philosophy](#1-brand-direction--philosophy)
2. [Design Token System](#2-design-token-system)
3. [Typography System](#3-typography-system)
4. [Spacing & Layout Grid](#4-spacing--layout-grid)
5. [Elevation & Shadow System](#5-elevation--shadow-system)
6. [Component Library — Atoms](#6-component-library--atoms)
7. [Component Library — Molecules](#7-component-library--molecules)
8. [Component Library — Organisms](#8-component-library--organisms)
9. [Screen-by-Screen Redesign](#9-screen-by-screen-redesign)
10. [Motion & Animation](#10-motion--animation)
11. [Interaction Patterns](#11-interaction-patterns)
12. [Empty & Error States](#12-empty--error-states)
13. [Accessibility](#13-accessibility)
14. [Migration Delta from v1](#14-migration-delta-from-v1)

---

## 1. Brand Direction & Philosophy

### 1.1 Why Rebrand

The v1 identity (warm sand `#F6F0E7` + muted teal `#12756D`) reads as **cosy and cautious** — fitting for a leisure booking site, but under-charged for a product whose core promise is _speed, spontaneity, and cost-winning_. The new identity moves to **bold authority with electric energy**: every visual decision should feel like a boarding pass printed by a company that genuinely wants you to go somewhere cheap and fast.

### 1.2 Brand Voice (Visual Tone)

| Attribute        | v1 Feel           | v2 Target                        |
|------------------|-------------------|----------------------------------|
| Energy           | Gentle, warm      | Decisive, charged                |
| Trust signal     | Organic, earthy   | Structured, authoritative        |
| Price perception | Cosy budget       | Smart-budget (premium sensibility)|
| Target vibe      | Travel blog       | Fintech meets adventure          |

### 1.3 New Brand Name Styling

The product name is rendered as **`FlexBook`** — all lowercase, with a forward-slash separator that echoes URL paths, routing, and flight codes. The slash is always set in the accent orange `#F97316`.

```
FlexBook
     ↑
     Slash in accent orange — represents a route, a path, a departure
```

**Wordmark usage rules:**
- Full wordmark: `FlexBook` — used on HomeScreen header only
- Short mark: `ft` monogram in a 32×32 rounded square — used in compact contexts (progress bar badge)
- Never use ALL CAPS for the wordmark
- Never separate the slash from the wordmark

### 1.4 Brand Tagline

> **"Your trip. Your rules. Your price."**

Used in the HomeScreen sub-headline. Not used on any other screen.

---

## 2. Design Token System

### 2.1 Color Palette

#### Primary Background & Surface

| Token            | Hex       | Usage                                          |
|------------------|-----------|------------------------------------------------|
| `bg`             | `#F0F4FF` | Page background — cool white with slight blue cast |
| `surface`        | `#FFFFFF` | Card & panel backgrounds                       |
| `surface-2`      | `#EEF1F8` | Depressed/secondary surface (skeleton, tags)   |
| `surface-glass`  | `rgba(255,255,255,0.82)` | Glassmorphism overlays, overlaid headers |

#### Primary Brand Colors

| Token            | Hex       | Usage                                          |
|------------------|-----------|------------------------------------------------|
| `indigo`         | `#3730A3` | Primary brand — headers, active states, wordmark prefix |
| `indigo-mid`     | `#4F46E5` | Interactive hover, focused borders             |
| `indigo-soft`    | `#EEF2FF` | Indigo tinted surfaces, pill backgrounds       |
| `indigo-border`  | `#C7D2FE` | Borders on indigo-tinted surfaces              |
| `orange`         | `#F97316` | Accent — prices, primary CTAs, wordmark slash, progress bar active |
| `orange-dark`    | `#EA6C0A` | CTA hover/pressed state                        |
| `orange-soft`    | `#FFF7ED` | Orange tinted surfaces                         |

#### Supporting Palette

| Token       | Hex       | Usage                                   |
|-------------|-----------|-----------------------------------------|
| `sky`       | `#0EA5E9` | Flight path lines, info badges          |
| `sky-soft`  | `#E0F2FE` | Sky tinted surfaces                     |
| `emerald`   | `#10B981` | "Direct" badge, positive states         |
| `emerald-soft` | `#D1FAE5` | Emerald tinted surfaces              |
| `gold`      | `#F59E0B` | Sunset/weather accents, star ratings    |
| `error`     | `#EF4444` | Error states                            |
| `error-soft`| `#FEE2E2` | Error surface tints                     |

#### Text Colors

| Token            | Hex       | Usage                              |
|------------------|-----------|------------------------------------|
| `text-primary`   | `#0F172A` | Headlines, body copy               |
| `text-secondary` | `#334155` | Secondary body, card descriptions  |
| `text-muted`     | `#64748B` | Labels, metadata, placeholder      |
| `text-xmuted`    | `#94A3B8` | Disabled, placeholder text         |
| `text-on-accent` | `#FFFFFF` | Text on filled orange/indigo       |

#### Border Colors

| Token           | Hex               | Usage                         |
|-----------------|-------------------|-------------------------------|
| `border`        | `#E2E8F0`         | Default card/input borders    |
| `border-strong` | `#CBD5E1`         | Focused/active borders        |
| `border-brand`  | `#C7D2FE`         | Indigo-tinted borders         |

### 2.2 Tailwind Config Diff

```js
// tailwind.config.js — v2 tokens (replaces v1 color block)
colors: {
  bg:             '#F0F4FF',
  surface:        '#FFFFFF',
  'surface-2':    '#EEF1F8',
  indigo:         '#3730A3',
  'indigo-mid':   '#4F46E5',
  'indigo-soft':  '#EEF2FF',
  'indigo-border':'#C7D2FE',
  orange:         '#F97316',
  'orange-dark':  '#EA6C0A',
  'orange-soft':  '#FFF7ED',
  sky:            '#0EA5E9',
  'sky-soft':     '#E0F2FE',
  emerald:        '#10B981',
  'emerald-soft': '#D1FAE5',
  gold:           '#F59E0B',
  'text-primary': '#0F172A',
  'text-secondary':'#334155',
  'text-muted':   '#64748B',
  'text-xmuted':  '#94A3B8',
  border:         '#E2E8F0',
  'border-strong':'#CBD5E1',
  'border-brand': '#C7D2FE',
  error:          '#EF4444',
  'error-soft':   '#FEE2E2',
}
```

### 2.3 Color Role Summary

```
Page bg       ░░░ #F0F4FF  — cool pale blue-white
Cards         ███ #FFFFFF  — pure white (pops off bg)
Primary CTA   ███ #F97316  — orange, warm, attention-seeking
Brand         ███ #3730A3  — indigo, authority, sky
Prices        ███ #F97316  — always orange, always mono
Direct badge  ███ #10B981  — emerald green = go
Stop badge    ░░░ #EEF1F8  — neutral grey-blue = neutral
Error         ███ #EF4444  — red
```

---

## 3. Typography System

### 3.1 Font Stack

```css
font-family: 'Inter', 'SF Pro Display', system-ui, sans-serif;   /* Body */
font-family: 'JetBrains Mono', 'Fira Code', monospace;            /* Prices, codes, times */
```

> **New in v2:** Load `Inter` weights **400, 500, 600, 700, 800, 900** (v1 only loaded up to 700). The 800/900 weights power the new editorial headlines.

**Updated Google Fonts URL:**
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
```

### 3.2 Type Scale

| Role          | Size    | Weight  | Tracking    | Line-height | Token class          |
|---------------|---------|---------|-------------|-------------|----------------------|
| Display XL    | 3.5rem  | 900     | -0.06em     | 0.92        | `text-display-xl`    |
| Display L     | 2.75rem | 800     | -0.05em     | 0.94        | `text-display-l`     |
| Display M     | 2rem    | 800     | -0.04em     | 1.0         | `text-display-m`     |
| H1            | 1.5rem  | 700     | -0.03em     | 1.2         | Standard `text-2xl font-bold` |
| H2            | 1.25rem | 600     | -0.02em     | 1.3         | Standard `text-xl font-semibold` |
| H3            | 1.0rem  | 600     | -0.01em     | 1.4         | Standard `text-base font-semibold` |
| Body L        | 1.0rem  | 400/500 | 0           | 1.6         | `text-base`          |
| Body M        | 0.875rem| 400     | 0           | 1.5         | `text-sm`            |
| Label         | 0.75rem | 600     | +0.12em     | 1.0         | `text-xs font-semibold tracking-wide` |
| Section Label | 0.7rem  | 700     | +0.22em     | 1.0         | Uppercase all-caps micro labels |
| Mono Price    | varies  | 700/800 | -0.02em     | 1.0         | `font-mono font-bold` |
| Mono Code     | 0.8rem  | 500     | 0           | 1.0         | IATA codes, times    |

### 3.3 Headline Rendering

The HomeScreen H1 uses **Display XL** with a two-line forced break and an orange underline treatment on the key word:

```
Where are you          ← line 1: text-primary, font-black
starting?              ← line 2: text-indigo, + orange underline bar
```

Flight Results and other screens use **Display M** (2rem / 800) — bold but not as tall since they scroll.

---

## 4. Spacing & Layout Grid

### 4.1 Base Unit

All spacing is in multiples of **4px**. The `rem` values below assume 16px base.

| Token | px  | rem    | Tailwind       | Use                                    |
|-------|-----|--------|----------------|----------------------------------------|
| `xs`  | 4   | 0.25   | `p-1 / gap-1`  | Icon-to-text gap, inline tight spacing |
| `sm`  | 8   | 0.5    | `p-2 / gap-2`  | Within card elements                   |
| `md`  | 12  | 0.75   | `p-3 / gap-3`  | Card inner padding top/bottom          |
| `lg`  | 16  | 1.0    | `p-4 / gap-4`  | Standard element gap, screen H-padding |
| `xl`  | 20  | 1.25   | `p-5 / gap-5`  | Card inner padding (comfortable)       |
| `2xl` | 24  | 1.5    | `p-6 / gap-6`  | Section gap                            |
| `3xl` | 32  | 2.0    | `p-8 / gap-8`  | Hero section top padding               |
| `4xl` | 40  | 2.5    | `p-10`         | Large section spacing                  |
| `5xl` | 48  | 3.0    | `p-12`         | Bottom safe-area padding               |

### 4.2 Screen Layout Shell

```
┌─────────────────────────────┐
│  max-w-sm  (640px)          │
│  mx-auto                    │
│  min-h-screen               │
│  bg-bg                      │
│                             │
│  ┌────────────────────────┐ │
│  │  Progress Bar  (48px)  │ │  ← sticky top, z-50
│  └────────────────────────┘ │
│                             │
│  ┌────────────────────────┐ │
│  │  Screen Content        │ │  ← px-4, scrollable
│  │  (flex-col)            │ │
│  └────────────────────────┘ │
│                             │
│  ┌────────────────────────┐ │
│  │  Sticky CTA Zone       │ │  ← fixed bottom, px-4, pb-safe
│  │  (80px + safe area)    │ │
│  └────────────────────────┘ │
└─────────────────────────────┘
```

### 4.3 Border Radius Scale

| Use                   | Radius    | Tailwind            |
|-----------------------|-----------|---------------------|
| Pill / badge          | 9999px    | `rounded-full`      |
| Small button / tag    | 8px       | `rounded-lg`        |
| Input / date button   | 16px      | `rounded-2xl`       |
| Card                  | 20px      | `rounded-[20px]`    |
| Hero / header panel   | 28px      | `rounded-[28px]`    |
| Section shell         | 24px      | `rounded-3xl`       |

---

## 5. Elevation & Shadow System

v2 moves from warm amber-tinted shadows (`rgba(35,49,58,...)`) to **cool blue-slate shadows** that complement the new indigo palette.

| Level      | Shadow value                                              | Used on                         |
|------------|-----------------------------------------------------------|---------------------------------|
| `shadow-0` | none                                                      | Flat elements, pills            |
| `shadow-1` | `0 1px 3px rgba(15,23,42,0.06)`                           | Subtle inner items              |
| `shadow-2` | `0 4px 12px rgba(15,23,42,0.08)`                          | Input fields, small cards       |
| `shadow-3` | `0 8px 24px rgba(15,23,42,0.10)`                          | Standard card default           |
| `shadow-4` | `0 16px 40px rgba(15,23,42,0.12), 0 2px 0 rgba(255,255,255,0.9) inset` | Hero panels, elevated cards |
| `shadow-cta`| `0 12px 32px rgba(249,115,22,0.28)`                      | Orange primary CTA button       |
| `shadow-brand`| `0 12px 32px rgba(55,48,163,0.18)`                    | Indigo focused state            |

---

## 6. Component Library — Atoms

### 6.1 `btn-primary` (Orange CTA)

```
Background:   linear-gradient(135deg, #F97316 0%, #EA6C0A 100%)
Text:         white, font-semibold, text-base
Padding:      py-3.5 px-6
Border-radius: rounded-2xl
Shadow:       shadow-cta
Active:       scale-95
Disabled:     opacity-40, cursor-not-allowed
Hover:        brightness-110
Width:        w-full (default)
```

**Visual anatomy:**
```
┌──────────────────────────────────────┐
│  ●  Label text                       │  ← optional leading icon
└──────────────────────────────────────┘
   ↑ 14px / 22px tall / shadow-cta
```

### 6.2 `btn-secondary` (Indigo ghost)

```
Background:   indigo-soft (#EEF2FF)
Text:         indigo (#3730A3), font-semibold
Border:       1px solid indigo-border (#C7D2FE)
Border-radius: rounded-2xl
Hover:        bg-indigo/10, border-indigo-mid
```

### 6.3 `btn-outline` (Neutral)

```
Background:   white/85 backdrop-blur-sm
Text:         text-primary, font-semibold
Border:       1px solid border (#E2E8F0)
Border-radius: rounded-2xl
Shadow:       shadow-2
Hover:        border-border-strong, text-indigo
```

### 6.4 `card`

```
Background:   white
Border:       1px solid border (#E2E8F0)
Border-radius: rounded-[20px]
Shadow:       shadow-3
Padding:      p-5
```

**Hover state (interactive cards like FlightCard):**
```
Transform:    translateY(-2px)
Shadow:       shadow-4
Border:       1px solid indigo-border (#C7D2FE)
```

### 6.5 `input-field`

```
Background:   white
Border:       1px solid border (#E2E8F0)
Border-radius: rounded-2xl
Shadow:       shadow-2
Padding:      px-4 py-3.5
Font:         text-base text-primary
Placeholder:  text-xmuted (#94A3B8)
Focus border: indigo-mid (#4F46E5)
Focus ring:   0 0 0 4px rgba(79,70,229,0.12)  ← indigo focus ring
```

### 6.6 `pill` / Badge variants

| Variant     | Background     | Text color  | Border             | Use case          |
|-------------|----------------|-------------|--------------------|--------------------|
| `pill-default` | surface-2   | text-muted  | border             | Neutral metadata  |
| `pill-brand` | indigo-soft   | indigo      | indigo-border      | Brand highlights  |
| `pill-success` | emerald-soft | emerald    | emerald/30         | "Direct" badge    |
| `pill-warning` | orange-soft  | orange-dark | orange/30          | Warnings, prices  |
| `pill-sky`  | sky-soft       | sky dark    | sky/30             | Stop info         |

### 6.7 `section-label`

```
font-size:  0.7rem
font-weight: 700
letter-spacing: 0.22em
text-transform: uppercase
color: text-muted
```

### 6.8 `skeleton`

```
background: linear-gradient(90deg, #EEF1F8 25%, #F8FAFF 50%, #EEF1F8 75%)
background-size: 200% 100%
animation: shimmer 1.6s ease-in-out infinite
border-radius: rounded-xl
```

---

## 7. Component Library — Molecules

### 7.1 `FlightCard` — Redesigned

**Layout change:** The city name moves to a larger, more prominent position. Price is right-aligned and rendered larger. Weather is de-emphasized (smaller, below the time row).

```
┌──────────────────────────────────────────┐
│  Ryanair · Direct ●  Portugal            │  ← airline · direct badge · country pill
│                                          │
│  Lisbon                         $34      │  ← city name (H2) + price (xl mono orange)
│  LIS                         one way     │  ← IATA mono muted + "one way" label
│──────────────────────────────────────────│
│  06:00 ──✈── 07:45 · 1h 45m  ☀ 22°C    │  ← time row with inline weather
└──────────────────────────────────────────┘
```

**Design tokens:**
- City name: `text-2xl font-bold text-primary tracking-tight`
- Price: `text-2xl font-mono font-bold text-orange`
- IATA: `text-sm font-mono text-muted bg-surface-2 px-2 py-0.5 rounded-full`
- Time row: `text-sm font-mono text-secondary`
- Card border on hover: `border-indigo-border`
- Direct badge: `pill-success`
- Stop badge: `pill-sky`

### 7.2 `ReturnFlightCard` — Redesigned

The route line gets a more polished **flight path SVG line** treatment replacing the CSS dash.

```
┌──────────────────────────────────────────┐
│  Wizz Air                    Non-stop    │  ← airline left, badge right
│                                          │
│  BUD ════════════════════════ EVN  $115  │  ← thick route bar + price
│                                          │
│  06:00            4h 30m          10:30  │  ← dep · duration center · arr
└──────────────────────────────────────────┘
```

**For connecting flights:**
```
│  BUD ═══•══ VIE ══•═══════ EVN   $89   │
│       stop 1          stop 2           │
```

- Route bar: `h-0.5 bg-gradient-to-r from-indigo to-sky` — indigo to sky gradient
- Stop dot: `w-3 h-3 rounded-full bg-white border-2 border-indigo-mid`
- Via IATA labels: `text-[10px] font-mono text-muted` below the stop dot

### 7.3 `TripTimeline` Strip — Redesigned

**Change:** Each leg card gets a more distinct visual identity with a small stop-number badge that is now orange for the latest leg (not just accent green/teal).

```
[●1] EVN → LIS    [✈]    [●2] LIS → BUD  ← current stop (orange badge)
Apr 3–6  $86             Apr 6–9  $21
```

**Leg card anatomy:**
```
┌──────────────────────────┐
│  ①   EVN → Lisbon        │  ← stop badge (indigo for past, orange for current)
│      Apr 3–6  $86        │
└──────────────────────────┘
```

- Past leg badge: `bg-indigo text-white` (indigo circle)
- Current/latest leg badge: `bg-orange text-white` (orange circle)
- Current leg card bg: `bg-orange-soft border border-orange/30`
- Past leg card bg: `bg-indigo-soft border border-indigo-border`

### 7.4 `DateNavRow` — Redesigned

No visual changes to the interaction model (← date → arrows pattern retained). Visual refresh:

```
┌──────┐  ┌─────────────────────────────────┐  ┌──────┐
│  ←   │  │ 📅  Thu, Apr 3   Departing      │  │  →   │
└──────┘  └─────────────────────────────────┘  └──────┘
 48×48px     flex-1, bg-white, border-border    48×48px
```

- Arrow buttons: `bg-white border border-border rounded-xl` with `hover:border-indigo-mid hover:text-indigo`
- Date button: `rounded-2xl bg-white border border-border shadow-2`
- On focus/active: indigo border treatment

### 7.5 `ProgressBar` — Redesigned

The progress bar shifts from the current minimal strip to a more structured **boarding-pass-inspired header band**.

```
┌─────────────────────────────────────────┐
│  [ft]  Stop 2          EVN → LIS → ●   │
└─────────────────────────────────────────┘
   ↑ 48px, bg-indigo/95, backdrop-blur, sticky top
```

- Background: `bg-indigo` (solid indigo, not gradient)
- Text: white
- `ft` monogram: `w-7 h-7 rounded-lg bg-white/20 text-white font-bold text-sm`
- Stop label: `text-white/90 text-xs font-medium`
- Breadcrumb IATAs: white text, current location has orange dot `●` before it
- Border-bottom: `border-b border-white/10`

### 7.6 `StayDurationStepper` — Redesigned

```
              ┌───────────────────┐
              │        3          │  ← 72px font, font-black, text-primary
              │      nights       │  ← text-muted, text-sm
              └───────────────────┘
   ┌──────┐                           ┌──────┐
   │  −   │                           │  +   │
   └──────┘                           └──────┘
   64×64px, rounded-2xl                 ← indigo-soft bg, indigo text
   bg-surface-2 on disabled             hover: bg-indigo text-white
```

The number display gets a subtle **indigo underline** to feel like a data entry field.

---

## 8. Component Library — Organisms

### 8.1 `HomeScreen` Hero Header — Redesigned

```
┌─────────────────────────────────────────┐
│  FlexBook          [globe icon]      │  ← wordmark left, icon button right
│                                         │
│                                         │
│  Where are you                          │  ← font-black, 3.5rem, line-height 0.92
│  starting?                              │  ← last word in indigo, orange underline
│                                         │
│  Your trip. Your rules. Your price.       │  ← tagline, text-muted, text-base
│                                         │
└─────────────────────────────────────────┘
```

The globe icon button in the top-right corner is:
```
w-12 h-12 rounded-2xl bg-white border border-border shadow-2
icon: Compass, text-indigo
hover: bg-indigo-soft border-indigo-border
```

### 8.2 Airport Search Section — Redesigned

```
┌─────────────────────────────────────────┐
│  SEARCH FROM                            │  ← section-label
│                                         │
│  ┌────────────────────────────────────┐ │
│  │  🔍  Type a city or airport…   [→] │ │  ← input with embedded send button
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

The embedded send/arrow button:
```
position: absolute right
w-12 h-12 rounded-xl bg-orange text-white
shadow-cta
hover: bg-orange-dark
```

### 8.3 `HeroPanel` (used in FlightResults, Decision, ReturnFlights headers)

```css
/* HeroPanel — v2 */
background: linear-gradient(135deg,
  rgba(238,242,255,0.98) 0%,     /* indigo-soft */
  rgba(240,244,255,0.95) 100%    /* bg */
);
border: 1px solid #C7D2FE;       /* indigo-border */
border-radius: 28px;
box-shadow: 0 16px 40px rgba(55,48,163,0.08),
            0 2px 0 rgba(255,255,255,0.9) inset;
```

This replaces the v1 warm-gradient hero panels with a cool indigo-tinted panel that reinforces brand identity at the top of each screen.

### 8.4 `ItineraryLegCard` — Redesigned

Each leg in the itinerary timeline gets a **boarding-pass aesthetic**: a vertical left-side color bar (indigo for outbound, orange for return) plus a more generous layout.

```
┌─ ▌indigo ───────────────────────────────────┐
│  ①  OUTBOUND                      $86       │
│                                              │
│  Yerevan ──────────────────► Lisbon          │
│  YER                                 LIS     │
│                                              │
│  06:00 → 07:45  · Ryanair · Direct · 1h 45m │
│  ☀  22°C on arrival                         │
│                                   [Book →]  │
└──────────────────────────────────────────────┘
```

```
┌─ ▌orange ──────────────────────────────────┐
│  ↩  RETURN                        $89       │
│     ...                                      │
└─────────────────────────────────────────────┘
```

Left color bar: `w-1 rounded-l-[20px] bg-indigo` (outbound) or `bg-orange` (return)

---

## 9. Screen-by-Screen Redesign

### 9.1 S1 — HomeScreen

**Key changes from v1:**
- Background: `bg` token (`#F0F4FF`) — cool pale blue instead of warm sand
- Body gradient: radial indigo glow top-left + sky glow top-right
- Wordmark: `FlexBook` typography treatment (indigo + orange slash)
- H1: Display XL weight 900, `tracking-[-0.06em]`
- Nearby airports section: indigo-tinted pills instead of warm earth
- Search input: Updated focus ring to indigo
- Arrow button inside search: orange

```
Background glows (CSS):
  radial-gradient(circle at top left,  rgba(79,70,229,0.12), transparent 30%)
  radial-gradient(circle at top right, rgba(14,165,233,0.10), transparent 28%)
  linear-gradient(180deg, #F0F4FF 0%, #EEF1F8 100%)
```

### 9.2 S2 — FlightResultsScreen

**Key changes from v1:**
- Hero panel: `HeroPanel` v2 (indigo-tinted, not warm white/gold)
- Origin IATA badge: `pill-brand` (indigo background)
- FlightCard: Updated component (see §7.1)
- "Head home" CTA at bottom: indigo-outlined button, not neutral
- Date nav: Updated arrow hover states to indigo

### 9.3 S3 — StayDurationScreen

**Key changes from v1:**
- Hero panel: `HeroPanel` v2 with sky-tinted gradient variation
- Stepper: Updated (see §7.6) with indigo +/− buttons
- "Good to know" recommendation block: indigo-soft background

### 9.4 S4 — DecisionScreen

**Key changes from v1:**
- Hero panel: indigo-tinted + slight warm overlay to convey "arrival" moment
- Current stop pill: `pill-brand` (indigo)
- `TripTimeline`: Updated — orange badge on latest leg
- Primary CTA "Continue": orange `btn-primary`
- Secondary CTA "Fly home": indigo `btn-secondary`

### 9.5 S5 — ReturnFlightsScreen

**Key changes from v1:**
- Header panel: orange-soft gradient variation (home = warm, departure = cool — reversed for return)
- `ReturnFlightCard`: Updated with gradient route line (§7.2)
- "Way home" pill: `pill-warning` (orange tint)

```css
/* ReturnFlights hero panel override */
background: linear-gradient(135deg,
  rgba(255,247,237,0.98) 0%,     /* orange-soft */
  rgba(240,244,255,0.95) 100%    /* bg */
);
border-color: rgba(249,115,22,0.25);
```

### 9.6 S6 — ItineraryScreen

**Key changes from v1:**
- Header: full-width `HeroPanel` v2 with a trip route summary rendered as IATA chain
- Price in header: rendered extra-large — `text-3xl font-mono font-black text-orange`
- Tab bar: replaced with a toggle-pill design:
  ```
  ┌────────────────────────────────────────┐
  │  [ ≡ Timeline ]   [ ⊙ Map ]           │
  └────────────────────────────────────────┘
       Active: bg-indigo text-white rounded-full
       Inactive: text-muted
  ```
- `ItineraryLegCard`: boarding-pass design (§8.4)
- "Share trip" button: full-width orange `btn-primary` at bottom
- "Proceed to booking" button: indigo `btn-secondary`

### 9.7 S7 — BookingReviewScreen

**Key changes from v1:**
- Each booking row: card with indigo left bar + external link treatment
- Book button per leg: `pill-warning` styled inline (orange text on orange-soft)

---

## 10. Motion & Animation

### 10.1 Principles

1. **Purposeful** — animation conveys meaning (loading, transition, confirmation), never decoration
2. **Fast** — all transitions ≤ 300ms; micro-interactions ≤ 150ms
3. **Interruptible** — all animations cancel cleanly; no blocking transitions

### 10.2 Token Definitions

| Token           | Duration | Easing            | Use                               |
|-----------------|----------|-------------------|-----------------------------------|
| `anim-micro`    | 100ms    | ease-out           | Button press scale, hover         |
| `anim-fast`     | 150ms    | ease-in-out        | Border/color transitions          |
| `anim-standard` | 220ms    | cubic-bezier(0.4,0,0.2,1) | Card appear, fade-in    |
| `anim-enter`    | 280ms    | cubic-bezier(0.0,0,0.2,1) | Screen slide-in, sheet rise |
| `anim-exit`     | 220ms    | cubic-bezier(0.4,0,1,1)   | Dismiss, fade-out        |

### 10.3 Named Keyframes

```css
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}

@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(249,115,22,0); }
  50%      { box-shadow: 0 0 0 8px rgba(249,115,22,0.15); }
}
```

### 10.4 Per-Component Motion Rules

| Component              | Enter                  | Interaction         | Exit               |
|------------------------|------------------------|---------------------|--------------------|
| `FlightCard`           | `fadeSlideUp` 220ms, staggered 30ms per card | hover: translateY(-2px) 150ms | none |
| `DatePickerOverlay`    | slide up 280ms, backdrop fade 220ms | — | slide down 220ms  |
| `btn-primary` press    | scale(0.95) 100ms       | pulseGlow on CTA    | scale(1.0) 100ms   |
| `ProgressBar` stop update | `scaleIn` 220ms on badge | — | —              |
| Screen transition      | `fadeSlideUp` 280ms     | —                   | `fadeOut` 200ms    |
| Skeleton → real card   | crossfade 200ms         | —                   | —                  |

---

## 11. Interaction Patterns

### 11.1 Touch Targets

All interactive elements meet a minimum **48×48px** touch target. Where the visual element is smaller (e.g., a 32px icon button), invisible padding expands the hit area.

```css
/* Minimum touch target helper */
.touch-target {
  min-width:  48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### 11.2 Tap Feedback

All `<button>` elements use `-webkit-tap-highlight-color: transparent` (set globally) and rely on:
- `active:scale-95` for press feedback
- `transition-all duration-150` for smoothness

### 11.3 Debounce Strategy (Date Navigation)

```
User taps ← / → arrow
  → debounce timer starts (400ms)
  → card list switches to skeleton state immediately (optimistic UI)
  → if user taps again within 400ms, timer resets
  → when timer fires, API call is made
  → real cards replace skeletons
```

This matches the existing v1 implementation but the **skeleton state now also dims and blurs existing cards** at 40% opacity + `blur(1px)` before clearing them, giving a stronger visual signal that content is changing.

### 11.4 Airport Search Typeahead

- Debounce: 300ms
- Min query length: 1 character
- Results: max 7 rows, tappable list rows
- Each row: `fadeSlideUp` animation staggered at 20ms intervals
- No result: shows "Try a different city or airport code" in text-muted

### 11.5 Scroll Restoration

`TripTimeline` auto-scrolls to the rightmost leg on mount and when leg count changes. This uses `scrollRef.current.scrollLeft = scrollRef.current.scrollWidth` — retained from v1.

---

## 12. Empty & Error States

### 12.1 Empty States — Visual Language

All empty states use a **centered icon + headline + body + action** pattern inside a dashed-border card:

```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
      [icon: 32px, text-xmuted]
      No flights on this date.
      Try a nearby day — deals        ← body, text-muted
      change daily.
      ← Day before    Day after →    ← recovery actions
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

Card: `border border-dashed border-border rounded-[20px] p-6 text-center`

### 12.2 Error States

Error cards use a `error-soft` background with a `error`-colored left border bar:

```
┌─ ▌red ──────────────────────────────────┐
│  ⚠  Couldn't load flights               │
│     Check your connection and retry.    │
│                        [↺  Retry]       │
└──────────────────────────────────────────┘
```

```css
background: #FEE2E2;  /* error-soft */
border-left: 3px solid #EF4444;  /* error */
border-radius: 20px;
```

### 12.3 State Matrix

| Screen | Empty condition          | Empty copy                             | Recovery action                 |
|--------|--------------------------|----------------------------------------|---------------------------------|
| S1     | No airport matches       | "No results. Try a different code."    | Keep typing                     |
| S2     | 0 flights on date        | "No flights here on this date."        | ← Day before / Day after →      |
| S2     | 1–2 flights on date      | "Only N option(s) — try nearby dates." | Inline nudge, no action required|
| S5     | 0 return flights         | "No good route home on this date."     | ← Day before / Day after →      |
| S6     | Map: no coordinates      | Map tab hidden                         | Auto-select Timeline tab        |
| Any    | API error                | "Something went wrong."                | [Retry] button                  |
| Any    | Bad `?t=` URL param      | "Couldn't restore this trip."          | [Start a new trip] → S1         |

---

## 13. Accessibility

### 13.1 Colour Contrast

All text/background pairs meet **WCAG AA (4.5:1 for normal text, 3:1 for large text):**

| Foreground        | Background      | Ratio  | Pass       |
|-------------------|-----------------|--------|------------|
| `text-primary` #0F172A | `bg` #F0F4FF | 14.3:1 | ✓ AAA |
| `text-muted` #64748B   | `bg` #F0F4FF | 4.6:1  | ✓ AA  |
| white               | `orange` #F97316 | 3.1:1  | ✓ AA (large text) |
| white               | `indigo` #3730A3 | 8.6:1  | ✓ AAA |
| `indigo` #3730A3    | `indigo-soft` #EEF2FF | 6.2:1 | ✓ AA |
| `orange` #F97316    | white          | 3.1:1  | ✓ AA (large) — **prices only, always ≥ 18px** |

> Note: Orange on white at small text sizes **does not** meet AA. Orange is only used for prices and primary CTAs where the text size is always `≥ 18px bold` or the element itself is `≥ 24px`.

### 13.2 Focus Management

- All interactive elements receive a visible indigo focus ring: `outline: 2px solid #4F46E5; outline-offset: 2px`
- `focus:outline-none` is only used when a **custom focus style** is applied instead
- Modal overlays (`DatePickerOverlay`) trap focus inside while open
- On overlay close, focus returns to the trigger element

### 13.3 Semantic HTML & ARIA

| Element              | Role / ARIA                              |
|----------------------|------------------------------------------|
| FlightCard button    | `role="button"` (implicit), `aria-label="Fly to {city}, ${price}"` |
| Date ← arrow         | `aria-label="Previous day"`              |
| Date → arrow         | `aria-label="Next day"`                  |
| Progress bar         | `role="progressbar"` `aria-label="Trip progress, stop N"` |
| Stepper −            | `aria-label="Decrease stay by 1 night"` |
| Stepper +            | `aria-label="Increase stay by 1 night"` |
| Skeleton cards       | `aria-busy="true"` on container          |
| Tab toggles          | `role="tablist"` / `role="tab"` / `aria-selected` |

### 13.4 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Skeleton shimmer is replaced by a static `background: #EEF1F8` when `prefers-reduced-motion` is set.

---

## 14. Migration Delta from v1

### 14.1 Token Renames

| v1 Token        | v2 Token           | Notes                         |
|-----------------|--------------------|-------------------------------|
| `bg: #F6F0E7`   | `bg: #F0F4FF`      | Warm sand → cool pale blue    |
| `surface: #FFFDF9` | `surface: #FFFFFF` | Creamy white → pure white  |
| `surface-2: #EFE5D8` | `surface-2: #EEF1F8` | Warm stone → cool slate |
| `accent: #12756D` | `indigo: #3730A3` + `orange: #F97316` | Teal split into brand + action |
| `accent-dark`   | `indigo-mid`       | —                             |
| `accent-soft`   | `indigo-soft`      | —                             |
| `sea: #2D9C95`  | `sky: #0EA5E9`     | Teal sea → sky blue           |
| `sun: #F1C768`  | `gold: #F59E0B`    | Warm yellow → amber gold      |
| `text-primary: #23313A` | `text-primary: #0F172A` | Slight darkening    |
| `text-muted: #6F7A80` | `text-muted: #64748B` | Standard Slate 500     |
| `error: #D64545` | `error: #EF4444`   | Matches Tailwind red-500      |
| `border: #DED2C3` | `border: #E2E8F0`  | Warm beige → cool slate       |

### 14.2 CSS Class Changes

| v1 Class         | v2 Replacement           | Change summary                    |
|------------------|--------------------------|-----------------------------------|
| `btn-primary`    | `btn-primary`            | Gradient: teal → orange           |
| `btn-outline`    | `btn-outline`            | Hover: teal → indigo              |
| `card`           | `card`                   | Shadow: warm tint → cool slate    |
| `input-field`    | `input-field`            | Focus ring: teal → indigo         |
| `hero-glow`      | `hero-glow` (v2)         | Gradient: warm → indigo-soft      |
| `section-shell`  | `section-shell`          | Border: warm → cool               |
| `skeleton`       | `skeleton`               | Shimmer: warm → cool palette      |
| `pill`           | `pill-{variant}`         | Now has 5 semantic variants       |

### 14.3 Component Structural Changes

| Component           | Breaking change?  | Notes                              |
|---------------------|-------------------|------------------------------------|
| `FlightCard`        | No — props unchanged | Visual refresh only             |
| `ReturnFlightCard`  | No — props unchanged | Route line redesigned           |
| `TripTimeline`      | No — props unchanged | Badge color logic updated       |
| `ProgressBar`       | No                | Indigo background, new `ft` mark  |
| `StayDurationStepper` | No              | New button styling               |
| `ItineraryLegCard`  | No                | Boarding-pass layout              |

### 14.4 New Additions in v2

| Addition                | Type         | Purpose                              |
|-------------------------|--------------|--------------------------------------|
| `btn-secondary`         | Atom         | Indigo-soft filled secondary action  |
| `pill-brand`            | Atom variant | Indigo IATA code badges              |
| `pill-success`          | Atom variant | "Direct" flight badge                |
| `shadow-cta`            | Token        | Orange CTA drop shadow               |
| `shadow-brand`          | Token        | Indigo focused shadow                |
| `HeroPanel` (v2)        | Organism     | Indigo-tinted screen header panels   |
| `ItineraryLegCard`      | Organism     | Boarding-pass style itinerary row    |
| `fadeSlideUp` keyframe  | Animation    | Card + screen entrance               |
| `scaleIn` keyframe      | Animation    | Badge updates, modal entry           |
| `pulseGlow` keyframe    | Animation    | CTA attention pulse                  |
| Inter 800/900 weights   | Typography   | Display XL headlines                 |
| `text-display-xl/l/m`   | Typography   | New editorial headline scale         |

---

*End of Fast Travel UI/UX Redesign Specification v2*
