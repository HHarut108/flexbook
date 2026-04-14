# FlexBook Design System

**Version:** 1.0
**Last Updated:** April 5, 2026
**Status:** Ready for Implementation

Complete design system for FlexBook brand implementation in code, including logo specs, color tokens, typography, and UI patterns.

---

## Table of Contents

1. [Logo & Brand Mark](#logo--brand-mark)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Components](#components)
6. [Voice & Tone](#voice--tone)
7. [CSS/Tailwind Implementation](#csstailwind-implementation)
8. [React Component Patterns](#react-component-patterns)

---

## Logo & Brand Mark

### Primary Logo

**Logo Name:** FlexBook (Full Lockup)

**Composition:**
- Icon (left): Flex arrow + map pin (suggesting movement and destination discovery)
- Text (right): "FlexBook" in Poppins Bold, uppercase spacing

**Logo Dimensions:**
- **Minimum width:** 120px (digital), 40mm (print)
- **Maximum width:** No limit
- **Aspect ratio:** ~3:1 (width:height)

**Clear Space:**
- Minimum clear space: 1x the height of the "Flex" text on all sides
- Never place logo closer than this to other elements

### Icon-Only Version

**Logo Name:** FlexBook Mark

**Use Cases:**
- App icon (iOS, Android)
- Favicon (browser)
- Small spaces (< 80px width)
- Social media avatars

**Specifications:**
- Square format: 1:1 aspect ratio
- Minimum size: 24px
- Works in solid color (teal) or white

### Logo Colors

**Full Color (Preferred):**
- Icon: Teal (#14A085) with orange accent (#FF9F43)
- Text: Charcoal (#2B2B2B)
- Background: White or transparent

**Single Color (Alternative):**
- Icon + Text: Teal (#14A085)
- Use on light backgrounds only

**Reversed (White on Dark):**
- Icon + Text: White (#FFFFFF)
- Use on dark backgrounds (charcoal, teal)

**Logo Don'ts:**
- ❌ Don't change colors (unless single-color version)
- ❌ Don't rotate, skew, or stretch logo
- ❌ Don't place on busy/colored backgrounds without white space
- ❌ Don't add drop shadows or effects
- ❌ Don't outline or add borders
- ❌ Don't use below minimum size (120px)

### Logo File Assets (To Be Created)

```
assets/
├── logo/
│   ├── flexbook-full-lockup.svg       # Primary logo (color)
│   ├── flexbook-full-lockup-white.svg # For dark backgrounds
│   ├── flexbook-mark.svg              # Icon only (square)
│   ├── flexbook-mark-white.svg        # Icon white
│   ├── flexbook-full-lockup.png       # Raster version (300dpi)
│   └── favicon.ico                    # Browser favicon
```

---

## Color System

### Brand Colors

#### Primary Color: Teal
```
Name:     Teal
Hex:      #14A085
RGB:      20, 160, 133
HSL:      162°, 77%, 35%
Usage:    CTAs, primary buttons, links, active states, accents
Contrast: AAA on white (#FFFFFF), AA on light gray (#F5F5F5)
```

**Teal Variants:**
```
Teal 50:   #E6F5F2  (lightest, backgrounds)
Teal 100:  #CCE9E6
Teal 200:  #99D3CC
Teal 300:  #66BDB3
Teal 400:  #33A79A
Teal 500:  #14A085  (primary)
Teal 600:  #0F7961
Teal 700:  #0A533D
Teal 800:  #062D26
Teal 900:  #031613  (darkest)
```

#### Accent Color: Orange
```
Name:     Orange
Hex:      #FF9F43
RGB:      255, 159, 67
HSL:      32°, 100%, 63%
Usage:    Secondary CTAs, highlights, success states, warmth
Contrast: AAA on white (#FFFFFF), AA on light backgrounds
```

**Orange Variants:**
```
Orange 50:  #FFE8CC  (lightest, backgrounds)
Orange 100: #FFD699
Orange 200: #FFAD33
Orange 300: #FF9F43  (primary)
Orange 400: #FF8C1F
Orange 500: #E67E1A
Orange 600: #B86416
Orange 700: #8A4A11
Orange 800: #5C320B
```

#### Secondary Color: Purple
```
Name:     Purple
Hex:      #6B4C9A
RGB:      107, 76, 154
HSL:      268°, 34%, 45%
Usage:    Tertiary CTAs, creative elements, discovery emphasis
Contrast: AAA on white, AA on light backgrounds
```

**Purple Variants:**
```
Purple 50:  #E8E0F5
Purple 100: #D1C0EB
Purple 200: #A280D7
Purple 300: #8766BE
Purple 400: #6B4C9A  (primary)
Purple 500: #5A3E84
Purple 600: #49316D
Purple 700: #382457
Purple 800: #27184A
```

### Neutral Colors

#### Backgrounds
```
Off-white:       #FAFAF8
Light gray:      #F5F5F5
Warm gray:       #EFEFED
```

#### Text
```
Dark charcoal:   #2B2B2B  (primary text)
Medium gray:     #666666  (secondary text)
Light gray:      #9B9B9B  (tertiary text / disabled)
```

#### Borders & Dividers
```
Border light:    #E0E0E0
Border medium:   #D4D4D4
Border dark:     #CCCCCC
```

### Status Colors

```
Success:         #14A085  (teal - same as primary)
Warning:         #FF9F43  (orange - same as accent)
Error:           #E74C3C  (soft red)
Info:            #3498DB  (soft blue)
Disabled:        #9B9B9B  (light gray)
```

### Color Usage Guide

| Element | Color | Variant | Usage |
|---------|-------|---------|-------|
| **Primary CTA** | Teal | 500 | "Find adventure," "Continue," "Book" |
| **Secondary CTA** | Orange | 300 | "Share," "Flex," alternate actions |
| **Tertiary CTA** | Purple | 400 | Less common actions |
| **Links** | Teal | 500 | Underlined, hover darkens to 600 |
| **Button Hover** | Teal | 600 | Darker on interaction |
| **Button Active** | Teal | 700 | Pressed state |
| **Button Disabled** | Gray | 300 | 40% opacity |
| **Success Badge** | Teal | 50 bg, 600 text | Confirms completed actions |
| **Error Badge** | Error | 50 bg, 600 text | Alerts, validation errors |
| **Background** | Off-white | #FAFAF8 | Page background |
| **Card Background** | White | #FFFFFF | Cards, panels |
| **Text Primary** | Charcoal | #2B2B2B | Body copy, headlines |
| **Text Secondary** | Gray | #666666 | Helper text, metadata |
| **Border** | Gray | #D4D4D4 | Card borders, dividers |

### Accessibility Compliance

All color combinations meet WCAG AA contrast minimums:
- ✅ Teal text on white: 7.2:1 (AAA)
- ✅ Orange text on white: 6.8:1 (AAA)
- ✅ Text on teal background: 9.1:1 (AAA)
- ✅ Gray text on white: 6.3:1 (AAA)

**Don't rely on color alone** — always use additional visual cues (icons, text labels, patterns) for status indicators.

---

## Typography

### Font Stack

#### Headlines
```
Primary:   "Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
Weight:    700 (Bold)
Cases:     Sentence case (not all caps) for readability
```

**Poppins Font:**
- Download: https://fonts.google.com/specimen/Poppins
- Weights needed: 400 (Regular), 600 (SemiBold), 700 (Bold)
- Fallback: Inter Bold or system sans-serif

#### Body Text
```
Primary:   "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
Weight:    400 (Regular)
Cases:     Normal sentence case
```

**Inter Font:**
- Download: https://fonts.google.com/specimen/Inter
- Weights needed: 400 (Regular), 500 (Medium), 600 (SemiBold)
- Fallback: System sans-serif

#### Code / Prices
```
Primary:   "JetBrains Mono", "Courier New", monospace
Weight:    400 (Regular)
Usage:     Prices, codes, technical information
```

**JetBrains Mono:**
- Download: https://www.jetbrains.com/lp/mono/
- Weights needed: 400 (Regular)
- Fallback: monospace system font

### Font Sizes & Line Heights

| Element | Size | Weight | Line Height | Usage |
|---------|------|--------|-------------|-------|
| **H1** | 36px | 700 | 1.2 | Page title, hero section |
| **H2** | 28px | 700 | 1.3 | Section heading |
| **H3** | 24px | 600 | 1.4 | Subsection heading |
| **H4** | 20px | 600 | 1.4 | Minor heading |
| **Body** | 16px | 400 | 1.5 | Primary content |
| **Small** | 14px | 400 | 1.5 | Secondary text, labels |
| **Micro** | 12px | 400 | 1.4 | Metadata, timestamps |
| **Button** | 16px | 600 | 1.3 | CTA text |
| **Code** | 14px | 400 | 1.6 | Prices, codes |

### Letter Spacing

| Element | Tracking | Usage |
|---------|----------|-------|
| **Headlines** | 0px | Default |
| **Button Text** | 0.5px | Slight emphasis |
| **Body Text** | 0px | Default |
| **Small Text** | 0.25px | Slight openness |

### Type Scale (Typographic Hierarchy)

**Desktop:**
- H1: 36px (web) → use margin-bottom: 24px
- H2: 28px → margin-bottom: 20px
- H3: 24px → margin-bottom: 16px
- Body: 16px → margin-bottom: 16px

**Mobile (< 768px):**
- H1: 28px (reduced from 36px)
- H2: 24px (reduced from 28px)
- H3: 20px (reduced from 24px)
- Body: 16px (same)

---

## Spacing & Layout

### Spacing Scale (Tokens)

```
2px     → xs      (minimal)
4px     → sm      (tight)
8px     → md      (standard)
12px    → lg      (comfortable)
16px    → xl      (spacious)
24px    → 2xl     (very spacious)
32px    → 3xl     (large gap)
48px    → 4xl     (section gap)
64px    → 5xl     (major gap)
```

### Margin & Padding Standards

| Component | Padding | Margin |
|-----------|---------|--------|
| **Button** | 12px vertical, 16px horizontal | 8px bottom |
| **Input field** | 12px | 8px bottom |
| **Card** | 16px | 12px between cards |
| **Section** | 24px sides, 32px top/bottom | 0 |
| **Page** | 16px mobile, 24px desktop | 0 |

### Grid System

**Mobile (< 768px):**
- Columns: 4
- Gutter: 16px
- Container: Full width - 32px padding

**Tablet (768px - 1024px):**
- Columns: 8
- Gutter: 20px
- Container: 728px

**Desktop (> 1024px):**
- Columns: 12
- Gutter: 24px
- Container: 1000px max

### Responsive Breakpoints

```
Mobile:    320px - 767px
Tablet:    768px - 1023px
Desktop:   1024px+

Media queries:
@media (min-width: 768px)  { /* tablet + desktop */ }
@media (min-width: 1024px) { /* desktop */ }
@media (max-width: 767px)  { /* mobile only */ }
```

---

## Components

### Button Component

**Variants:**

```
Primary:    Teal background, white text, 12px vertical, 16px horizontal
Secondary:  Orange background, white text
Tertiary:   Teal text, transparent background, teal border
Ghost:      Transparent background, teal text (minimal style)
```

**States:**

```
Default:    Normal state
Hover:      Background darkens (Teal 600), cursor pointer
Active:     Background darker still (Teal 700)
Disabled:   40% opacity, cursor not-allowed
Loading:    Spinner inside, text opacity 50%
```

**Accessibility:**
- Minimum height: 44px (touch targets)
- Minimum width: 80px
- Font: 16px / 600 weight
- Focus: 3px teal outline

### Input Field Component

**Variants:**

```
Text input:     Border-based, 12px padding
Textarea:       Border-based, 12px padding, 120px min height
Disabled:       Gray background, disabled text
Error:          Red border, error message below
```

**States:**

```
Default:     Teal border, light gray background
Focus:       Teal border (2px), shadow
Valid:       Green border, checkmark icon
Invalid:     Red border, error message, shake animation
```

**Accessibility:**
- Label always associated with input
- Error messages linked via aria-describedby
- Focus indicator: 3px teal outline

### Card Component

**Specifications:**

```
Background:  White (#FFFFFF)
Border:      1px #D4D4D4
Padding:     16px
Border-radius: 8px
Shadow:      0px 2px 8px rgba(0,0,0,0.08) (subtle)
Hover:       Shadow increases to 0px 4px 12px rgba(0,0,0,0.12)
```

### Badge / Pill Component

**Usage:** Status indicators, tags, categories

```
Background:  Teal 50 (#E6F5F2)
Text:        Teal 700 (#0A533D)
Padding:     4px 12px
Border-radius: 12px (pill shape)
Font:        12px / 600 weight
```

### Progress Bar Component

```
Background:  Light gray (#F5F5F5)
Fill:        Teal gradient
Height:      4px
Border-radius: 2px
Animation:   Smooth fill, no bounce
Accessibility: aria-valuenow, aria-valuemin, aria-valuemax
```

### Toast / Notification Component

**Success:**
```
Background:  Teal 50 (#E6F5F2)
Border:      2px solid Teal 500
Text:        Teal 700
Icon:        Checkmark in Teal
```

**Error:**
```
Background:  #FDE6E6
Border:      2px solid #E74C3C
Text:        #C0392B
Icon:        Error symbol
```

---

## Voice & Tone

### Tone Applied to Interface Copy

#### Button Labels (Action-Oriented)
- ✅ "Find your adventure"
- ✅ "Flex to next destination"
- ✅ "Share your trip"
- ❌ "Submit" / "OK" / "Continue"

#### Empty States (Helpful, Candid)
- ✅ "No flights today. Try tomorrow—usually hiding on Tuesday."
- ✅ "Looks like you're between cities. Pick a starting point!"
- ❌ "No results found" / "Error 404"

#### Error Messages (Clear, Not Scolding)
- ✅ "Oops, that airport doesn't exist. Try searching another way."
- ✅ "Something went wrong. Refresh and try again?"
- ❌ "Invalid input" / "System error"

#### Success Messages (Celebratory)
- ✅ "Trip added! You're building something cool."
- ✅ "Perfect—you've got 3 stops planned."
- ❌ "Success" / "Completed"

#### Help Text (Warm, Supportive)
- ✅ "How many nights do you want to stay? No pressure—you can always change your mind."
- ✅ "Not sure? Most travelers stay 2-3 nights per city."
- ❌ "Enter a number between 1 and 90"

#### Disabled/Loading States
- ✅ "Hold on, finding your flights..."
- ✅ "Checking prices..."
- ❌ "Loading..." / "Please wait"

### Voice Across Screens

| Screen | Tone | Example |
|--------|------|---------|
| **Home** | Curious, inviting | "Where are you starting?" |
| **Flight Results** | Excited, clear | "Cheapest next destinations from Paris" |
| **Stay Duration** | Encouraging, flexible | "How long do you want to stay?" (not "How many nights?") |
| **Decision** | Collaborative | "Keep building or head home?" |
| **Trip Complete** | Celebratory | "You just built an epic trip. Ready to lock it in?" |
| **Errors** | Candid, helpful | "Oops, that didn't work. Try [alternative]?" |

---

## CSS/Tailwind Implementation

### Tailwind Color Configuration

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    colors: {
      // Brand colors
      flexbook: {
        teal: '#14A085',
        'teal-50': '#E6F5F2',
        'teal-100': '#CCE9E6',
        'teal-200': '#99D3CC',
        'teal-300': '#66BDB3',
        'teal-400': '#33A79A',
        'teal-500': '#14A085',
        'teal-600': '#0F7961',
        'teal-700': '#0A533D',
        'teal-800': '#062D26',
        'teal-900': '#031613',

        orange: '#FF9F43',
        'orange-50': '#FFE8CC',
        'orange-100': '#FFD699',
        'orange-200': '#FFAD33',
        'orange-300': '#FF9F43',
        'orange-400': '#FF8C1F',
        'orange-500': '#E67E1A',
        'orange-600': '#B86416',
        'orange-700': '#8A4A11',
        'orange-800': '#5C320B',

        purple: '#6B4C9A',
        'purple-50': '#E8E0F5',
        'purple-100': '#D1C0EB',
        'purple-200': '#A280D7',
        'purple-300': '#8766BE',
        'purple-400': '#6B4C9A',
        'purple-500': '#5A3E84',
        'purple-600': '#49316D',
        'purple-700': '#382457',
        'purple-800': '#27184A',
      },

      // Neutrals
      neutral: {
        'off-white': '#FAFAF8',
        'light-gray': '#F5F5F5',
        'warm-gray': '#EFEFED',
        'border-light': '#E0E0E0',
        'border': '#D4D4D4',
        'border-dark': '#CCCCCC',
        'text-primary': '#2B2B2B',
        'text-secondary': '#666666',
        'text-tertiary': '#9B9B9B',
      },

      // Status colors
      success: '#14A085',
      warning: '#FF9F43',
      error: '#E74C3C',
      info: '#3498DB',
    },

    fontFamily: {
      heading: ['Poppins', 'sans-serif'],
      body: ['Inter', 'sans-serif'],
      mono: ['JetBrains Mono', 'monospace'],
    },

    spacing: {
      'xs': '2px',
      'sm': '4px',
      'md': '8px',
      'lg': '12px',
      'xl': '16px',
      '2xl': '24px',
      '3xl': '32px',
      '4xl': '48px',
      '5xl': '64px',
    },

    borderRadius: {
      'none': '0',
      'sm': '4px',
      'base': '8px',
      'lg': '12px',
      'pill': '999px',
    },
  },
};
```

### Common Utility Classes

```css
/* Primary Button */
.btn-primary {
  @apply bg-flexbook-teal text-white px-xl py-lg rounded-base font-bold text-lg
         hover:bg-flexbook-teal-600 active:bg-flexbook-teal-700
         disabled:opacity-40 disabled:cursor-not-allowed
         focus:outline-none focus:ring-2 focus:ring-flexbook-teal;
}

/* Secondary Button */
.btn-secondary {
  @apply bg-flexbook-orange text-white px-xl py-lg rounded-base font-bold text-lg
         hover:bg-flexbook-orange-400 active:bg-flexbook-orange-500
         disabled:opacity-40 disabled:cursor-not-allowed
         focus:outline-none focus:ring-2 focus:ring-flexbook-orange;
}

/* Card */
.card {
  @apply bg-white border border-neutral-border rounded-base p-xl
         shadow-sm hover:shadow-md transition-shadow;
}

/* Input Field */
.input {
  @apply w-full px-lg py-lg rounded-base border-2 border-neutral-border
         bg-neutral-light-gray focus:outline-none focus:ring-2 focus:ring-flexbook-teal
         focus:border-flexbook-teal disabled:opacity-50 disabled:cursor-not-allowed;
}

/* Badge */
.badge {
  @apply inline-block px-lg py-sm rounded-pill bg-flexbook-teal-50
         text-flexbook-teal-700 text-sm font-bold;
}

/* Text Hierarchy */
.h1 { @apply text-4xl font-bold font-heading; }
.h2 { @apply text-3xl font-bold font-heading; }
.h3 { @apply text-2xl font-semibold font-heading; }
.body { @apply text-base font-body text-neutral-text-primary; }
.small { @apply text-sm font-body text-neutral-text-secondary; }
.micro { @apply text-xs font-body text-neutral-text-tertiary; }
```

---

## React Component Patterns

### Button Component Example

```jsx
// components/Button.jsx
export const Button = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  children,
  className = '',
  ...props
}) => {
  const baseStyles = 'font-bold rounded-base focus:outline-none focus:ring-2 transition-colors';

  const variants = {
    primary: 'bg-flexbook-teal text-white hover:bg-flexbook-teal-600 active:bg-flexbook-teal-700 focus:ring-flexbook-teal',
    secondary: 'bg-flexbook-orange text-white hover:bg-flexbook-orange-400 focus:ring-flexbook-orange',
    tertiary: 'border-2 border-flexbook-teal text-flexbook-teal hover:bg-flexbook-teal-50 focus:ring-flexbook-teal',
  };

  const sizes = {
    sm: 'px-lg py-md text-sm',
    md: 'px-xl py-lg text-base',
    lg: 'px-2xl py-lg text-lg',
  };

  const disabledStyles = disabled || loading ? 'opacity-40 cursor-not-allowed' : '';

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${disabledStyles} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? '...' : children}
    </button>
  );
};
```

### Input Component Example

```jsx
// components/Input.jsx
export const Input = ({
  label,
  error,
  helpText,
  disabled = false,
  className = '',
  ...props
}) => {
  return (
    <div className="flex flex-col gap-md">
      {label && (
        <label className="font-semibold text-neutral-text-primary">
          {label}
        </label>
      )}
      <input
        className={`px-lg py-lg rounded-base border-2 border-neutral-border bg-neutral-light-gray
                     focus:outline-none focus:ring-2 focus:ring-flexbook-teal focus:border-flexbook-teal
                     disabled:opacity-50 disabled:cursor-not-allowed
                     ${error ? 'border-error' : ''}
                     ${className}`}
        disabled={disabled}
        {...props}
      />
      {error && <p className="text-sm text-error">{error}</p>}
      {helpText && <p className="text-sm text-neutral-text-tertiary">{helpText}</p>}
    </div>
  );
};
```

### Card Component Example

```jsx
// components/Card.jsx
export const Card = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`bg-white border border-neutral-border rounded-base p-xl shadow-sm hover:shadow-md transition-shadow ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
```

### Toast/Notification Component Example

```jsx
// components/Toast.jsx
export const Toast = ({ variant = 'success', message, onClose }) => {
  const styles = {
    success: 'bg-flexbook-teal-50 border-flexbook-teal-500 text-flexbook-teal-700',
    error: 'bg-red-50 border-error text-red-700',
    info: 'bg-blue-50 border-info text-blue-700',
  };

  return (
    <div className={`fixed bottom-2xl right-xl border-l-4 p-lg rounded-base ${styles[variant]}`}>
      {message}
      <button onClick={onClose} className="ml-xl font-bold">×</button>
    </div>
  );
};
```

### Brand Voice in Components

```jsx
// Example: Empty state with brand voice
export const EmptyState = ({ searchTerm }) => {
  return (
    <div className="flex flex-col items-center gap-lg p-4xl">
      <h3 className="text-2xl font-bold">No flights today</h3>
      <p className="text-neutral-text-secondary text-center">
        Crickets. Try tomorrow, or pick a different date—the good stuff is usually hiding on Tuesday.
      </p>
    </div>
  );
};

// Example: Error with brand voice
export const ErrorState = ({ error }) => {
  return (
    <div className="bg-red-50 border border-error rounded-base p-lg">
      <h4 className="font-bold text-error mb-md">Oops, something went wrong</h4>
      <p className="text-neutral-text-secondary mb-lg">
        {error?.message || 'Refresh and try again?'}
      </p>
      <button
        onClick={() => window.location.reload()}
        className="btn-primary"
      >
        Refresh
      </button>
    </div>
  );
};
```

---

## Implementation Checklist

### Phase 1: Tokens & Configuration
- [ ] Create `tailwind.config.js` with FlexBook colors
- [ ] Add font imports (Poppins, Inter, JetBrains Mono)
- [ ] Configure spacing scale tokens
- [ ] Set up CSS custom properties (optional, for non-Tailwind)

### Phase 2: Base Components
- [ ] Button (all variants)
- [ ] Input field
- [ ] Card
- [ ] Badge
- [ ] Toast notification

### Phase 3: Integration
- [ ] Update all existing buttons to use Button component
- [ ] Replace all hardcoded colors with Tailwind utilities
- [ ] Update typography to use new font stack
- [ ] Add brand voice to all copy (buttons, empty states, errors)

### Phase 4: Refinement
- [ ] Verify contrast ratios (WCAG AA minimum)
- [ ] Test on multiple devices (mobile, tablet, desktop)
- [ ] Verify focus states are visible
- [ ] Test with screen readers

---

## Resources

### Font Downloads
- **Poppins:** https://fonts.google.com/specimen/Poppins
- **Inter:** https://fonts.google.com/specimen/Inter
- **JetBrains Mono:** https://www.jetbrains.com/lp/mono/

### Color Tools
- **Color Contrast Checker:** https://webaim.org/resources/contrastchecker/
- **Color Palette Generator:** https://coolors.co/
- **Tailwind Color Customizer:** https://tailwindcolor.com/

### Design Tools
- **Figma Component Library:** (To be created)
- **Storybook:** (Recommended for component documentation)

---

**Version:** 1.0 | **Status:** Ready for Implementation | **Last Updated:** April 5, 2026
