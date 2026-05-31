import { useState } from 'react';
import {
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  UserCircle2,
  Save,
  X,
  Globe2,
  FileCheck,
  ShieldAlert,
  ShieldX,
} from 'lucide-react';
import type { AuthUser } from '../../store/auth.store';
import type { VisaRequirement } from '../../api/visa.api';
import { countryDisplayName } from '../../utils/country.utils';
import type { PassportSource } from '../../hooks/useCurrentPassport';

type Status = VisaRequirement['status'];

interface SummaryEntry {
  country: string;
  visa: VisaRequirement;
}

interface Props {
  passport: string | null;
  source: PassportSource;
  user: AuthUser | null;
  /** ISO-2 of the user's primary profile citizenship (if any). */
  profilePassport: string | null;
  /** Per-country visa results. When present, the card grows a second row with
      the aggregate status summary so the user gets passport context AND the
      visa breakdown in one surface. */
  summaryEntries?: SummaryEntry[];
  onOpenPicker: (mode: 'pick' | 'signup') => void;
  /** Clears the session passport. Behaviour differs by state:
      - Logged-in with profile + session override → reverts to profile passport.
      - Guest or logged-in without profile → drops the passport entirely (the
        "X / dismiss" affordance). */
  onClearSession: () => void;
  /** Promotes the current session passport into the user's profile. Only
      meaningful for logged-in users without a profile citizenship who have
      picked a session passport. */
  onSaveToProfile?: () => void;
}

const STATUS_ORDER: Status[] = [
  'visa free',
  'visa on arrival',
  'eta',
  'e-visa',
  'visa required',
  'no admission',
];

const STATUS_SHORT: Record<Status, string> = {
  'visa free': 'visa-free',
  'visa on arrival': 'on arrival',
  eta: 'ETA',
  'e-visa': 'eVisa',
  'visa required': 'visa required',
  'no admission': 'no admission',
};

const STATUS_TONE: Record<Status, string> = {
  'visa free': 'text-emerald-700 dark:text-emerald-300',
  'visa on arrival': 'text-amber-700 dark:text-amber-300',
  eta: 'text-sky-700 dark:text-sky-300',
  'e-visa': 'text-sky-700 dark:text-sky-300',
  'visa required': 'text-rose-700 dark:text-rose-300',
  'no admission': 'text-rose-700 dark:text-rose-300',
};

const STATUS_ICON: Record<Status, typeof ShieldCheck> = {
  'visa free': ShieldCheck,
  'visa on arrival': FileCheck,
  eta: Globe2,
  'e-visa': Globe2,
  'visa required': ShieldAlert,
  'no admission': ShieldX,
};

function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '';
  return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(c.charCodeAt(0) + 127397));
}

/**
 * Single "whose visa are we looking at?" + status-summary surface for the
 * results screen. Replaces the prior two-card layout (separate context banner
 * + separate VisaResultsSummary) — both repeated the passport name and felt
 * redundant.
 *
 * Header row varies by state (no passport / guest session / profile match /
 * session override / logged-in no profile). When per-country visa results are
 * resolved, a second row renders the aggregate ("X visa-free, Y visa required")
 * with the same expand-for-breakdown behaviour the old summary had.
 *
 * Key invariant: picking a different passport via the card never mutates the
 * user's profile. Profile writes only happen through the explicit "Save to
 * profile" affordance here (logged-in users without a profile citizenship) or
 * the toggle in the picker popup.
 */
export function ActivePassportCard({
  passport,
  source,
  user,
  profilePassport,
  summaryEntries,
  onOpenPicker,
  onClearSession,
  onSaveToProfile,
}: Props) {
  // State A — no passport yet. Indigo CTA, no summary row (we have nothing to
  // resolve against until a passport is picked).
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
  const isLoggedInNoProfile = isLoggedIn && !hasProfile && source === 'session';

  // Card tone — amber for "this isn't your saved passport" states (override,
  // guest pick, logged-in pick without a profile), neutral for the
  // profile-match steady state.
  const tone =
    isOverride || isGuestSession || isLoggedInNoProfile
      ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700/40'
      : 'border-border bg-surface';

  const headerRow = (() => {
    // State C — logged-in user with a session override that differs from
    // their profile. Amber tone + explicit "not your profile" copy + one-tap
    // reset to the profile passport.
    if (isOverride) {
      const profileName = countryDisplayName(profilePassport);
      return (
        <div className="flex items-start gap-2.5">
          <span className="text-lg leading-none shrink-0 mt-0.5" aria-hidden="true">
            {countryFlag(passport)}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-100 leading-tight">
              Checking with {passportName} citizenship
            </p>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-200/80 leading-snug mt-0.5">
              This won&apos;t change your profile ({countryFlag(profilePassport)} {profileName}).
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <button
              type="button"
              onClick={onClearSession}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo hover:underline"
              title={`Switch back to your ${profileName} citizenship`}
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
      );
    }

    // State B — logged-in, profile passport active, no override. Subtle row
    // with the "Check for someone else" affordance.
    if (isProfileMatch) {
      return (
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-full bg-indigo-soft flex items-center justify-center shrink-0">
            <UserCircle2 size={14} className="text-indigo" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-text-primary leading-tight">
              Visa requirements for {passportName} citizens
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
      );
    }

    // State D — logged-in user who picked a passport but has no profile
    // citizenship saved. Offer "Save to profile" so they don't have to
    // re-pick on every visit, plus X to drop the session pick entirely.
    if (isLoggedInNoProfile) {
      return (
        <div className="flex items-start gap-2.5">
          <span className="text-lg leading-none shrink-0 mt-0.5" aria-hidden="true">
            {countryFlag(passport)}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-text-primary leading-tight">
              Visa requirements for {passportName} citizens
            </p>
            <p className="text-[11px] text-text-muted leading-snug mt-0.5">
              Just for this session.{' '}
              {onSaveToProfile && (
                <button
                  type="button"
                  onClick={onSaveToProfile}
                  className="inline-flex items-center gap-1 text-indigo font-semibold hover:underline"
                >
                  <Save size={10} />
                  Save to profile
                </button>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onOpenPicker('pick')}
              className="text-[11px] text-text-muted hover:text-text-primary"
            >
              change
            </button>
            <button
              type="button"
              onClick={onClearSession}
              aria-label="Clear visa citizenship"
              className="w-6 h-6 flex items-center justify-center rounded-full text-text-muted hover:text-text-primary hover:bg-surface-2/60 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      );
    }

    // State E — guest with a session passport. Same "change / dismiss"
    // affordances as State D minus the save-to-profile (no account to save
    // to). The 24h TTL banner from the previous design is gone — the picked
    // passport now lives in sessionStorage and expires when the tab closes.
    if (isGuestSession) {
      return (
        <div className="flex items-start gap-2.5">
          <span className="text-lg leading-none shrink-0 mt-0.5" aria-hidden="true">
            {countryFlag(passport)}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-text-primary leading-tight">
              Visa requirements for {passportName} citizens
            </p>
            <p className="text-[11px] text-text-muted leading-snug mt-0.5">
              Just for this session.{' '}
              <button
                type="button"
                onClick={() => onOpenPicker('signup')}
                className="text-indigo font-semibold hover:underline"
              >
                Sign up
              </button>{' '}
              to save it.
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onOpenPicker('pick')}
              className="text-[11px] text-text-muted hover:text-text-primary"
            >
              change
            </button>
            <button
              type="button"
              onClick={onClearSession}
              aria-label="Clear visa citizenship"
              className="w-6 h-6 flex items-center justify-center rounded-full text-text-muted hover:text-text-primary hover:bg-surface-2/60 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      );
    }

    // Fallback (logged-in with profile but source === 'session' and matches
    // profile) — render the subtle profile-style row.
    return (
      <div className="flex items-center gap-2.5">
        <span className="w-7 h-7 rounded-full bg-indigo-soft flex items-center justify-center shrink-0">
          <UserCircle2 size={14} className="text-indigo" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-text-primary leading-tight">
            Visa requirements for {passportName} citizens
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
    );
  })();

  return (
    <div className={`w-full mb-3 rounded-2xl border ${tone}`}>
      <div className="px-3.5 py-2.5">{headerRow}</div>
      {summaryEntries && summaryEntries.length > 0 && (
        <SummaryRow entries={summaryEntries} />
      )}
    </div>
  );
}

/**
 * Bottom row of the merged card — aggregate visa status across all destination
 * countries currently in the results list, with an expand-for-per-country
 * breakdown. Lives inside ActivePassportCard so the visa context and the
 * summary share one border / one card surface.
 */
function SummaryRow({ entries }: { entries: SummaryEntry[] }) {
  const [expanded, setExpanded] = useState(false);

  const byStatus = new Map<Status, SummaryEntry[]>();
  for (const entry of entries) {
    const list = byStatus.get(entry.visa.status) ?? [];
    list.push(entry);
    byStatus.set(entry.visa.status, list);
  }
  const ordered = STATUS_ORDER.flatMap((status) => {
    const list = byStatus.get(status);
    return list ? [{ status, list }] : [];
  });
  if (ordered.length === 0) return null;

  return (
    <button
      type="button"
      onClick={() => setExpanded((e) => !e)}
      aria-expanded={expanded}
      className="w-full text-left border-t border-border/60 dark:border-white/10 px-3.5 py-2 hover:bg-surface-2/40 transition-colors rounded-b-2xl"
    >
      <div className="flex items-center gap-2">
        <p className="text-[12px] text-text-secondary leading-snug flex-1 min-w-0">
          {ordered.map((group, i) => (
            <span key={group.status}>
              <span className={`font-semibold ${STATUS_TONE[group.status]}`}>
                {group.list.length} {STATUS_SHORT[group.status]}
              </span>
              {i < ordered.length - 1 && <span className="text-text-muted">, </span>}
            </span>
          ))}
        </p>
        <ChevronDown
          size={14}
          className={`text-text-muted shrink-0 motion-safe:transition-transform ${expanded ? '' : '-rotate-90'}`}
        />
      </div>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-border/60 dark:border-white/10 space-y-1.5">
          {ordered.map((group) => {
            const Icon = STATUS_ICON[group.status];
            return (
              <div key={group.status} className="flex items-start gap-2">
                <Icon size={12} className={`mt-0.5 shrink-0 ${STATUS_TONE[group.status]}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-[11px] font-semibold uppercase tracking-wide ${STATUS_TONE[group.status]}`}>
                    {STATUS_SHORT[group.status]}
                    {group.list[0].visa.days && (
                      <span className="ml-1 text-text-muted normal-case tracking-normal">
                        · up to {group.list[0].visa.days}d
                      </span>
                    )}
                  </p>
                  <p className="text-[12px] text-text-secondary mt-0.5">
                    {group.list.map((e) => e.country).join(', ')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </button>
  );
}
