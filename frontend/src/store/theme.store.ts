import { create } from 'zustand';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'flexbook-theme';

function readInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return 'light';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readInitialTheme(),
  setTheme: (theme) => {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
    applyTheme(theme);
    set({ theme });
  },
  toggle: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    applyTheme(next);
    set({ theme: next });
  },
}));

// Apply the persisted theme as soon as the module loads so the first paint matches.
if (typeof document !== 'undefined') {
  applyTheme(readInitialTheme());
}
