import { create } from 'zustand';

export type ApiMode = 'real' | 'mock';

interface ApiSwitcherState {
  mode: ApiMode;
  setMode: (mode: ApiMode) => void;
  toggle: () => void;
}

// Persist mode to localStorage so it survives page refreshes
const getInitialMode = (): ApiMode => {
  try {
    const stored = localStorage.getItem('api-mode');
    return (stored === 'mock' || stored === 'real') ? stored : 'real';
  } catch {
    return 'real';
  }
};

export const useApiSwitcher = create<ApiSwitcherState>((set) => ({
  mode: getInitialMode(),
  setMode: (mode: ApiMode) => {
    try {
      localStorage.setItem('api-mode', mode);
    } catch {
      // localStorage not available, just use in-memory state
    }
    set({ mode });
  },
  toggle: () => {
    set((state) => {
      const newMode: ApiMode = state.mode === 'real' ? 'mock' : 'real';
      try {
        localStorage.setItem('api-mode', newMode);
      } catch {
        // localStorage not available
      }
      return { mode: newMode };
    });
  },
}));
