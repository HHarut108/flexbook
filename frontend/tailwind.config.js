/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:              '#F0F4FF',
        surface:         '#FFFFFF',
        'surface-2':     '#EEF1F8',
        indigo:          '#3730A3',
        'indigo-mid':    '#4F46E5',
        'indigo-soft':   '#EEF2FF',
        'indigo-border': '#C7D2FE',
        orange:          '#F97316',
        'orange-dark':   '#EA6C0A',
        'orange-soft':   '#FFF7ED',
        sky:             '#0EA5E9',
        'sky-soft':      '#E0F2FE',
        emerald:         '#10B981',
        'emerald-soft':  '#D1FAE5',
        gold:            '#F59E0B',
        'text-primary':  '#0F172A',
        'text-secondary':'#334155',
        'text-muted':    '#64748B',
        'text-xmuted':   '#94A3B8',
        border:          '#E2E8F0',
        'border-strong': '#CBD5E1',
        'border-brand':  '#C7D2FE',
        error:           '#EF4444',
        'error-soft':    '#FEE2E2',
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
