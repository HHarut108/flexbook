import { create } from 'zustand';

const STORAGE_KEY = 'flexbook.passport';

function readStored(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v && /^[A-Z]{2}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

function writeStored(code: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (code) window.localStorage.setItem(STORAGE_KEY, code);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* localStorage unavailable */
  }
}

interface PassportState {
  /** Session-scoped override. Wins over profile when set. */
  sessionPassport: string | null;
  setSessionPassport: (code: string | null) => void;
}

export const usePassportStore = create<PassportState>((set) => ({
  sessionPassport: readStored(),
  setSessionPassport: (code) => {
    const normalized = code ? code.toUpperCase() : null;
    writeStored(normalized);
    set({ sessionPassport: normalized });
  },
}));
