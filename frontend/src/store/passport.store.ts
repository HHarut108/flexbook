import { create } from 'zustand';

const STORAGE_KEY = 'flexbook.passport';

// Session-scoped storage: the passport survives in-tab navigation and reloads
// but is dropped when the tab closes. No TTL — closing the tab IS the expiry.
// Picks made for "someone else" (or by a guest evaluating the product) should
// never persist beyond the session, and the previous 24h localStorage TTL +
// "Saved for Xh, sign up to keep it" nudge confused users into thinking we
// were holding their data longer than we are.
function readStored(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw || !/^[A-Z]{2}$/.test(raw)) return null;
    return raw;
  } catch {
    return null;
  }
}

function writeStored(value: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value) {
      window.sessionStorage.setItem(STORAGE_KEY, value);
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
    // Migration: clear any legacy localStorage entry from the prior TTL-based
    // implementation so a returning user doesn't get the stale passport
    // resurrected on next mount.
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
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
    if (!code) {
      writeStored(null);
      set({ sessionPassport: null });
      return;
    }
    const normalized = code.toUpperCase();
    writeStored(normalized);
    set({ sessionPassport: normalized });
  },
}));
