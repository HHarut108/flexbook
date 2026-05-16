import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Eye, EyeOff, Info } from 'lucide-react';
import { authApi } from '../api/auth.api';
import { CountrySelect } from '../components/CountrySelect';
import type { Country } from '../data/countries';

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
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [gender, setGender] = useState<Gender | ''>('');
  const [birthday, setBirthday] = useState('');
  const [citizenships, setCitizenships] = useState<CitizenshipDraft[]>([
    { key: 'c-0', country: null, documentNumber: '' },
  ]);
  const [visas, setVisas] = useState<VisaDraft[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Constrain the native date picker: DOB can't be in the future and must put the
  // user over 13. maxBirthday floors the picker at 13 years before today.
  const today = new Date();
  const maxBirthday = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate())
    .toISOString().slice(0, 10);
  const minBirthday = '1900-01-01';

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

  function addCitizenship() {
    if (citizenships.length < 2) {
      setCitizenships((prev) => [...prev, { key: `c-${Date.now()}`, country: null, documentNumber: '' }]);
    }
  }

  function removeCitizenship(i: number) {
    const removed = citizenships[i];
    setCitizenships((prev) => prev.filter((_, idx) => idx !== i));
    setVisas((prev) => prev.filter((v) => v.citizenshipKey !== removed.key));
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
    if (!birthday) errs.birthday = 'Please enter your date of birth';
    if (form.password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';

    if (birthday) {
      const parsed = new Date(birthday + 'T12:00:00');
      if (isNaN(parsed.getTime())) {
        errs.birthday = 'Please enter a valid date of birth';
      } else {
        const age = today.getFullYear() - parsed.getFullYear() -
          (today < new Date(today.getFullYear(), parsed.getMonth(), parsed.getDate()) ? 1 : 0);
        if (age < 13) errs.birthday = 'You must be at least 13 years old to register';
      }
    }

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
        birthday,
        citizenships: filledCitizenships.length > 0 ? filledCitizenships : undefined,
        visas: visaPayload.length > 0 ? visaPayload : undefined,
      });

      navigate('/verify-email', { state: { email: form.email.trim().toLowerCase() } });
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

        {/* Date of birth — native picker, bounded to a sensible range */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Date of birth *</label>
          <input
            type="date"
            value={birthday}
            onChange={(e) => {
              setBirthday(e.target.value);
              setFieldErrors((er) => ({ ...er, birthday: '' }));
              // Blur immediately after selection — prevents iOS Safari from holding
              // focus on the date input after the native picker is dismissed, which
              // can make other form elements temporarily unresponsive.
              e.target.blur();
            }}
            min={minBirthday}
            max={maxBirthday}
            aria-invalid={!!fieldErrors.birthday}
            className={fieldErrors.birthday ? inputErrCls : inputCls}
          />
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
          className="w-full py-3.5 rounded-xl bg-indigo text-white font-semibold text-sm hover:bg-indigo/90 transition-colors disabled:opacity-60"
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
