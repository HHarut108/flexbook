import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Eye, EyeOff, Info } from 'lucide-react';
import { authApi } from '../api/auth.api';
import { CountrySelect } from '../components/CountrySelect';
import type { Country } from '../data/countries';
import { usePassportStore } from '../store/passport.store';

interface VisaDraft {
  citizenshipKey: string;
  country: Country | null;
  visaType: string;
  documentNumber: string;
  validUntil: string;
}

interface CitizenshipDraft {
  key: string;
  country: Country | null;
  documentNumber: string;
}

type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

// Letters (including Unicode), space, hyphen, apostrophe. 1–50 chars.
// Cap follows ICAO 9303 guidance — a single name line on a passport tops out at ~39 chars,
// so 50 is generous without inviting abuse.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const NAME_RE = /^[\p{L}][\p{L}\s'\-]{0,49}$/u;
const NAME_MAX = 50;
// RFC 5321: 254 is the realistic upper bound for an email address.
const EMAIL_MAX = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateName(value: string, field: string): string | null {
  const v = value.trim();
  if (!v) return `${field} is required`;
  if (v.length > NAME_MAX) return `${field} must be ${NAME_MAX} characters or fewer`;
  if (!NAME_RE.test(v)) return `${field} can only contain letters, spaces, hyphens and apostrophes`;
  return null;
}

function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Email is required';
  if (v.length > EMAIL_MAX) return `Email must be ${EMAIL_MAX} characters or fewer`;
  if (!EMAIL_RE.test(v)) return 'Please enter a valid email address';
  return null;
}

export function SignUpScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo: string | undefined = (location.state as { returnTo?: string } | null)?.returnTo;
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [gender, setGender] = useState<Gender | ''>('');
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [citizenships, setCitizenships] = useState<CitizenshipDraft[]>([
    { key: 'c-0', country: null, documentNumber: '' },
  ]);
  const [visas, setVisas] = useState<VisaDraft[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const today = new Date();
  const currentYear = today.getFullYear();
  const YEARS = Array.from({ length: currentYear - 13 - 1899 }, (_, i) => currentYear - 13 - i);

  function setField(key: keyof typeof form, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
    if (fieldErrors[key]) setFieldErrors((e) => ({ ...e, [key]: '' }));
  }

  function validateField(key: 'firstName' | 'lastName' | 'email') {
    const label = key === 'firstName' ? 'First name' : key === 'lastName' ? 'Last name' : 'Email';
    const err = key === 'email' ? validateEmail(form[key]) : validateName(form[key], label);
    setFieldErrors((e) => ({ ...e, [key]: err ?? '' }));
  }

  function updateCitizenship(i: number, patch: Partial<CitizenshipDraft>) {
    setCitizenships((prev) => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  }

  function addVisa(citizenshipKey: string) {
    setVisas((prev) => [...prev, { citizenshipKey, country: null, visaType: '', documentNumber: '', validUntil: '' }]);
  }

  function updateVisa(idx: number, patch: Partial<VisaDraft>) {
    setVisas((prev) => prev.map((v, i) => i === idx ? { ...v, ...patch } : v));
  }

  function removeVisa(idx: number) {
    setVisas((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const errs: Record<string, string> = {};
    const fn = validateName(form.firstName, 'First name');
    const ln = validateName(form.lastName, 'Last name');
    const em = validateEmail(form.email);
    if (fn) errs.firstName = fn;
    if (ln) errs.lastName = ln;
    if (em) errs.email = em;
    if (!gender) errs.gender = 'Please select an option';
    if (!birthDay || !birthMonth || !birthYear) {
      errs.birthday = 'Please enter your date of birth';
    } else {
      const mm = String(MONTHS.indexOf(birthMonth) + 1).padStart(2, '0');
      const dd = String(birthDay).padStart(2, '0');
      const candidate = `${birthYear}-${mm}-${dd}`;
      const parsed = new Date(candidate + 'T12:00:00');
      if (isNaN(parsed.getTime()) || parsed.getDate() !== Number(dd)) {
        errs.birthday = 'Invalid date of birth';
      }
    }
    if (form.password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError('Please fix the errors above');
      return;
    }

    setLoading(true);
    try {
      const filledCitizenships = citizenships
        .filter((c) => c.country)
        .map((c, i) => ({
          countryCode: c.country!.code,
          countryName: c.country!.name,
          documentNumber: c.documentNumber.trim() || undefined,
          isPrimary: i === 0,
        }));

      const visaPayload = visas
        .filter((v) => v.country)
        .map((v) => {
          const c = citizenships.find((x) => x.key === v.citizenshipKey);
          return {
            citizenshipCountryCode: c?.country?.code,
            countryCode: v.country!.code,
            countryName: v.country!.name,
            visaType: v.visaType.trim() || undefined,
            documentNumber: v.documentNumber.trim() || undefined,
            validUntil: v.validUntil.trim() || undefined,
          };
        });

      await authApi.register({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        gender: gender as Gender,
        birthday: `${birthYear}-${String(MONTHS.indexOf(birthMonth) + 1).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`,
        citizenships: filledCitizenships.length > 0 ? filledCitizenships : undefined,
        visas: visaPayload.length > 0 ? visaPayload : undefined,
      });

      // Drop any guest-era session passport pick — the user's profile
      // (citizenship or lack thereof) is now the source of truth. Without this,
      // a signed-up user who never provided a citizenship still sees the prior
      // guest's "Visa for X citizens" card on /flights.
      usePassportStore.getState().setSessionPassport(null);

      navigate('/verify-email', {
        state: { email: form.email.trim().toLowerCase(), returnTo },
      });
    } catch (err: any) {
      setError(err.message ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full px-4 py-3 rounded-xl border border-border bg-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-indigo transition-colors';
  const inputErrCls = 'w-full px-4 py-3 rounded-xl border border-red-500/60 bg-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-red-500 transition-colors';

  return (
    <div className="min-h-screen bg-bg flex flex-col max-w-[448px] mx-auto">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-border">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold text-text-primary">Create account</h1>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-6 space-y-4" noValidate>
        {/* Name */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wide">First name *</label>
            <input
              value={form.firstName}
              onChange={(e) => setField('firstName', e.target.value)}
              onBlur={() => validateField('firstName')}
              placeholder="John"
              maxLength={NAME_MAX}
              autoComplete="given-name"
              aria-invalid={!!fieldErrors.firstName}
              className={fieldErrors.firstName ? inputErrCls : inputCls}
            />
            {fieldErrors.firstName && <p className="text-[11px] text-red-500">{fieldErrors.firstName}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Last name *</label>
            <input
              value={form.lastName}
              onChange={(e) => setField('lastName', e.target.value)}
              onBlur={() => validateField('lastName')}
              placeholder="Doe"
              maxLength={NAME_MAX}
              autoComplete="family-name"
              aria-invalid={!!fieldErrors.lastName}
              className={fieldErrors.lastName ? inputErrCls : inputCls}
            />
            {fieldErrors.lastName && <p className="text-[11px] text-red-500">{fieldErrors.lastName}</p>}
          </div>
        </div>

        {/* Gender */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Gender *</label>
          <select
            value={gender}
            onChange={(e) => {
              setGender(e.target.value as Gender | '');
              setFieldErrors((er) => ({ ...er, gender: '' }));
            }}
            aria-invalid={!!fieldErrors.gender}
            className={fieldErrors.gender ? inputErrCls : inputCls}
          >
            <option value="">Select gender</option>
            {GENDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {fieldErrors.gender && <p className="text-[11px] text-red-500">{fieldErrors.gender}</p>}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Email *</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            onBlur={() => validateField('email')}
            placeholder="john@example.com"
            maxLength={EMAIL_MAX}
            autoComplete="email"
            inputMode="email"
            aria-invalid={!!fieldErrors.email}
            className={fieldErrors.email ? inputErrCls : inputCls}
          />
          {fieldErrors.email && <p className="text-[11px] text-red-500">{fieldErrors.email}</p>}
        </div>

        {/* Date of birth — three dropdowns (avoids native date-picker focus issues on iOS Safari) */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Date of birth *</label>
          <div className="flex gap-2">
            <select
              value={birthDay}
              onChange={(e) => { setBirthDay(e.target.value); setFieldErrors((er) => ({ ...er, birthday: '' })); }}
              aria-invalid={!!fieldErrors.birthday}
              className={fieldErrors.birthday ? inputErrCls : inputCls}
              style={{ minWidth: 0, flex: 1 }}
            >
              <option value="">Day</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select
              value={birthMonth}
              onChange={(e) => { setBirthMonth(e.target.value); setFieldErrors((er) => ({ ...er, birthday: '' })); }}
              aria-invalid={!!fieldErrors.birthday}
              className={fieldErrors.birthday ? inputErrCls : inputCls}
              style={{ minWidth: 0, flex: 2 }}
            >
              <option value="">Month</option>
              {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select
              value={birthYear}
              onChange={(e) => { setBirthYear(e.target.value); setFieldErrors((er) => ({ ...er, birthday: '' })); }}
              aria-invalid={!!fieldErrors.birthday}
              className={fieldErrors.birthday ? inputErrCls : inputCls}
              style={{ minWidth: 0, flex: 1.5 }}
            >
              <option value="">Year</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <p className="text-[11px] text-text-muted">You must be at least 13 to register.</p>
          {fieldErrors.birthday && <p className="text-[11px] text-red-500">{fieldErrors.birthday}</p>}
        </div>

        {/* Citizenship + nested visas (only primary shown; secondary available post-registration) */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Citizenship</label>
            <div className="flex items-start gap-1.5 mt-1">
              <Info size={11} className="text-text-muted mt-0.5 shrink-0" />
              <p className="text-[11px] text-text-muted leading-relaxed">
                Your passport details help us show visa requirements and personalise flight recommendations for you.
              </p>
            </div>
          </div>

          {citizenships.slice(0, 1).map((entry) => {
            const visasForThis = visas.map((v, idx) => ({ v, idx })).filter((x) => x.v.citizenshipKey === entry.key);
            return (
              <div key={entry.key} className="space-y-2 p-3 rounded-xl border border-border bg-surface/50">
                <CountrySelect
                  value={entry.country}
                  onChange={(c) => updateCitizenship(0, { country: c })}
                  placeholder="Select country (optional)"
                />
                {entry.country && (
                  <>
                    <input
                      value={entry.documentNumber}
                      onChange={(e) => updateCitizenship(0, { documentNumber: e.target.value })}
                      placeholder="Passport / ID number (optional)"
                      className={inputCls}
                      maxLength={50}
                    />

                    {/* Visas tied to this passport */}
                    <div className="space-y-2 mt-2">
                      {visasForThis.map(({ v, idx }) => (
                        <div key={idx} className="space-y-2 p-2.5 rounded-lg border border-border bg-bg/40">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-text-muted">Visa for {entry.country!.name} passport</span>
                            <button type="button" onClick={() => removeVisa(idx)} className="text-text-muted hover:text-red-500 transition-colors">
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <CountrySelect
                            value={v.country}
                            onChange={(country) => updateVisa(idx, { country })}
                            placeholder="Visa destination country"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              value={v.visaType}
                              onChange={(e) => updateVisa(idx, { visaType: e.target.value })}
                              placeholder="Type (e.g. Tourist)"
                              maxLength={50}
                              className={inputCls}
                            />
                            <input
                              value={v.documentNumber}
                              onChange={(e) => updateVisa(idx, { documentNumber: e.target.value })}
                              placeholder="Visa number"
                              maxLength={50}
                              className={inputCls}
                            />
                          </div>
                          <label className="block text-[11px] text-text-muted">Valid until</label>
                          <input
                            type="date"
                            value={v.validUntil}
                            onChange={(e) => updateVisa(idx, { validUntil: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addVisa(entry.key)}
                        className="flex items-center gap-1 text-xs text-indigo hover:underline"
                      >
                        <Plus size={13} /> Add visa for this passport
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Password with visibility toggle */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Password *</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => setField('password', e.target.value)}
              placeholder="Min. 8 characters"
              minLength={8}
              autoComplete="new-password"
              aria-invalid={!!fieldErrors.password}
              className={`pr-12 ${fieldErrors.password ? inputErrCls : inputCls}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {fieldErrors.password && <p className="text-[11px] text-red-500">{fieldErrors.password}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Confirm password *</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={(e) => setField('confirmPassword', e.target.value)}
              placeholder="Repeat password"
              autoComplete="new-password"
              aria-invalid={!!fieldErrors.confirmPassword}
              className={`pr-12 ${fieldErrors.confirmPassword ? inputErrCls : inputCls}`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((s) => !s)}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1"
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {fieldErrors.confirmPassword && <p className="text-[11px] text-red-500">{fieldErrors.confirmPassword}</p>}
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-500/10 rounded-xl px-4 py-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>

        <p className="text-center text-sm text-text-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo hover:underline font-medium">Log in</Link>
        </p>
      </form>
    </div>
  );
}
