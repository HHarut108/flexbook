/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:              'rgb(var(--c-bg) / <alpha-value>)',
        surface:         'rgb(var(--c-surface) / <alpha-value>)',
        'surface-2':     'rgb(var(--c-surface-2) / <alpha-value>)',
        indigo:          'rgb(var(--c-indigo) / <alpha-value>)',
        'indigo-mid':    'rgb(var(--c-indigo-mid) / <alpha-value>)',
        'indigo-soft':   'rgb(var(--c-indigo-soft) / <alpha-value>)',
        'indigo-border': 'rgb(var(--c-indigo-border) / <alpha-value>)',
        orange:          'rgb(var(--c-orange) / <alpha-value>)',
        'orange-dark':   'rgb(var(--c-orange-dark) / <alpha-value>)',
        'orange-soft':   'rgb(var(--c-orange-soft) / <alpha-value>)',
        sky:             'rgb(var(--c-sky) / <alpha-value>)',
        'sky-soft':      'rgb(var(--c-sky-soft) / <alpha-value>)',
        emerald:         'rgb(var(--c-emerald) / <alpha-value>)',
        'emerald-soft':  'rgb(var(--c-emerald-soft) / <alpha-value>)',
        gold:            'rgb(var(--c-gold) / <alpha-value>)',
        'text-primary':  'rgb(var(--c-text-primary) / <alpha-value>)',
        'text-secondary':'rgb(var(--c-text-secondary) / <alpha-value>)',
        'text-muted':    'rgb(var(--c-text-muted) / <alpha-value>)',
        'text-xmuted':   'rgb(var(--c-text-xmuted) / <alpha-value>)',
        border:          'rgb(var(--c-border) / <alpha-value>)',
        'border-strong': 'rgb(var(--c-border-strong) / <alpha-value>)',
        'border-brand':  'rgb(var(--c-border-brand) / <alpha-value>)',
        error:           'rgb(var(--c-error) / <alpha-value>)',
        'error-soft':    'rgb(var(--c-error-soft) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        fadeSlideUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        shimmer:       'shimmer 1.6s ease-in-out infinite',
        'fade-in':     'fadeSlideUp 220ms ease-out both',
        'scale-in':    'scaleIn 220ms ease-out both',
        float:         'float 8s ease-in-out infinite',
      },
      transitionTimingFunction: {
        'brand': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'enter': 'cubic-bezier(0.0, 0, 0.2, 1)',
        'exit':  'cubic-bezier(0.4, 0, 1, 1)',
      },
    },
  },
  plugins: [],
};
