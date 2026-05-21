import { useCallback } from 'react';
import { useAuthStore } from '../store/auth.store';
import { usePassportStore } from '../store/passport.store';
import { authApi } from '../api/auth.api';

export type PassportSource = 'session' | 'profile' | 'none';

export interface UseCurrentPassportResult {
  passport: string | null;
  source: PassportSource;
  /**
   * Persist a passport choice for this session. If `saveToProfile` is true and
   * the user is signed in, also writes it to their profile as the primary
   * citizenship (silently ignored on failure — the session value still applies).
   */
  setPassport: (code: string, opts?: { saveToProfile?: boolean }) => Promise<void>;
  clearPassport: () => void;
}

/**
 * Single source of truth for "what passport are we showing visa requirements
 * against?" Resolution order:
 *   1. Session override (localStorage) — set when the user picks via the inline
 *      picker. Wins so a dual-citizen can switch passports per trip without
 *      mutating their profile.
 *   2. Primary citizenship from the signed-in user's profile.
 *   3. None — the UI should prompt for selection.
 */
export function useCurrentPassport(): UseCurrentPassportResult {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const sessionPassport = usePassportStore((s) => s.sessionPassport);
  const setSessionPassport = usePassportStore((s) => s.setSessionPassport);

  const primary = user?.citizenships?.find((c) => c.isPrimary) ?? user?.citizenships?.[0] ?? null;
  const profilePassport = primary?.countryCode ?? null;

  const passport = sessionPassport ?? profilePassport ?? null;
  const source: PassportSource = sessionPassport
    ? 'session'
    : profilePassport
      ? 'profile'
      : 'none';

  const setPassport = useCallback(
    async (code: string, opts: { saveToProfile?: boolean } = {}) => {
      const normalized = code.toUpperCase();
      setSessionPassport(normalized);

      if (opts.saveToProfile && user) {
        try {
          const countryName = new Intl.DisplayNames(['en'], { type: 'region' }).of(normalized) ?? normalized;
          const next = await authApi.updateProfile({
            citizenships: [
              { countryCode: normalized, countryName, isPrimary: true },
              ...(user.citizenships ?? [])
                .filter((c) => c.countryCode !== normalized)
                .map((c) => ({
                  countryCode: c.countryCode,
                  countryName: c.countryName,
                  documentNumber: c.documentNumber ?? null,
                  isPrimary: false,
                })),
            ],
          });
          setUser(next.user);
        } catch {
          /* keep the session value; the profile write can be retried later */
        }
      }
    },
    [user, setUser, setSessionPassport],
  );

  const clearPassport = useCallback(() => {
    setSessionPassport(null);
  }, [setSessionPassport]);

  return { passport, source, setPassport, clearPassport };
}
