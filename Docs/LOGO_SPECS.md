# FlexBook — Logo Specifications

> **Version:** 1.0 · **Date:** 2026-04-05 · **Status:** Active source of truth
>
> This document governs all uses of the FlexBook logo system — wordmark, monogram, and favicon. Any use not explicitly approved here requires a design review.

---

## Table of Contents

1. [Primary Wordmark](#1-primary-wordmark)
2. [Short Mark (Monogram)](#2-short-mark-monogram)
3. [Icon Mark (SVG Favicon)](#3-icon-mark-svg-favicon)
4. [Clear Space](#4-clear-space)
5. [Size Minimums](#5-size-minimums)
6. [Colour Variations](#6-colour-variations)
7. [Background Rules](#7-background-rules)
8. [Misuse Examples](#8-misuse-examples)
9. [Usage by Surface](#9-usage-by-surface)
10. [SVG Favicon Code](#10-svg-favicon-code)

---

## 1. Primary Wordmark

### Rendering Specification

```
FlexBook
```

| Property | Value |
|---|---|
| Text content | `FlexBook` — all lowercase, no spaces |
| Font | Inter, weight 900 (Black) |
| Letter-spacing | -0.05em (tracking-[-0.05em]) |
| "fast" color | `#3730A3` (indigo) |
| "/" color | `#F97316` (orange) |
| "travel" color | `#3730A3` (indigo) |
| Baseline alignment | Single baseline — the three segments are inline |

### CSS / JSX Rendering

```jsx
// Correct wordmark implementation
<span className="font-black tracking-[-0.05em]">
  <span className="text-indigo">fast</span>
  <span className="text-orange">/</span>
  <span className="text-indigo">travel</span>
</span>
```

### Anatomy

```
┌────────────────────────────────────────┐
│                                        │
│   fast / travel                        │
│   ────   ──────                        │
│    ↑  ↑     ↑                          │
│    │  │     └── text-indigo (#3730A3)  │
│    │  └──────── text-orange (#F97316)  │
│    └─────────── text-indigo (#3730A3)  │
│                                        │
│   Font: Inter Black (900)              │
│   Tracking: -0.05em                    │
└────────────────────────────────────────┘
```

### Structural Rules

- The slash is inseparable from the wordmark — it must always appear between "fast" and "travel"
- No spaces on either side of the slash
- The wordmark is always all-lowercase — never `Fast/Travel`, `FAST/TRAVEL`, or any capitalisation variant
- The slash represents a route path, a URL separator, a departure vector — it is part of the word structure, not punctuation
- Do not add a tagline to the wordmark in any digital context (the tagline "Your trip. Your rules. Your price." is used separately, in body text size, below the wordmark on HomeScreen only)

---

## 2. Short Mark (Monogram)

### Specification

The `ft` monogram is used in compact contexts where the full wordmark does not fit, or where a badge/icon presence is needed.

| Property | Value |
|---|---|
| Text content | `ft` — all lowercase |
| Font | Inter Black (font-black) |
| Font size | `text-xs` (0.75rem / 12px) |
| Width | 28px (w-7) |
| Height | 28px (h-7) |
| Shape | Rounded square (`rounded-lg` = 8px radius) |
| Background (on indigo bg) | `bg-white/15` — white at 15% opacity |
| Text color (on indigo bg) | `text-white` |
| Background (on light bg) | `bg-indigo` — solid `#3730A3` |
| Text color (on light bg) | `text-white` |

### JSX Implementations

**On indigo background (ProgressBar):**
```jsx
<div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
  <span className="text-white font-black text-xs">ft</span>
</div>
```

**On light background:**
```jsx
<div className="w-7 h-7 rounded-lg bg-indigo flex items-center justify-center">
  <span className="text-white font-black text-xs">ft</span>
</div>
```

### Anatomy

```
  On Indigo Background        On Light Background
  ┌─────────┐                 ┌─────────┐
  │         │                 │█████████│
  │   ft    │                 │   ft    │
  │  white  │                 │  white  │
  │ bg 15%  │                 │  solid  │
  └─────────┘                 └─────────┘
  28×28px rounded-lg          28×28px rounded-lg
  bg-white/15 text-white       bg-indigo text-white
```

---

## 3. Icon Mark (SVG Favicon)

### Description

A 32×32 pixel square with 8px corner radius (rx="8"), filled with the primary indigo brand color. Contains the "ft" monogram in white Inter Black at 13px, centered. The slash "/" appears in orange `#F97316` as a superscript or inline element to reinforce the brand identity.

### Visual Structure

```
┌─────────────────────────────┐
│                             │
│  32×32px square             │
│  fill: #3730A3 (indigo)     │
│  corner radius: rx=8        │
│                             │
│         f t                 │
│         white, 13px         │
│         Inter 900           │
│                             │
│       slash "/" orange      │
│       #F97316, smaller      │
│                             │
└─────────────────────────────┘
```

---

## 4. Clear Space

### Minimum Clear Space Rule

The minimum clear space around the wordmark on all sides equals the **height of the lowercase "f" character** at the rendered size.

```
        ↑ [1× "f" height]
        │
←──────[ FlexBook ]──────→
 1× "f" │                │ 1× "f"
        ↓ [1× "f" height]
```

For the monogram, minimum clear space on all sides equals the **width of the badge** (28px = 1 badge width on each side is recommended, minimum is 8px on each side).

### Practical Minimums

| Context | Minimum padding |
|---|---|
| Wordmark on hero panel | 8px top, 8px bottom, 0px sides (aligns to panel edge) |
| Monogram in ProgressBar | 8px on all sides |
| Favicon (SVG) | No clear space requirement — it is contained within its own square |

---

## 5. Size Minimums

### Wordmark

| Constraint | Value | Reason |
|---|---|---|
| Minimum width | 80px | Below this, the slash becomes illegible and the "fast" segment has fewer than 3 legible characters |
| Recommended minimum | 100px | Comfortable reading size on mobile |
| No maximum | — | Scale freely; wordmark is vector/text |

### Monogram

| Constraint | Value | Reason |
|---|---|---|
| Minimum size | 24×24px | Below 24px, "ft" becomes unreadable at any pixel density |
| Standard size | 28×28px | As used in ProgressBar |
| Maximum practical size | 64×64px | Above this, prefer the full wordmark |

### Favicon

| Constraint | Value |
|---|---|
| Canonical size | 32×32px SVG |
| Browser tab display | 16×16px (browser scales down SVG) |
| Apple touch icon | 180×180px (generate rasterized PNG from SVG) |

---

## 6. Colour Variations

### 6.1 Primary (Default)

**For use on: white, `#F0F4FF` (bg), `#FFFFFF` (surface), `#EEF2FF` (indigo-soft), `#FFF7ED` (orange-soft)**

```
FlexBook
├── "fast":    #3730A3 (indigo)
├── "/":       #F97316 (orange)
└── "travel":  #3730A3 (indigo)
```

### 6.2 Reversed (White)

**For use on: `#3730A3` (indigo), `rgba(55,48,163,0.97)` (ProgressBar bg), dark photography, dark overlays**

```
FlexBook
├── "fast":    #FFFFFF (white)
├── "/":       #F97316 (orange) — unchanged
└── "travel":  #FFFFFF (white)
```

The slash remains orange in reversed contexts. It is legible against both the indigo background and white text.

### 6.3 Mono Dark

**For use on: grayscale print, single-color embossing, contexts where color is unavailable**

```
FlexBook
├── "fast":    #0F172A (text-primary / near-black)
├── "/":       #0F172A (same — slash loses orange distinction)
└── "travel":  #0F172A (same)
```

Note: In mono dark, the slash loses its orange identity. This is acceptable only in print/single-color contexts. Never use mono dark in digital interfaces.

### 6.4 Mono Light

**For use on: dark print backgrounds, black paper, reverse embossing**

```
FlexBook
├── "fast":    #FFFFFF (white)
├── "/":       #FFFFFF (white — slash loses orange distinction)
└── "travel":  #FFFFFF (white)
```

Same constraint as mono dark: acceptable only in print single-color contexts.

### Summary Table

| Variation | "fast" / "travel" | "/" | Background context |
|---|---|---|---|
| Primary | `#3730A3` indigo | `#F97316` orange | Light: white, bg, surface |
| Reversed | `#FFFFFF` white | `#F97316` orange | Dark: indigo, ProgressBar |
| Mono Dark | `#0F172A` near-black | `#0F172A` | Grayscale print |
| Mono Light | `#FFFFFF` white | `#FFFFFF` | Dark print |

---

## 7. Background Rules

### Approved Background Pairings

| Background | Hex | Use Primary variation | Use Reversed variation | Notes |
|---|---|---|---|---|
| Page bg | `#F0F4FF` | Yes | No | HomeScreen header (primary variant) |
| Surface white | `#FFFFFF` | Yes | No | Cards, panels |
| Indigo soft | `#EEF2FF` | Yes | No | Info boxes — indigo wordmark on indigo-soft is fine |
| Orange soft | `#FFF7ED` | Yes | No | Return screen context |
| Indigo | `#3730A3` | No | Yes | ProgressBar — use reversed (white + orange slash) |
| Indigo dark | `rgba(55,48,163,0.97)` | No | Yes | ProgressBar with blur overlay |
| Dark overlay | `rgba(15,23,42,0.8)` | No | Yes | Modal overlays |

### Prohibited Backgrounds

| Background | Why prohibited |
|---|---|
| `#F97316` orange fill | Orange wordmark slash becomes invisible against orange background |
| `#10B981` emerald | Neither indigo nor orange has sufficient contrast against emerald |
| `#0EA5E9` sky | Orange slash has insufficient contrast against sky blue |
| Photographic imagery | Only permitted with a semi-opaque overlay beneath the wordmark |
| Patterned textures | Same — requires a clean contrast layer underneath |

---

## 8. Misuse Examples

### 8.1 Don't stretch the wordmark

**Wrong:** Horizontally or vertically scaling the wordmark to fit a container.

**Right:** Scale proportionally or truncate to the monogram if space is constrained.

```
DON'T:   f  a  s  t  /  t  r  a  v  e  l   ← stretched horizontally
DO:      FlexBook                         ← uniform scale
```

### 8.2 Don't rotate the wordmark

**Wrong:** Rotating the wordmark at any angle other than 0°.

**Right:** The wordmark is always horizontal, reading left to right.

### 8.3 Don't use a teal or green slash

**Wrong:** Substituting emerald `#10B981`, teal, sky, or any non-orange color for the slash.

**Right:** The slash is always `#F97316` orange (or white in the mono-light print variation only).

```
DON'T:   fast[green slash]travel
DO:      fast[#F97316 slash]travel
```

### 8.4 Don't reorder the words

**Wrong:** `travel/fast` — this is not the brand name and has no approved use.

**Right:** Always `FlexBook` — "fast" before the slash, "travel" after.

### 8.5 Don't add a drop shadow to the wordmark

**Wrong:** `text-shadow: 0 2px 4px rgba(0,0,0,0.4)` applied to the wordmark.

**Right:** The wordmark relies on color contrast with its background. Choose an approved background pairing rather than adding a shadow.

### 8.6 Don't change the font

**Wrong:** Rendering the wordmark in any font other than Inter Black (weight 900).

**Right:** Inter 900 only. If Inter is not loaded, fall back to system-ui but never intentionally substitute another typeface.

### 8.7 Don't use uppercase "FT" for the monogram

**Wrong:** `<span>FT</span>` in the monogram badge.

**Right:** Always lowercase `ft`. Uppercase contradicts the all-lowercase brand convention and looks like an abbreviation rather than the brand mark.

### 8.8 Don't add a tagline to the icon mark

**Wrong:** Adding "Your trip. Your rules. Your price." or any other text beneath or beside the `ft` monogram or SVG favicon.

**Right:** The monogram and favicon are identity marks only. The tagline belongs exclusively in body copy on the HomeScreen, below the full wordmark.

---

## 9. Usage by Surface

| Surface | Logo variant | Implementation |
|---|---|---|
| HomeScreen header | Primary wordmark | `FlexBook` — Inter 900, indigo + orange slash, tracking -0.05em. Displayed at approx. 22–24px rendered height. |
| ProgressBar (S2–S6) | `ft` monogram | 28×28px rounded-lg, `bg-white/15 text-white font-black text-xs` on indigo background |
| Browser tab | SVG favicon | `favicon.svg` 32×32px, indigo fill, white "ft" text, orange slash |
| Open Graph / Share meta | Monogram (social preview) | A rasterized 1200×630px image using the monogram centered on an indigo background |
| Booking links (S7) | None | The BookingReviewScreen does not display the logo — focus is on the airline brands |
| Page title `<title>` | Text wordmark | `FlexBook` — plain text, no HTML, used in `<title>` and meta description |

---

## 10. SVG Favicon Code

The complete `favicon.svg` file. Save this to `frontend/public/favicon.svg`.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <!-- Background square with rounded corners -->
  <rect width="32" height="32" rx="8" fill="#3730A3"/>

  <!-- "ft" monogram in white, Inter Black 900, centered -->
  <!-- "f" positioned left of center, "t" right -->
  <text
    x="9"
    y="21"
    font-family="Inter, system-ui, sans-serif"
    font-weight="900"
    font-size="13"
    fill="#FFFFFF"
    letter-spacing="-0.5"
  >ft</text>

  <!-- Orange slash "/" — brand identity marker, positioned top-right -->
  <text
    x="22"
    y="12"
    font-family="Inter, system-ui, sans-serif"
    font-weight="900"
    font-size="8"
    fill="#F97316"
  >/</text>
</svg>
```

### Favicon Usage Notes

- Place `favicon.svg` in `frontend/public/`
- Reference it in `index.html`:
  ```html
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  ```
- For Safari and iOS home screen, also provide a PNG:
  ```html
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  ```
- The PNG should be generated from the SVG at 180×180px with the indigo background.
- The orange slash in the top-right corner is intentional — it is a subtle brand signal that appears in the browser tab.
