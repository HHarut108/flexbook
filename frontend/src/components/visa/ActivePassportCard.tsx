import { ShieldCheck, ChevronRight, RotateCcw, UserCircle2 } from 'lucide-react';
import type { AuthUser } from '../../store/auth.store';
import { countryDisplayName } from '../../utils/country.utils';
import type { PassportSource } from '../../hooks/useCurrentPassport';

interface Props {
  passport: string | null;
  source: PassportSource;
  user: AuthUser | null;
  /** ISO-2 of the user's primary profile citizenship (if any). Used to detect
      when an active session passport differs from profile, and to render the
      "reset to your AM" affordance. Independent from `passport` so the card
      can show both at once when they diverge. */
  profilePassport: string | null;
  /** Whole hours remaining on the session-passport TTL (for guests). */
  sessionHoursLeft: number | null;
  /** Opens the passport picker. The card always offers this as the primary
      affordance — the user can switch to "check for someone else" at any time
      without touching their profile. */
  onOpenPicker: (mode: 'pick' | 'signup') => void;
  /** Clears the session override and falls back to the profile passport.
      Only meaningful for logged-in users with an active override. */
  onResetToProfile: () => void;
}

function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '';
  return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(c.charCodeAt(0) + 127397));
}

/**
 * Always-visible "whose visa are we looking at?" card. Replaces the old binary
 * model where we either showed a "Check visa requirements" CTA (no passport)
 * or hid the passport context entirely (passport set). Four states:
 *
 *   - `none`            → indigo CTA prompting the user to pick a citizenship.
 *   - `profile`         → subtle card naming the user's profile passport.
 *   - `session-override` (logged-in user, session ≠ profile) → amber card
 *     making the "checking for someone else" intent obvious, with a one-click
 *     "back to your profile passport" reset.
 *   - `guest-session`   → amber card with the TTL + sign-up nudge.
 *
 * Key invariant: picking a different passport via the card NEVER mutates the
 * user's profile. Profile updates only happen through the explicit toggle in
 * the picker popup or via the account screen.
 */
export function ActivePassportCard({
  passport,
  source,
  user,
  profilePassport,
  sessionHoursLeft,
  onOpenPicker,
  onResetToProfile,
}: Props) {
  // State A — no passport yet. Indigo CTA matching the previous design so
  // returning users feel continuity with the original prompt.
  if (source === 'none' || !passport) {
    return (
      <button
        type="button"
        onClick={() => onOpenPicker('pick')}
        className="w-full mb-3 inline-flex items-center justify-between gap-3 rounded-2xl border border-indigo-border bg-indigo-soft/40 hover:bg-indigo-soft/60 transition-colors px-3.5 py-2.5 text-left"
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-full bg-indigo/10 flex items-center justify-center shrink-0">
            <ShieldCheck size={14} className="text-indigo" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-text-primary leading-tight">
              Check visa requirements
            </span>
            <span className="block text-[11px] text-text-muted leading-tight">
              Pick a citizenship to see visa status per route.
            </span>
          </span>
        </span>
        <ChevronRight size={16} className="text-indigo shrink-0" />
      </button>
    );
  }

  const passportName = countryDisplayName(passport);
  const isLoggedIn = !!user;
  const hasProfile = !!profilePassport;
  const isOverride = isLoggedIn && hasProfile && source === 'session' && passport !== profilePassport;
  const isProfileMatch = isLoggedIn && source === 'profile';
  const isGuestSession = !isLoggedIn && source === 'session';

  // State C — logged-in user with a session override that differs from their
  // profile. The amber tone + explicit "not your profile" copy make sure the
  // user always knows whose visa they're looking at, and the reset link is one
  // tap away.
  if (isOverride) {
    const profileName = countryDisplayName(profilePassport);
    return (
      <div className="w-full mb-3 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700/40 px-3.5 py-2.5">
        <div className="flex items-start gap-2.5">
          <span className="text-lg leading-none shrink-0 mt-0.5" aria-hidden="true">
            {countryFlag(passport)}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-100 leading-tight">
              Checking for {passportName} passport
            </p>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-200/80 leading-snug mt-0.5">
              This won&apos;t update your profile ({countryFlag(profilePassport)} {profileName}).
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <button
              type="button"
              onClick={onResetToProfile}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo hover:underline"
              title={`Switch back to your ${profileName} passport`}
            >
              <RotateCcw size={11} />
              Use my {profilePassport}
            </button>
            <button
              type="button"
              onClick={() => onOpenPicker('pick')}
              className="text-[11px] text-text-muted hover:text-text-primary"
            >
              change
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State B — logged-in user, profile passport active, no override. Subtle
  // card so the visa context is always visible without being noisy. Includes
  // a "Check for someone else" affordance for the "looking up for my partner"
  // use case the user called out.
  if (isProfileMatch) {
    return (
      <div className="w-full mb-3 rounded-2xl border border-border bg-surface px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-full bg-indigo-soft flex items-center justify-center shrink-0">
            <UserCircle2 size={14} className="text-indigo" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-text-primary leading-tight">
              Visas for your {passportName} passport
              <span className="ml-1 text-base align-middle" aria-hidden="true">
                {countryFlag(passport)}
              </span>
            </p>
            <p className="text-[11px] text-text-muted leading-tight mt-0.5">
              From your profile.{' '}
              <button
                type="button"
                onClick={() => onOpenPicker('pick')}
                className="text-indigo font-semibold hover:underline"
              >
                Check for someone else
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // State D — guest with a session passport. Amber TTL banner with the
  // sign-up conversion nudge (same intent as the old "Saved for Xh" panel,
  // consolidated into the active-passport surface so there's only one
  // passport-context card on the screen).
  if (isGuestSession) {
    return (
      <div className="w-full mb-3 rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700/40 px-3.5 py-2.5">
        <div className="flex items-start gap-2.5">
          <span className="text-lg leading-none shrink-0 mt-0.5" aria-hidden="true">
            {countryFlag(passport)}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-text-primary leading-tight">
              Visas for {passportName} passport
            </p>
            <p className="text-[11px] text-text-muted leading-snug mt-0.5">
              {sessionHoursLeft !== null && sessionHoursLeft > 0 ? (
                <>Saved for {sessionHoursLeft}h. </>
              ) : null}
              <button
                type="button"
                onClick={() => onOpenPicker('signup')}
                className="text-indigo font-semibold hover:underline"
              >
                Sign up
              </button>{' '}
              to keep it across devices.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenPicker('pick')}
            className="text-[11px] text-text-muted hover:text-text-primary shrink-0 self-start mt-0.5"
          >
            change
          </button>
        </div>
      </div>
    );
  }

  // Fallback — logged-in user, source === 'session', and either no profile
  // passport set OR session matches profile. Render the subtle profile-style
  // card so the screen always shows passport context.
  return (
    <div className="w-full mb-3 rounded-2xl border border-border bg-surface px-3.5 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="w-7 h-7 rounded-full bg-indigo-soft flex items-center justify-center shrink-0">
          <UserCircle2 size={14} className="text-indigo" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-text-primary leading-tight">
            Visas for {passportName} passport
            <span className="ml-1 text-base align-middle" aria-hidden="true">
              {countryFlag(passport)}
            </span>
          </p>
          <p className="text-[11px] text-text-muted leading-tight mt-0.5">
            <button
              type="button"
              onClick={() => onOpenPicker('pick')}
              className="text-indigo font-semibold hover:underline"
            >
              Check for someone else
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
