import { useState } from 'react';
import { X, ShieldCheck, Sparkles, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../../api/auth.api';
import { useAuthStore } from '../../store/auth.store';
import { useCurrentPassport } from '../../hooks/useCurrentPassport';
import { PassportPicker } from './PassportPicker';
import { COUNTRIES } from '../../data/countries';

type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  onClose: () => void;
  /** Fires after a citizenship has been committed (session or profile). */
  onCommitted?: (code: string) => void;
  /** Initial step. Default 'pick'. Use 'signup' when the entry point is the
      "Sign up for personalized recommendations" nudge so the user lands
      directly on the signup form (guest-only — ignored when signed in). */
  initialMode?: 'pick' | 'signup';
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
export function VisaCheckPopup({ onClose, onCommitted, initialMode = 'pick' }: Props) {
  const user = useAuthStore((s) => s.user);
  const { passport, setPassport } = useCurrentPassport();
  const [selected, setSelected] = useState<string | null>(passport);
  const [saveToProfile, setSaveToProfile] = useState(!!user);
  // Honor initialMode only for guests — signed-in users have no signup path.
  const [mode, setMode] = useState<Mode>(!user && initialMode === 'signup' ? 'signup' : 'pick');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline signup state — mirrors the mandatory fields of /signup so a
  // popup-initiated registration produces the same profile as the full form.
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const currentYear = new Date().getFullYear();
  // 13+ minimum (matches /signup) — keeps us out of COPPA territory.
  const YEARS = Array.from({ length: currentYear - 13 - 1899 }, (_, i) => currentYear - 13 - i);

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
    if (!gender) {
      setError('Please select a gender');
      return;
    }
    if (!birthDay || !birthMonth || !birthYear) {
      setError('Please enter your date of birth');
      return;
    }
    const mm = String(MONTHS.indexOf(birthMonth) + 1).padStart(2, '0');
    const dd = String(birthDay).padStart(2, '0');
    const birthday = `${birthYear}-${mm}-${dd}`;
    const parsedDob = new Date(`${birthday}T12:00:00`);
    if (isNaN(parsedDob.getTime()) || parsedDob.getDate() !== Number(dd)) {
      setError('Invalid date of birth');
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
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
        gender: gender as Gender,
        birthday,
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
        {/* Header — copy adapts to the active step. In signup mode we
            reframe around personalisation (the user is no longer doing a
            visa check at that point, they're creating an account), and swap
            the shield icon for a sparkles glyph. */}
        <div
          className="px-5 pt-5 pb-4 flex items-center justify-between"
          style={{
            background: 'linear-gradient(135deg, rgba(55,48,163,0.97) 0%, rgba(79,70,229,0.97) 100%)',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              {mode === 'signup' ? (
                <Sparkles size={17} className="text-white" />
              ) : (
                <ShieldCheck size={17} className="text-white" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-indigo-200 font-mono mb-0.5">
                {mode === 'signup' ? 'Sign up' : 'Visa check'}
              </p>
              <h3 className="text-lg font-bold text-white leading-tight">
                {mode === 'signup'
                  ? 'Get personalized recommendations'
                  : 'Check visa requirements'}
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
              <p className="text-xs font-semibold text-text-primary">Want personalized recommendations?</p>
              <p className="text-[11px] text-text-muted leading-relaxed mt-0.5">
                Sign up to save your travel profile and tailor flights, stays and visa lookups to you.
              </p>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="mt-2 text-xs font-semibold text-indigo hover:underline"
              >
                Sign up →
              </button>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-500 bg-red-500/10 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          {/* Inline signup form — collects the same mandatory fields as the
              full /signup screen so a popup-initiated registration produces
              the same profile (name, gender, DOB, email, password) and
              attaches the picked citizenship in one shot. */}
          {!user && mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1" noValidate>
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
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender | '')}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-sm text-text-primary focus:outline-none focus:border-indigo transition-colors"
              >
                <option value="">Gender</option>
                {GENDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-text-muted mb-1">Date of birth</p>
                <div className="flex gap-2">
                  <select
                    value={birthDay}
                    onChange={(e) => setBirthDay(e.target.value)}
                    className="flex-1 min-w-0 px-2 py-2.5 rounded-xl border border-border bg-surface text-sm text-text-primary focus:outline-none focus:border-indigo transition-colors"
                  >
                    <option value="">Day</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <select
                    value={birthMonth}
                    onChange={(e) => setBirthMonth(e.target.value)}
                    style={{ flex: 2, minWidth: 0 }}
                    className="px-2 py-2.5 rounded-xl border border-border bg-surface text-sm text-text-primary focus:outline-none focus:border-indigo transition-colors"
                  >
                    <option value="">Month</option>
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    style={{ flex: 1.5, minWidth: 0 }}
                    className="px-2 py-2.5 rounded-xl border border-border bg-surface text-sm text-text-primary focus:outline-none focus:border-indigo transition-colors"
                  >
                    <option value="">Year</option>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
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
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  className="w-full px-3 py-2.5 pr-10 rounded-xl border border-border bg-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-indigo transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="btn-primary"
              >
                {busy ? 'Creating account…' : 'Create account'}
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
