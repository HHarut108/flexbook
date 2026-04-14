# FlexBook — Design System Reference

> **Version:** 1.0 · **Date:** 2026-04-05 · **Status:** Active source of truth
>
> This document is the single reference for every visual token, component specification, and layout rule used in the FlexBook frontend. Any value not found here should not be invented — raise it as a design decision first.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Color Tokens](#2-color-tokens)
3. [Typography Scale](#3-typography-scale)
4. [Spacing Scale](#4-spacing-scale)
5. [Border Radius Scale](#5-border-radius-scale)
6. [Shadow Levels](#6-shadow-levels)
7. [Component Tokens](#7-component-tokens)
8. [Animation Tokens](#8-animation-tokens)
9. [Breakpoints](#9-breakpoints)
10. [Do / Don't](#10-do--dont)

---

## 1. Overview

### What this system covers

The FlexBook design system defines every visual decision in the product: colors, type, spacing, component CSS, animation, and layout. It is implemented across three files:

| File | Purpose |
|---|---|
| `frontend/tailwind.config.js` | Token definitions — colors, fonts, keyframes, animations |
| `frontend/src/index.css` | Component class definitions (`@layer components`) |
| `Docs/DESIGN.md` | Full design intent, screen specs, component anatomy |

This document is a **developer-facing reference** — a quick lookup for exact values without needing to read the full DESIGN.md. Use it when implementing components, writing Tailwind classes, or reviewing PRs.

### How to use it

- Look up a token name in this document to find the exact hex, class, or CSS value.
- Check Component Tokens (§7) before writing custom CSS for any named component.
- Check Do/Don't (§10) when you are unsure whether a design decision is on-brand.
- All values here are in sync with `tailwind.config.js` and `index.css`. If there is a conflict, the config files are authoritative.

### Design Philosophy

FlexBook is built for budget-first, plan-later travelers. The visual identity is **decisive and kinetic** — cool indigo authority paired with electric orange energy. Every token choice reinforces speed, low cost as a feature, and adventure. The palette deliberately echoes boarding passes and jet engines, not travel blogs.

---

## 2. Color Tokens

All tokens are defined in `frontend/tailwind.config.js` under `theme.extend.colors`.

### 2.1 Background and Surface

| Token | Hex | RGB | Tailwind class | Use case | Do | Don't |
|---|---|---|---|---|---|---|
| `bg` | `#F0F4FF` | 240, 244, 255 | `bg-bg` | Page background — cool pale blue-white | Use on `<body>` and root containers | Use for cards; cards are white |
| `surface` | `#FFFFFF` | 255, 255, 255 | `bg-surface` | Card and panel backgrounds | Use for all cards, modals, panels | Use raw `bg-white` — use token |
| `surface-2` | `#EEF1F8` | 238, 241, 248 | `bg-surface-2` | Depressed surfaces, tags, skeleton base | Use inside cards for sub-items | Use as main background |

### 2.2 Brand — Indigo

| Token | Hex | RGB | Tailwind class | Use case | Do | Don't |
|---|---|---|---|---|---|---|
| `indigo` | `#3730A3` | 55, 48, 163 | `bg-indigo` / `text-indigo` | Primary brand — headers, wordmark, active states | Use for ProgressBar bg, hero panel borders, active step indicators | Use for price display; prices are always orange |
| `indigo-mid` | `#4F46E5` | 79, 70, 229 | `text-indigo-mid` | Hover states, focused borders, IATA mono text | Use on interactive hover, focus ring color | Use as background fill at full opacity |
| `indigo-soft` | `#EEF2FF` | 238, 242, 255 | `bg-indigo-soft` | Tinted surfaces, pill backgrounds, info boxes | Use inside hero panels for info cards | Use for primary CTAs |
| `indigo-border` | `#C7D2FE` | 199, 210, 254 | `border-indigo-border` | Borders on indigo-tinted surfaces | Use as border on indigo-soft backgrounds | Use as a standalone background |

### 2.3 Action — Orange

| Token | Hex | RGB | Tailwind class | Use case | Do | Don't |
|---|---|---|---|---|---|---|
| `orange` | `#F97316` | 249, 115, 22 | `text-orange` / `bg-orange` | Prices, primary CTAs, progress bar, wordmark slash | Use for all monetary values; use for primary CTA background | Use for body text on white — insufficient contrast |
| `orange-dark` | `#EA6C0A` | 234, 108, 10 | `text-orange-dark` | CTA hover/pressed states, warning text | Use as hover gradient end in `btn-primary` | Use as the default price color; use `orange` |
| `orange-soft` | `#FFF7ED` | 255, 247, 237 | `bg-orange-soft` | Orange-tinted surfaces; return screen hero | Use for the ReturnFlights hero panel background | Use as primary background for outbound screens |

### 2.4 Supporting Palette

| Token | Hex | RGB | Tailwind class | Use case | Do | Don't |
|---|---|---|---|---|---|---|
| `sky` | `#0EA5E9` | 14, 165, 233 | `text-sky` | Flight path lines, info badge text | Use for `pill-sky` and route bar gradients | Use for error states; use `error` |
| `sky-soft` | `#E0F2FE` | 224, 242, 254 | `bg-sky-soft` | Sky-tinted surfaces, pill-sky background | Use inside pills and info boxes | Use as page background |
| `emerald` | `#10B981` | 16, 185, 129 | `text-emerald` | "Direct" badge, positive/go states | Use to signal a non-stop flight | Use for general positive UI not related to routing |
| `emerald-soft` | `#D1FAE5` | 209, 250, 229 | `bg-emerald-soft` | pill-success background | Use as pill-success base | Use as a card background |
| `gold` | `#F59E0B` | 245, 158, 11 | `text-gold` | Weather/sunset accents, progress bar gradient end | Use as the end color in progress fill gradient | Use for prices; use `orange` |
| `error` | `#EF4444` | 239, 68, 68 | `text-error` | Error state text | Use for error messages and destructive actions | Use for prices or CTAs |
| `error-soft` | `#FEE2E2` | 254, 226, 226 | `bg-error-soft` | Error card backgrounds | Use as bg in error state cards | Use as general surface color |

### 2.5 Text Colors

| Token | Hex | RGB | Tailwind class | Use case |
|---|---|---|---|---|
| `text-primary` | `#0F172A` | 15, 23, 42 | `text-text-primary` | Headlines, body copy — highest contrast |
| `text-secondary` | `#334155` | 51, 65, 85 | `text-text-secondary` | Supporting text, card descriptions |
| `text-muted` | `#64748B` | 100, 116, 139 | `text-text-muted` | Labels, metadata, section labels |
| `text-xmuted` | `#94A3B8` | 148, 163, 184 | `text-text-xmuted` | Disabled text, placeholder text |
| `text-on-accent` | `#FFFFFF` | 255, 255, 255 | `text-white` | Text on orange or indigo filled backgrounds |

### 2.6 Border Colors

| Token | Hex | RGB | Tailwind class | Use case |
|---|---|---|---|---|
| `border` | `#E2E8F0` | 226, 232, 240 | `border-border` | Default card and input borders |
| `border-strong` | `#CBD5E1` | 203, 213, 225 | `border-border-strong` | Active or focused input borders |
| `border-brand` | `#C7D2FE` | 199, 210, 254 | `border-border-brand` | Indigo context borders (alias of `indigo-border`) |

### 2.7 Semantic Color Summary

```
Role                 Token             Hex
────────────────────────────────────────────
Page background      bg                #F0F4FF
Card surface         surface           #FFFFFF
Depressed surface    surface-2         #EEF1F8
Primary brand        indigo            #3730A3
Interactive hover    indigo-mid        #4F46E5
Tinted info surface  indigo-soft       #EEF2FF
Price / CTA          orange            #F97316
CTA hover/pressed    orange-dark       #EA6C0A
Return screen bg     orange-soft       #FFF7ED
Direct flight badge  emerald           #10B981
Routing info badge   sky               #0EA5E9
Error                error             #EF4444
Headline text        text-primary      #0F172A
Body text            text-secondary    #334155
Metadata text        text-muted        #64748B
Placeholder text     text-xmuted       #94A3B8
```

---

## 3. Typography Scale

### Font Stack

```
Sans-serif:  Inter, system-ui, sans-serif
Monospace:   JetBrains Mono, Fira Code, monospace
```

Google Fonts load URL (must appear in `<head>`):
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800;0,14..32,900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
```

Inter weights 800 and 900 are required for the Display XL hero headline. Do not remove them from the font load URL.

### 3.1 Scale Table

| Role | Size | Weight | Letter-spacing | Line-height | Tailwind classes | Where used |
|---|---|---|---|---|---|---|
| Display XL | 3.4rem | 900 (black) | -0.06em | 0.92 | `text-[3.4rem] font-black leading-[0.92] tracking-[-0.06em]` | HomeScreen H1 "Where are you starting?" |
| H1 | 1.5rem | 700 (bold) | -0.03em | 1.2 | `text-2xl font-bold leading-tight tracking-[-0.03em]` | Screen titles, hero panel main title |
| H2 | 1.25rem | 600 (semibold) | -0.02em | 1.3 | `text-xl font-semibold leading-snug tracking-[-0.02em]` | Section titles, panel sub-headings |
| H3 | 1.0rem | 600 (semibold) | -0.01em | 1.4 | `text-base font-semibold tracking-[-0.01em]` | Card titles, city names in flight cards |
| Body L | 1.0rem | 400 / 500 | 0 | 1.6 | `text-base font-normal leading-relaxed` | Main body copy, card descriptions |
| Body M | 0.875rem | 400 | 0 | 1.5 | `text-sm font-normal leading-snug` | Supporting text, secondary card content |
| Section Label | 0.7rem | 700 | +0.22em | 1.0 | `section-label` CSS class | ALL-CAPS micro labels ("TRIP SO FAR", "START FROM") |
| Mono Price | 1.5rem+ | 700–900 | -0.02em | 1.0 | `font-mono font-bold text-2xl tracking-tight text-orange` | All price values |
| Mono Code | 0.8rem | 500–600 | 0 | 1.0 | `font-mono font-medium text-xs` | IATA codes, flight times |

### 3.2 Typography Usage Examples

**HomeScreen H1 (Display XL):**
```
"Where are      ← font-black, text-text-primary, text-[3.4rem], tracking-[-0.06em]
you starting?"  ← "starting?" in text-indigo + orange underline bar (2px height, z-index -10)
```

**ProgressBar IATA chain:**
```
EVN ● › LIS ● › BUD   ← font-mono text-xs, current IATA in text-white font-semibold
                         ● dot in text-orange
```

**Price display (all screens):**
```
$34         ← text-2xl font-mono font-bold text-orange tracking-tight
one way     ← text-xs text-text-xmuted font-normal
```

**Section label:**
```
TRIP SO FAR   ← text-[0.7rem] font-bold tracking-[0.22em] uppercase text-text-muted
```

### 3.3 Wordmark Typography

```
FlexBook
```
- Font: Inter 900 (font-black)
- Letter-spacing: -0.05em (tracking-[-0.05em])
- "fast" and "travel": color `#3730A3` (indigo)
- "/": color `#F97316` (orange)
- All lowercase — never uppercase, never CamelCase

---

## 4. Spacing Scale

Base unit: **4px**.

| Step | px | rem | Tailwind class | Primary use |
|---|---|---|---|---|
| 1 (xs) | 4px | 0.25rem | `gap-1` / `p-1` | Icon-to-text gap, inline tight spacing |
| 2 (sm) | 8px | 0.5rem | `gap-2` / `p-2` | Within-card element spacing |
| 3 (md) | 12px | 0.75rem | `gap-3` / `p-3` | Card inner vertical rhythm |
| 4 (lg) | 16px | 1rem | `gap-4` / `p-4` | Standard horizontal page padding, gaps |
| 5 (xl) | 20px | 1.25rem | `gap-5` / `p-5` | Card inner padding (comfortable) |
| 6 (2xl) | 24px | 1.5rem | `gap-6` / `p-6` | Section gaps, hero panel top padding |
| 8 (3xl) | 32px | 2rem | `p-8` | Hero section top padding |
| 12 (4xl) | 48px | 3rem | `p-12` | Bottom safe-area padding |
| 16 | 64px | 4rem | `p-16` | Maximum vertical breathing room |

### Screen Layout Shell

```
┌─────────────────────────────────────────┐
│   max-w-md (448px) · mx-auto            │
│   min-h-screen · bg-bg                  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  ProgressBar   ~48px              │  │  ← sticky top-0 z-50; hidden S1 + S7
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Screen Content  px-4 / px-5      │  │  ← scrollable
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Sticky CTA Zone  ~80px + safe    │  │  ← fixed bottom, pb-safe-area
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**FlightResultsScreen special case:** `h-screen flex flex-col overflow-hidden` — the card list scrolls internally, the top header is fixed in position.

---

## 5. Border Radius Scale

| Name | Value | Tailwind | Component types |
|---|---|---|---|
| Full (pill) | 9999px | `rounded-full` | All pill/badge components, dot indicators |
| 2xl (button/input) | 16px | `rounded-2xl` | Input fields, date buttons, arrow buttons, all btn-* classes |
| 3xl (section) | 24px | `rounded-3xl` | `section-shell` container |
| [20px] (card) | 20px | `rounded-[20px]` | `card`, `list-row`, flight cards, error/empty state cards |
| [28px] (hero) | 28px | `rounded-[28px]` | `hero-panel`, `hero-panel-return` |
| lg (monogram) | 8px | `rounded-lg` | `ft` monogram badge, small icon chips |
| xl (tag) | 12px | `rounded-xl` | Skeleton elements, small tag chips |

### Visual Map

```
rounded-full  ●  → pill badges, dots
rounded-2xl   ▭  → buttons, inputs, date nav arrows
rounded-[20px]  ▬  → cards, list rows
rounded-3xl   ▬  → section shells
rounded-[28px]  ▬  → hero panels
rounded-lg   ▪  → monogram badge, icon chips
```

---

## 6. Shadow Levels

All shadows use cool blue-slate tone `rgba(15,23,42,...)` — not warm amber.

| Level | Box-shadow value | Used on |
|---|---|---|
| `shadow-1` | `0 1px 3px rgba(15,23,42,0.06)` | Flat inner items, row separators |
| `shadow-2` | `0 4px 12px rgba(15,23,42,0.08)` | Input fields, small cards, arrow buttons |
| `shadow-3` | `0 8px 24px rgba(15,23,42,0.08), 0 2px 0 rgba(255,255,255,0.9) inset` | Card default state |
| `shadow-4` | `0 16px 40px rgba(15,23,42,0.12), 0 2px 0 rgba(255,255,255,0.9) inset` | Hero panels, elevated/hovered cards |
| `shadow-cta` | `0 12px 32px rgba(249,115,22,0.28)` | Orange `btn-primary` |
| `shadow-brand` | `0 12px 32px rgba(55,48,163,0.18)` | Indigo focus ring enhancement |
| `shadow-section` | `0 8px 24px rgba(15,23,42,0.06), 0 1px 0 rgba(255,255,255,0.9) inset` | Section shells |

### Shadow Hierarchy Visual

```
Flat (shadow-1)       ─ very subtle depth for inner elements
Raised (shadow-2)     ── inputs and small cards
Card (shadow-3)       ─── standard card default with white inset
Elevated (shadow-4)   ──── hero panels, hovered cards
CTA (shadow-cta)      ──── orange glow under primary button
Brand (shadow-brand)  ──── indigo focus ring
```

Note: All card shadows include a `0 2px 0 rgba(255,255,255,0.9) inset` which creates a subtle top-edge highlight, giving cards a slightly lifted appearance on the `#F0F4FF` background.

---

## 7. Component Tokens

All classes are defined in `frontend/src/index.css` under `@layer components`.

### 7.1 `btn-primary`

```css
/* Defined in index.css */
.btn-primary {
  width: 100%;
  text-align: center;
  color: white;
  font-weight: 600;          /* semibold */
  padding: 14px 24px;        /* py-3.5 px-6 */
  border-radius: 16px;       /* rounded-2xl */
  background: linear-gradient(135deg, #F97316 0%, #EA6C0A 100%);
  box-shadow: 0 12px 32px rgba(249,115,22,0.28);
  transition: all 150ms;
}
.btn-primary:hover:not(:disabled) { filter: brightness(1.08); }
.btn-primary:active             { transform: scale(0.95); }
.btn-primary:disabled           { opacity: 0.40; cursor: not-allowed; }
```

**Use for:** All primary forward-progress actions ("Continue to the next destination", "Proceed to booking options", "Book this flight").

### 7.2 `btn-secondary`

```css
.btn-secondary {
  width: 100%;
  text-align: center;
  font-weight: 600;
  padding: 14px 24px;
  border-radius: 16px;
  background: #EEF2FF;       /* indigo-soft */
  color: #3730A3;             /* indigo */
  border: 1px solid #C7D2FE; /* indigo-border */
  transition: all 150ms;
}
.btn-secondary:hover:not(:disabled) {
  background: rgba(79,70,229,0.12);
  border-color: #4F46E5;     /* indigo-mid */
}
.btn-secondary:active  { transform: scale(0.95); }
.btn-secondary:disabled { opacity: 0.40; cursor: not-allowed; }
```

**Use for:** Soft alternative actions ("Wrap up and fly home", "Share trip").

### 7.3 `btn-outline`

```css
.btn-outline {
  width: 100%;
  text-align: center;
  font-weight: 600;
  padding: 14px 24px;
  border-radius: 16px;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(8px);
  border: 1px solid #E2E8F0;
  color: #0F172A;             /* text-primary */
  box-shadow: 0 4px 12px rgba(15,23,42,0.06);
  transition: all 150ms;
}
.btn-outline:hover:not(:disabled) {
  border-color: #4F46E5;
  color: #3730A3;
}
.btn-outline:active  { transform: scale(0.95); }
.btn-outline:disabled { opacity: 0.40; cursor: not-allowed; }
```

**Use for:** Back navigation, non-committal options ("Back to flight options", "Plan another trip").

### 7.4 `card`

```css
.card {
  background: #FFFFFF;
  border-radius: 20px;
  padding: 20px;             /* p-5 */
  border: 1px solid #E2E8F0;
  box-shadow: 0 8px 24px rgba(15,23,42,0.08),
              0 2px 0 rgba(255,255,255,0.9) inset;
}

/* Hover variant for interactive cards */
.card:hover {
  transform: translateY(-2px);
  border-color: #C7D2FE;    /* indigo-border */
  box-shadow: 0 16px 40px rgba(15,23,42,0.12),
              0 2px 0 rgba(255,255,255,0.9) inset;
}
```

**Use for:** Static information containers, advisory cards, itinerary leg cards.

### 7.5 `input-field`

```css
.input-field {
  border: 1px solid #E2E8F0;
  border-radius: 16px;       /* rounded-2xl */
  padding: 14px 16px;        /* px-4 py-3.5 */
  color: #0F172A;
  background: white;
  width: 100%;
  box-shadow: 0 4px 12px rgba(15,23,42,0.06);
  transition: all 150ms;
}
.input-field::placeholder { color: #94A3B8; }
.input-field:focus {
  outline: none;
  border-color: #4F46E5;
  box-shadow: 0 4px 12px rgba(15,23,42,0.06),
              0 0 0 4px rgba(79,70,229,0.12);
}
```

**Use for:** Airport search input on HomeScreen. The 4px indigo focus ring is a system-wide focus standard.

### 7.6 Pill Variants

Base `.pill` class: `inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold`

| Class | Background | Text color | Border | Message communicated |
|---|---|---|---|---|
| `pill-default` | `#EEF1F8` | `#64748B` | `#E2E8F0` | Neutral metadata (duration, nights) |
| `pill-brand` | `#EEF2FF` | `#3730A3` | `#C7D2FE` | Identity / IATA codes / stop labels |
| `pill-success` | `#D1FAE5` | `#059669` | `rgba(16,185,129,0.3)` | Direct / non-stop flight |
| `pill-warning` | `#FFF7ED` | `#EA6C0A` | `rgba(249,115,22,0.3)` | Action required / booking link |
| `pill-sky` | `#E0F2FE` | `#0284C7` | `rgba(14,165,233,0.3)` | Routing info / stop count |

### 7.7 `section-shell`

```css
.section-shell {
  border-radius: 24px;       /* rounded-3xl */
  border: 1px solid #E2E8F0;
  background: #FFFFFF;
  box-shadow: 0 8px 24px rgba(15,23,42,0.06),
              0 1px 0 rgba(255,255,255,0.9) inset;
}
```

**Use for:** Grouping related items within a screen (search box container on HomeScreen, nearby airports list).

### 7.8 `hero-panel`

```css
.hero-panel {
  border-radius: 28px;
  padding: 20px;             /* px-5 py-5 */
  background: linear-gradient(135deg,
    rgba(238,242,255,0.98) 0%,
    rgba(240,244,255,0.95) 100%
  );
  border: 1px solid #C7D2FE;
  box-shadow: 0 16px 40px rgba(55,48,163,0.08),
              0 2px 0 rgba(255,255,255,0.9) inset;
}
```

**Use for:** Top header panel on S2, S3, S4, S6, S7. Indigo-tinted, communicates outbound/departure context.

### 7.9 `hero-panel-return`

```css
.hero-panel-return {
  border-radius: 28px;
  padding: 20px;
  background: linear-gradient(135deg,
    rgba(255,247,237,0.98) 0%,
    rgba(240,244,255,0.95) 100%
  );
  border: 1px solid rgba(249,115,22,0.25);
  box-shadow: 0 16px 40px rgba(249,115,22,0.08),
              0 2px 0 rgba(255,255,255,0.9) inset;
}
```

**Use for:** Top header panel on S5 (ReturnFlightsScreen) only. Orange-tinted, signals "coming home" / warm return context.

### 7.10 `skeleton`

```css
.skeleton {
  border-radius: 12px;       /* rounded-xl */
  background: linear-gradient(90deg,
    #EEF1F8 25%,
    #F8FAFF 50%,
    #EEF1F8 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
}
```

**Use for:** Placeholder loading state that matches the card anatomy. Each skeleton block should have the same dimensions as the real content it replaces.

### 7.11 `list-row`

```css
.list-row {
  width: 100%;
  border-radius: 20px;
  border: 1px solid #E2E8F0;
  background: #FFFFFF;
  padding: 16px 20px;        /* px-5 py-4 */
  text-align: left;
  box-shadow: 0 4px 12px rgba(15,23,42,0.04);
  transition: all 150ms;
}
.list-row:hover {
  border-color: #C7D2FE;
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(15,23,42,0.08);
}
```

**Use for:** Airport result rows on HomeScreen, any tappable list item in a section-shell.

### 7.12 `section-label`

```css
.section-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #64748B;             /* text-muted */
}
```

**Use for:** All caps micro-labels like "TRIP SO FAR", "START FROM", "NEARBY AIRPORTS", "WAY HOME".

---

## 8. Animation Tokens

All keyframes and animation utilities are defined in `frontend/tailwind.config.js`.

### 8.1 Duration and Easing Tokens

| Name | Duration | Easing | Use case |
|---|---|---|---|
| micro | 100ms | ease-out | Button press, hover color change |
| fast | 150ms | ease-in-out | Border / color state transitions (Tailwind `duration-150`) |
| standard | 220ms | `cubic-bezier(0.4,0,0.2,1)` | Card appearance, badge update, `animate-fade-in` |
| enter | 280ms | `cubic-bezier(0.0,0,0.2,1)` | Screen enter, sheet rise (DatePickerOverlay) |
| exit | 220ms | `cubic-bezier(0.4,0,1,1)` | Dismiss, fade-out |

### 8.2 Keyframes

```css
@keyframes fadeSlideUp {
  /* Card and screen entrance */
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes shimmer {
  /* Skeleton loading sweep */
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}

@keyframes scaleIn {
  /* Badge updates, modal entry */
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}

@keyframes float {
  /* Ambient floating elements (compass icon on HomeScreen) */
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-8px); }
}
```

### 8.3 Animation Utility Classes

| Tailwind class | Keyframe | Duration | Easing | Use |
|---|---|---|---|---|
| `animate-fade-in` | `fadeSlideUp` | 220ms | ease-out | FlightCard entrance, screen entrance |
| `animate-scale-in` | `scaleIn` | 220ms | ease-out | ProgressBar badge updates, modal entry |
| `animate-shimmer` | `shimmer` | 1.6s | ease-in-out infinite | Skeleton placeholders |
| `animate-float` | `float` | 8s | ease-in-out infinite | Compass icon on HomeScreen |

### 8.4 Stagger Pattern for Flight Cards

```jsx
// Apply increasing delay to each card in a list
{flights.map((flight, i) => (
  <FlightCard
    key={flight.id}
    style={{ animationDelay: `${i * 30}ms` }}
    className="animate-fade-in"
    {...flight}
  />
))}
```

Maximum stagger increment: 30ms. Maximum practical stagger on 10 cards: 270ms total.

### 8.5 Reduced Motion

The global CSS handles reduced motion automatically:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Skeletons degrade gracefully to static `#EEF1F8` background. No blocking animations exist — all are cosmetic.

---

## 9. Breakpoints

The app is **mobile-first, single-column**. There is no responsive layout shift — content is constrained to `max-w-md` (448px) and centered.

```
Mobile phone (primary target):  320px – 448px
Container max width:             max-w-md = 448px
Centering:                       mx-auto
Background beyond container:     bg-bg (#F0F4FF), full bleed
```

### Layout Rules

- `min-h-screen` on the root container
- Horizontal padding: `px-4` (16px) minimum, `px-5` (20px) for hero panels
- Bottom safe area: use `pb-safe` or `pb-12` (48px) to clear home indicator on iOS
- Sticky elements use `top-0 z-50` (ProgressBar) or `bottom-0 z-40` (CTA zones)

### There are no multi-column breakpoints

This is a deliberate design choice. The product targets mobile web users planning trips on their phones. A tablet or desktop user sees the same max-w-md centered column on a wider background.

---

## 10. Do / Don't

### Rule 1 — Never use orange for small body text

**Do:** Use `text-orange` only for prices (18px+), primary CTA text on white, and the wordmark slash.

**Don't:** `<p className="text-orange text-sm">some description text</p>` — orange on white at small sizes fails WCAG AA contrast.

---

### Rule 2 — Prices are always orange, monospace, and bold

**Do:**
```jsx
<span className="font-mono font-bold text-2xl text-orange tracking-tight">
  ${price}
</span>
<span className="text-xs text-text-xmuted">one way</span>
```

**Don't:** Use `text-text-primary` or `text-indigo` for prices. Don't omit the monospace font. Don't render prices smaller than `text-lg` (18px).

---

### Rule 3 — Use `hero-panel` for screen headers, not custom divs

**Do:** Apply the `.hero-panel` class to every screen's top header panel (except HomeScreen which has no panel, and S7 which has its own hero-panel).

**Don't:** Write custom background gradients or border colors for panels. If a panel looks different from `hero-panel`, use `hero-panel-return` (S5 only) or file a design decision.

---

### Rule 4 — Card hover is translateY(-2px), not a color change

**Do:**
```css
.card:hover {
  transform: translateY(-2px);
  border-color: #C7D2FE;
}
```

**Don't:** Change the card background color on hover. Don't use `scale(1.02)` — it causes layout shift.

---

### Rule 5 — Section labels use the `.section-label` class only

**Do:** `<p className="section-label">Trip so far</p>`

**Don't:** Recreate the tracking/weight/size inline. `text-[0.7rem] font-bold tracking-[0.22em] uppercase` without the class is a maintenance problem.

---

### Rule 6 — ProgressBar background is always indigo at `rgba(55,48,163,0.97)`

**Do:** Keep the ProgressBar on an indigo-tinted background with `backdrop-blur`.

**Don't:** Make the ProgressBar white, transparent, or any other color. It must remain the indigo authority stripe at the top of every screen S2–S6.

---

### Rule 7 — Direct flight badge is always `pill-success` (emerald)

**Do:** `<span className="pill-success">Direct</span>` or `<span className="pill-success">Non-stop</span>`

**Don't:** Use `pill-brand` or `pill-sky` for direct flights. Emerald is the universal "go" signal.

---

### Rule 8 — The wordmark slash "/" is always orange, never any other color

**Do:** Render the "/" in `#F97316` in every context.

**Don't:** Use indigo, white, or grey for the wordmark slash. Even on dark backgrounds, use orange for the slash (it is legible at all brand background colors).

---

### Rule 9 — Skeleton blocks must match the anatomy of the content they replace

**Do:** If a flight card has a 2-line text block and a price on the right, the skeleton should have two `.skeleton` blocks of matching width/height and one `.skeleton` block at price position.

**Don't:** Use a single full-width `.skeleton` div to replace a card — it removes spatial memory and creates a jarring content reflow.

---

### Rule 10 — Use `shadow-cta` only on `btn-primary` — nowhere else

**Do:** Let `btn-primary` carry its `0 12px 32px rgba(249,115,22,0.28)` shadow.

**Don't:** Apply the orange shadow to cards, panels, or other elements. The orange glow is a deliberate CTA signal. Using it elsewhere dilutes the primary action hierarchy.
