import { create } from 'zustand';

const STORAGE_KEY = 'flexbook.passport';
// 24h absolute TTL on the session-scoped passport. Short enough that the
// "create an account to keep this" nudge stays relevant; long enough that a
// guest can plan a full trip in one sitting without re-picking.
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredPassport {
  code: string;
  /** Epoch ms when this entry should be discarded. */
  expiresAt: number;
}

function readStored(): StoredPassport | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    // Forward-compat with pre-TTL entries (plain ISO-2 codes): treat them as
    // expired so the CTA reappears once and migrates the user onto the new
    // schema. Avoids "stuck forever" passports from an older build.
    if (/^[A-Z]{2}$/.test(raw)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredPassport>;
    if (
      !parsed?.code ||
      typeof parsed.code !== 'string' ||
      !/^[A-Z]{2}$/.test(parsed.code) ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt <= Date.now()
    ) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return { code: parsed.code, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function writeStored(value: StoredPassport | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* localStorage unavailable */
  }
}

interface PassportState {
  /** Session-scoped override. Wins over profile when set. */
  sessionPassport: string | null;
  /** Epoch ms when the session-scoped passport will expire (null if unset). */
  sessionExpiresAt: number | null;
  setSessionPassport: (code: string | null) => void;
}

// Module-scoped timer so writes can cancel/reschedule without leaking
// timeouts. Lives outside the store factory so HMR re-runs reuse it.
let expiryTimer: ReturnType<typeof setTimeout> | null = null;

export const usePassportStore = create<PassportState>((set) => {
  const initial = readStored();

  function clearExpiry() {
    if (expiryTimer) {
      clearTimeout(expiryTimer);
      expiryTimer = null;
    }
  }

  function scheduleExpiry(expiresAt: number) {
    clearExpiry();
    const delay = Math.max(0, expiresAt - Date.now());
    expiryTimer = setTimeout(() => {
      writeStored(null);
      set({ sessionPassport: null, sessionExpiresAt: null });
    }, delay);
  }

  if (initial) scheduleExpiry(initial.expiresAt);

  return {
    sessionPassport: initial?.code ?? null,
    sessionExpiresAt: initial?.expiresAt ?? null,
    setSessionPassport: (code) => {
      if (!code) {
        clearExpiry();
        writeStored(null);
        set({ sessionPassport: null, sessionExpiresAt: null });
        return;
      }
      const normalized = code.toUpperCase();
      const expiresAt = Date.now() + SESSION_TTL_MS;
      writeStored({ code: normalized, expiresAt });
      set({ sessionPassport: normalized, sessionExpiresAt: expiresAt });
      scheduleExpiry(expiresAt);
    },
  };
});
