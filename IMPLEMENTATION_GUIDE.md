# FlexBook Brand Implementation Guide

**Version:** 1.0
**Last Updated:** April 5, 2026
**Status:** Ready for Development

Step-by-step guide to implement FlexBook brand (colors, typography, tone) in your React + Tailwind codebase.

---

## Quick Start Checklist

- [ ] Update `tailwind.config.js` with FlexBook colors
- [ ] Add font imports (Poppins, Inter, JetBrains Mono)
- [ ] Create Button, Input, Card, Badge components
- [ ] Update all copy to use brand voice
- [ ] Test accessibility (contrast, focus states)
- [ ] Deploy and verify on mobile/desktop

---

## Part 1: Tailwind Configuration

### Step 1: Update `tailwind.config.js`

Replace your current `tailwind.config.js` with this FlexBook-specific configuration:

```javascript
// tailwind.config.js
module.exports = {
  content: [
    "./frontend/src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // FlexBook Brand Colors
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

        // Neutral Colors
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

        // Status Colors
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

      fontSize: {
        'xs': ['12px', { lineHeight: '1.4' }],
        'sm': ['14px', { lineHeight: '1.5' }],
        'base': ['16px', { lineHeight: '1.5' }],
        'lg': ['18px', { lineHeight: '1.5' }],
        'xl': ['20px', { lineHeight: '1.4' }],
        '2xl': ['24px', { lineHeight: '1.4' }],
        '3xl': ['28px', { lineHeight: '1.3' }],
        '4xl': ['36px', { lineHeight: '1.2' }],
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

      boxShadow: {
        'sm': '0px 2px 8px rgba(0, 0, 0, 0.08)',
        'base': '0px 4px 12px rgba(0, 0, 0, 0.12)',
        'lg': '0px 8px 20px rgba(0, 0, 0, 0.15)',
      },
    },
  },
  plugins: [],
};
```

### Step 2: Add Font Imports

Add this to your main CSS file (typically `frontend/src/index.css` or `frontend/src/App.css`):

```css
/* Import Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700&display=swap');
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400&display=swap');

/* Apply fonts globally */
body {
  font-family: 'Inter', sans-serif;
  color: #2B2B2B;
  background-color: #FAFAF8;
}

h1, h2, h3, h4, h5, h6 {
  font-family: 'Poppins', sans-serif;
  font-weight: 700;
}

code, pre {
  font-family: 'JetBrains Mono', monospace;
}

/* Tailwind directives */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom component classes */
.btn-primary {
  @apply bg-flexbook-teal text-white px-xl py-lg rounded-base font-bold text-base
         hover:bg-flexbook-teal-600 active:bg-flexbook-teal-700
         disabled:opacity-40 disabled:cursor-not-allowed
         focus:outline-none focus:ring-2 focus:ring-flexbook-teal focus:ring-offset-2
         transition-colors duration-200;
}

.btn-secondary {
  @apply bg-flexbook-orange text-white px-xl py-lg rounded-base font-bold text-base
         hover:bg-flexbook-orange-400 active:bg-flexbook-orange-500
         disabled:opacity-40 disabled:cursor-not-allowed
         focus:outline-none focus:ring-2 focus:ring-flexbook-orange focus:ring-offset-2
         transition-colors duration-200;
}

.btn-tertiary {
  @apply border-2 border-flexbook-teal text-flexbook-teal px-xl py-lg rounded-base font-bold text-base
         hover:bg-flexbook-teal-50 active:bg-flexbook-teal-100
         disabled:opacity-40 disabled:cursor-not-allowed
         focus:outline-none focus:ring-2 focus:ring-flexbook-teal focus:ring-offset-2
         transition-colors duration-200;
}

.btn-ghost {
  @apply text-flexbook-teal px-xl py-lg rounded-base font-bold text-base
         hover:bg-flexbook-teal-50 active:bg-flexbook-teal-100
         disabled:opacity-40 disabled:cursor-not-allowed
         focus:outline-none focus:ring-2 focus:ring-flexbook-teal focus:ring-offset-2
         transition-colors duration-200;
}

.card {
  @apply bg-white border border-neutral-border rounded-base p-xl
         shadow-sm hover:shadow-base transition-shadow;
}

.input {
  @apply w-full px-lg py-lg rounded-base border-2 border-neutral-border
         bg-neutral-light-gray focus:outline-none focus:ring-2 focus:ring-flexbook-teal
         focus:border-flexbook-teal disabled:opacity-50 disabled:cursor-not-allowed
         font-body text-base;
}

.badge {
  @apply inline-block px-lg py-sm rounded-pill bg-flexbook-teal-50
         text-flexbook-teal-700 text-sm font-bold;
}

.h1 { @apply text-4xl font-bold font-heading leading-tight; }
.h2 { @apply text-3xl font-bold font-heading leading-snug; }
.h3 { @apply text-2xl font-semibold font-heading leading-snug; }
.h4 { @apply text-xl font-semibold font-heading; }
.body-text { @apply text-base font-body text-neutral-text-primary; }
.small-text { @apply text-sm font-body text-neutral-text-secondary; }
.micro-text { @apply text-xs font-body text-neutral-text-tertiary; }
```

---

## Part 2: Create Brand Components

### Step 1: Button Component

Create `frontend/src/components/Button.jsx`:

```jsx
import React from 'react';

export const Button = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  children,
  className = '',
  ...props
}) => {
  const baseStyles = 'font-bold rounded-base focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200 min-h-[44px] flex items-center justify-center';

  const variants = {
    primary: 'bg-flexbook-teal text-white hover:bg-flexbook-teal-600 active:bg-flexbook-teal-700 focus:ring-flexbook-teal',
    secondary: 'bg-flexbook-orange text-white hover:bg-flexbook-orange-400 active:bg-flexbook-orange-500 focus:ring-flexbook-orange',
    tertiary: 'border-2 border-flexbook-teal text-flexbook-teal hover:bg-flexbook-teal-50 active:bg-flexbook-teal-100 focus:ring-flexbook-teal',
    ghost: 'text-flexbook-teal hover:bg-flexbook-teal-50 active:bg-flexbook-teal-100 focus:ring-flexbook-teal',
  };

  const sizes = {
    sm: 'px-lg py-md text-sm',
    md: 'px-xl py-lg text-base',
    lg: 'px-2xl py-lg text-lg',
  };

  const disabledStyles = disabled || loading ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer';

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${disabledStyles} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-md" />
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
```

### Step 2: Input Component

Create `frontend/src/components/Input.jsx`:

```jsx
import React from 'react';

export const Input = ({
  label,
  error,
  helpText,
  disabled = false,
  className = '',
  ...props
}) => {
  return (
    <div className="flex flex-col gap-md w-full">
      {label && (
        <label className="font-semibold text-neutral-text-primary text-base font-heading">
          {label}
        </label>
      )}
      <input
        className={`px-lg py-lg rounded-base border-2 border-neutral-border bg-neutral-light-gray
                     focus:outline-none focus:ring-2 focus:ring-flexbook-teal focus:border-flexbook-teal
                     disabled:opacity-50 disabled:cursor-not-allowed font-body text-base
                     ${error ? 'border-error ring-2 ring-error' : ''}
                     ${className}`}
        disabled={disabled}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? 'error-message' : helpText ? 'help-text' : undefined}
        {...props}
      />
      {error && (
        <p id="error-message" className="text-sm text-error font-body">
          {error}
        </p>
      )}
      {helpText && (
        <p id="help-text" className="text-sm text-neutral-text-tertiary font-body">
          {helpText}
        </p>
      )}
    </div>
  );
};

export default Input;
```

### Step 3: Card Component

Create `frontend/src/components/Card.jsx`:

```jsx
import React from 'react';

export const Card = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`bg-white border border-neutral-border rounded-base p-xl shadow-sm hover:shadow-base transition-shadow ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
```

### Step 4: Badge Component

Create `frontend/src/components/Badge.jsx`:

```jsx
import React from 'react';

export const Badge = ({ children, variant = 'teal', className = '', ...props }) => {
  const variants = {
    teal: 'bg-flexbook-teal-50 text-flexbook-teal-700',
    orange: 'bg-flexbook-orange-50 text-flexbook-orange-700',
    purple: 'bg-flexbook-purple-50 text-flexbook-purple-700',
    error: 'bg-red-50 text-red-700',
    success: 'bg-green-50 text-green-700',
  };

  return (
    <span
      className={`inline-block px-lg py-sm rounded-pill text-sm font-bold font-heading ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;
```

### Step 5: Toast Notification Component

Create `frontend/src/components/Toast.jsx`:

```jsx
import React, { useEffect } from 'react';

export const Toast = ({
  variant = 'success',
  message,
  onClose,
  duration = 4000,
  className = ''
}) => {
  useEffect(() => {
    if (duration) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const styles = {
    success: 'bg-flexbook-teal-50 border-l-4 border-flexbook-teal-500 text-flexbook-teal-700',
    error: 'bg-red-50 border-l-4 border-error text-error',
    warning: 'bg-flexbook-orange-50 border-l-4 border-flexbook-orange-500 text-flexbook-orange-700',
    info: 'bg-blue-50 border-l-4 border-info text-info',
  };

  return (
    <div
      className={`fixed bottom-2xl right-xl p-lg rounded-base shadow-lg ${styles[variant]} ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-xl">
        <p className="font-body text-base">{message}</p>
        <button
          onClick={onClose}
          className="ml-xl font-bold hover:opacity-70 transition-opacity"
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default Toast;
```

---

## Part 3: Brand Voice in UI Copy

### Update all screen copy to use brand voice:

```jsx
// ❌ BEFORE
<button>Submit</button>
<p>No results found</p>
<input placeholder="Enter city" />

// ✅ AFTER
<button>Find your adventure</button>
<p>Crickets today. Try tomorrow—the good stuff usually hides on Tuesday.</p>
<input placeholder="Where are you right now?" />
```

### Voice Examples by Component

**Empty State:**
```jsx
// components/EmptyState.jsx
export const EmptyState = ({ searchTerm, onRetry }) => {
  return (
    <div className="flex flex-col items-center gap-lg p-4xl text-center">
      <h3 className="h3">No flights today</h3>
      <p className="body-text max-w-md text-neutral-text-secondary">
        Crickets. Try tomorrow, or pick a different date—the good stuff is usually hiding on Tuesday.
      </p>
      <Button variant="primary" onClick={onRetry}>
        Try another date
      </Button>
    </div>
  );
};
```

**Error State:**
```jsx
// components/ErrorState.jsx
export const ErrorState = ({ error, onRetry }) => {
  return (
    <div className="bg-red-50 border border-error rounded-base p-lg">
      <h4 className="h4 text-error mb-md">Oops, something went wrong</h4>
      <p className="body-text text-neutral-text-secondary mb-lg">
        {error?.message || 'Refresh and try again?'}
      </p>
      <Button variant="secondary" onClick={onRetry}>
        Refresh
      </Button>
    </div>
  );
};
```

**Loading State:**
```jsx
// components/LoadingState.jsx
export const LoadingState = ({ message = 'Hold on, finding your flights...' }) => {
  return (
    <div className="flex flex-col items-center gap-lg p-4xl">
      <div className="w-8 h-8 border-4 border-flexbook-teal border-t-transparent rounded-full animate-spin" />
      <p className="body-text text-neutral-text-secondary">{message}</p>
    </div>
  );
};
```

**Success Message:**
```jsx
// components/SuccessMessage.jsx
export const SuccessMessage = ({ message = 'Perfect—you\'ve got 3 stops planned.' }) => {
  return (
    <div className="bg-flexbook-teal-50 border border-flexbook-teal rounded-base p-lg">
      <p className="body-text text-flexbook-teal-700 font-semibold">{message}</p>
    </div>
  );
};
```

---

## Part 4: Update Existing Components

### Replace hardcoded styles in existing components:

**BEFORE:**
```jsx
<button style={{
  backgroundColor: '#00AA77',
  color: 'white',
  padding: '12px 16px'
}}>
  Next
</button>
```

**AFTER:**
```jsx
<Button variant="primary">Next</Button>
```

### Create a component migration checklist:

```
Components to Update:
- [ ] HomeScreen buttons
- [ ] FlightCard component
- [ ] DatePicker styling
- [ ] DecisionScreen CTA
- [ ] TripTimeline styling
- [ ] ItineraryScreen buttons
- [ ] BookingReview components
- [ ] All input fields
- [ ] All error messages
- [ ] All success messages
```

---

## Part 5: Testing & Validation

### Accessibility Checklist

```
Color Contrast:
- [ ] Teal text on white: 7.2:1 (AAA ✓)
- [ ] Orange text on white: 6.8:1 (AAA ✓)
- [ ] Text on teal background: 9.1:1 (AAA ✓)

Focus States:
- [ ] All buttons have visible focus ring
- [ ] All inputs have focus ring
- [ ] Focus outline is 3px, teal color

Mobile Testing:
- [ ] Buttons are min 44px height (touch targets)
- [ ] Font sizes scale properly on mobile
- [ ] Colors display correctly on various devices
- [ ] No horizontal scrolling on mobile

Screen Reader:
- [ ] All buttons have accessible labels
- [ ] Error messages linked via aria-describedby
- [ ] Toast notifications use role="status"
- [ ] Loading spinners have aria-busy
```

### Brand Verification

```
Visual Consistency:
- [ ] All buttons match brand colors
- [ ] All text uses correct font families
- [ ] Spacing follows 8px grid
- [ ] Border radius consistent (8px)

Voice Consistency:
- [ ] No corporate jargon in UI copy
- [ ] Button labels are action-oriented ("Find adventure" not "Submit")
- [ ] Error messages are candid and helpful
- [ ] Success messages celebrate user

Brand Colors:
- [ ] Primary CTA: Teal (#14A085)
- [ ] Secondary CTA: Orange (#FF9F43)
- [ ] Links: Teal (#14A085)
- [ ] Backgrounds: Off-white (#FAFAF8)
- [ ] Text: Charcoal (#2B2B2B)
```

---

## Part 6: File Structure

Recommended component organization:

```
frontend/src/
├── components/
│   ├── Button.jsx
│   ├── Input.jsx
│   ├── Card.jsx
│   ├── Badge.jsx
│   ├── Toast.jsx
│   ├── EmptyState.jsx
│   ├── ErrorState.jsx
│   ├── LoadingState.jsx
│   └── index.js (export all)
├── styles/
│   ├── index.css (fonts, base classes)
│   └── colors.css (color variables, optional)
├── pages/
│   ├── HomeScreen.jsx
│   ├── FlightResults.jsx
│   └── ...
├── App.jsx
└── index.js
```

---

## Part 7: Quick Reference Commands

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Check Tailwind is configured
npx tailwindcss -i ./src/index.css -o ./dist/output.css
```

---

## Troubleshooting

### Colors not appearing
- [ ] Check `tailwind.config.js` has `content` pointing to correct files
- [ ] Verify CSS is imported in main file
- [ ] Clear cache: `npm run build && npm run dev`

### Fonts not loading
- [ ] Check Google Fonts import in CSS file
- [ ] Verify font names in `font-family` config match imports
- [ ] Check browser DevTools > Network tab for font downloads

### Components not accessible
- [ ] Ensure Button has `focus:ring-2` and `focus:ring-offset-2`
- [ ] Verify Input has `aria-invalid` and `aria-describedby`
- [ ] Test with Tab key navigation
- [ ] Use WAVE browser extension to check accessibility

### Spacing looks off
- [ ] Check spacing token names match `tailwind.config.js`
- [ ] Verify using `gap-`, `p-`, `m-` prefixes correctly
- [ ] Mobile: Reduce padding on small screens (use responsive prefixes: `md:`, `lg:`)

---

## Next Steps

1. **Update `tailwind.config.js`** with brand colors (Part 1)
2. **Create Button, Input, Card, Badge components** (Part 2)
3. **Update all UI copy** to use brand voice (Part 3)
4. **Replace hardcoded styles** in existing components (Part 4)
5. **Test accessibility** and verify brand (Part 5)
6. **Deploy and iterate** based on feedback

---

**Version:** 1.0 | **Status:** Ready for Implementation | **Last Updated:** April 5, 2026
