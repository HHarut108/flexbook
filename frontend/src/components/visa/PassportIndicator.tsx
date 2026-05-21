import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { useCurrentPassport } from '../../hooks/useCurrentPassport';
import { PassportPicker } from './PassportPicker';

function countryFlag(code: string): string {
  return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(c.charCodeAt(0) + 127397));
}

/**
 * Header indicator that shows the active passport for visa lookups, and lets
 * the user pick / change it inline. Behavior depends on auth + resolution
 * source:
 *
 *   - `none`     → "Pick your passport to see visa requirements" prompt with
 *                  the picker visible by default.
 *   - `session`/`profile` → compact "🇦🇲 Armenia · change" chip; opens the
 *                  picker on click.
 *
 * When a signed-in user changes their passport via the picker we offer a
 * one-click "Save to my profile" toggle so the choice can persist across
 * devices. Guests see a subtle "Create account to save →" link instead.
 */
export function PassportIndicator() {
  const user = useAuthStore((s) => s.user);
  const { passport, source, setPassport } = useCurrentPassport();
  const [saveToProfile, setSaveToProfile] = useState(false);
  const [expanded, setExpanded] = useState(source === 'none');

  async function handlePick(code: string) {
    await setPassport(code, { saveToProfile: !!user && saveToProfile });
    setExpanded(false);
  }

  if (source === 'none' || expanded) {
    return (
      <div className="rounded-2xl border border-indigo-border bg-indigo-soft/40 px-3.5 py-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-text-primary">
            {source === 'none' ? 'Pick your passport for visa checks:' : 'Change passport:'}
          </span>
          <PassportPicker value={passport} onChange={handlePick} size="sm" />
        </div>
        {user ? (
          <label className="mt-2 flex items-center gap-1.5 text-[11px] text-text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={saveToProfile}
              onChange={(e) => setSaveToProfile(e.target.checked)}
              className="h-3 w-3 rounded border-border accent-indigo"
            />
            Save this to my profile
          </label>
        ) : (
          <p className="mt-2 text-[11px] text-text-muted">
            <Link to="/signup" className="text-indigo hover:underline">
              Create an account
            </Link>{' '}
            to save your passport.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 text-[11px] text-text-muted">
      <span>Visa requirements for</span>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-semibold text-text-primary hover:border-indigo-border transition-colors"
      >
        <span>{passport ? countryFlag(passport) : ''}</span>
        <span>{passport}</span>
      </button>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-indigo hover:underline"
      >
        change
      </button>
    </div>
  );
}
