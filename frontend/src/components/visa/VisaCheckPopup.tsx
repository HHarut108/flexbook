import { useState } from 'react';
import { X, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../../api/auth.api';
import { useAuthStore } from '../../store/auth.store';
import { useCurrentPassport } from '../../hooks/useCurrentPassport';
import { PassportPicker } from './PassportPicker';
import { COUNTRIES } from '../../data/countries';

interface Props {
  onClose: () => void;
  /** Fires after a citizenship has been committed (session or profile). */
  onCommitted?: (code: string) => void;
}

type Mode = 'pick' | 'signup';

/**
 * Visa-requirements onboarding popup. Branches on auth state:
 *
 *   - Guest         → pick citizenship; offer inline signup that preserves the
 *                     citizenship choice across the create-account flow.
 *   - Auth, no passport → pick citizenship; offer a "Save to my profile"
 *                     toggle so the choice persists across devices.
 *   - Auth, with passport → the popup is normally not surfaced; if it is
 *                     opened explicitly (change passport), the picker is shown
 *                     pre-populated with the current selection.
 *
 * In all branches the chosen passport is written to the session store, which
 * unblocks visa-requirement lookups everywhere else in the app.
 */
export function VisaCheckPopup({ onClose, onCommitted }: Props) {
  const user = useAuthStore((s) => s.user);
  const { passport, setPassport } = useCurrentPassport();
  const [selected, setSelected] = useState<string | null>(passport);
  const [saveToProfile, setSaveToProfile] = useState(!!user);
  const [mode, setMode] = useState<Mode>('pick');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline signup state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  function selectedCountryName(code: string | null): string | null {
    if (!code) return null;
    return COUNTRIES.find((c) => c.code === code)?.name ?? code;
  }

  async function handleConfirm() {
    if (!selected) {
      setError('Please pick a citizenship first.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await setPassport(selected, { saveToProfile: !!user && saveToProfile });
      onCommitted?.(selected);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError('Please pick a citizenship first.');
      return;
    }
    if (firstName.trim().length < 1) {
      setError('First name is required');
      return;
    }
    if (lastName.trim().length < 1) {
      setError('Last name is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const countryName = selectedCountryName(selected) ?? selected;
      await authApi.register({
        email: email.trim().toLowerCase(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        citizenships: [
          { countryCode: selected, countryName, isPrimary: true },
        ],
      });
      // Always also persist to the session store so the current search keeps
      // its visa context, even before the email-verification flow completes.
      await setPassport(selected);
      onCommitted?.(selected);
      onClose();
      // The session-cookie part of registration only lands after OTP verify,
      // so we surface a soft toast via the success state — the user's
      // citizenship choice is preserved in the session passport store.
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Signup failed';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center px-4 pb-6 md:pb-0">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-[448px] md:max-w-lg bg-surface rounded-3xl overflow-hidden animate-fade-in"
        style={{ boxShadow: '0 24px 64px rgba(15,23,42,0.20)' }}
      >
        {/* Header */}
        <div
          className="px-5 pt-5 pb-4 flex items-center justify-between"
          style={{
            background: 'linear-gradient(135deg, rgba(55,48,163,0.97) 0%, rgba(79,70,229,0.97) 100%)',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <ShieldCheck size={17} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-indigo-200 font-mono mb-0.5">
                Visa check
              </p>
              <h3 className="text-lg font-bold text-white leading-tight truncate">
                Check visa requirements
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-2xl bg-white/15 flex items-center justify-center text-white hover:bg-white/25 transition-all active:scale-95"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pt-5 pb-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
              Your citizenship
            </label>
            <PassportPicker value={selected} onChange={setSelected} size="md" />
            <p className="mt-2 text-[11px] text-text-muted leading-relaxed">
              We use this to show whether you need a visa for each destination.
            </p>
          </div>

          {/* Branch 1: signed-in user → save-to-profile toggle */}
          {user && mode === 'pick' && (
            <label className="flex items-start gap-2 text-xs text-text-secondary cursor-pointer select-none rounded-xl border border-border bg-surface-2/40 px-3 py-2.5">
              <input
                type="checkbox"
                checked={saveToProfile}
                onChange={(e) => setSaveToProfile(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-indigo"
              />
              <span>
                Add citizenship to my profile
                <span className="block text-[10px] text-text-muted mt-0.5">
                  Persists across devices instead of just this session.
                </span>
              </span>
            </label>
          )}

          {/* Branch 2: guest → toggle into inline signup */}
          {!user && mode === 'pick' && (
            <div className="rounded-xl border border-indigo-border bg-indigo-soft/40 px-3 py-2.5">
              <p className="text-xs font-semibold text-text-primary">Save it for next time?</p>
              <p className="text-[11px] text-text-muted leading-relaxed mt-0.5">
                Create an account in 10 seconds — we&apos;ll keep your visa lookups ready next visit.
              </p>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="mt-2 text-xs font-semibold text-indigo hover:underline"
              >
                Create account →
              </button>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-500 bg-red-500/10 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          {/* Inline signup form */}
          {!user && mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-3" noValidate>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  autoComplete="given-name"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-indigo transition-colors"
                />
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  autoComplete="family-name"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-indigo transition-colors"
                />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-indigo transition-colors"
              />
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (min. 8 characters)"
                  autoComplete="new-password"
                  className="w-full px-3 py-2.5 pr-10 rounded-xl border border-border bg-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-indigo transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="btn-primary"
              >
                {busy ? 'Creating account…' : 'Create account & check visas'}
              </button>
              <button
                type="button"
                onClick={() => setMode('pick')}
                className="block w-full text-center text-[11px] text-text-muted hover:text-text-primary transition-colors"
              >
                ← Back without signing up
              </button>
            </form>
          )}

          {/* Primary CTA (only in pick mode) */}
          {mode === 'pick' && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy || !selected}
              className="btn-primary"
            >
              {busy
                ? 'Saving…'
                : user && saveToProfile
                  ? 'Save to profile & check visas'
                  : 'Check visas'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
