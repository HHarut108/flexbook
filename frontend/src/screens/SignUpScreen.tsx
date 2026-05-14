import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { authApi } from '../api/auth.api';
import { CountrySelect } from '../components/CountrySelect';
import type { Country } from '../data/countries';

interface CitizenshipEntry {
  country: Country | null;
  documentNumber: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 1899 }, (_, i) => currentYear - i);

export function SignUpScreen() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [citizenships, setCitizenships] = useState<CitizenshipEntry[]>([{ country: null, documentNumber: '' }]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function setField(key: keyof typeof form, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function updateCitizenship(i: number, patch: Partial<CitizenshipEntry>) {
    setCitizenships((prev) => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  }

  function addCitizenship() {
    if (citizenships.length < 2) setCitizenships((prev) => [...prev, { country: null, documentNumber: '' }]);
  }

  function removeCitizenship(i: number) {
    setCitizenships((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!birthDay || !birthMonth || !birthYear) {
      setError('Please enter your date of birth');
      return;
    }

    const mm = String(MONTHS.indexOf(birthMonth) + 1).padStart(2, '0');
    const dd = String(birthDay).padStart(2, '0');
    const birthday = `${birthYear}-${mm}-${dd}`;

    setLoading(true);
    try {
      const filledCitizenships = citizenships
        .filter((c) => c.country)
        .map((c, i) => ({
          countryCode: c.country!.code,
          countryName: c.country!.name,
          documentNumber: c.documentNumber || undefined,
          isPrimary: i === 0,
        }));

      await authApi.register({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        birthday,
        citizenships: filledCitizenships.length > 0 ? filledCitizenships : undefined,
      });

      navigate('/verify-email', { state: { email: form.email } });
    } catch (err: any) {
      setError(err.message ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  const selectClass = 'flex-1 px-3 py-3 rounded-xl border border-border bg-surface text-sm text-text-primary focus:outline-none focus:border-indigo transition-colors appearance-none cursor-pointer';

  return (
    <div className="min-h-screen bg-bg flex flex-col max-w-[448px] mx-auto">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-border">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold text-text-primary">Create account</h1>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {/* Name */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wide">First name *</label>
            <input
              required
              value={form.firstName}
              onChange={(e) => setField('firstName', e.target.value)}
              placeholder="John"
              className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-indigo transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Last name *</label>
            <input
              required
              value={form.lastName}
              onChange={(e) => setField('lastName', e.target.value)}
              placeholder="Doe"
              className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-indigo transition-colors"
            />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Email *</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            placeholder="john@example.com"
            className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-indigo transition-colors"
          />
        </div>

        {/* Birthday — Day / Month / Year dropdowns */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Date of birth *</label>
          <div className="flex gap-2">
            <select
              value={birthDay}
              onChange={(e) => setBirthDay(e.target.value)}
              className={selectClass}
              style={{ minWidth: 0 }}
            >
              <option value="">Day</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <select
              value={birthMonth}
              onChange={(e) => setBirthMonth(e.target.value)}
              className={selectClass}
              style={{ minWidth: 0, flex: 2 }}
            >
              <option value="">Month</option>
              {MONTHS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <select
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              className={selectClass}
              style={{ minWidth: 0, flex: 1.5 }}
            >
              <option value="">Year</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Citizenships */}
        <div className="space-y-3">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Citizenship</label>

          {citizenships.map((entry, i) => (
            <div key={i} className="space-y-2 p-3 rounded-xl border border-border bg-surface/50">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">{i === 0 ? 'Primary' : 'Secondary'} citizenship</span>
                {i > 0 && (
                  <button type="button" onClick={() => removeCitizenship(i)} className="text-text-muted hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <CountrySelect
                value={entry.country}
                onChange={(c) => updateCitizenship(i, { country: c })}
                placeholder="Select country (optional)"
              />
              {entry.country && (
                <input
                  value={entry.documentNumber}
                  onChange={(e) => updateCitizenship(i, { documentNumber: e.target.value })}
                  placeholder="Passport / ID number (optional)"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-indigo transition-colors"
                />
              )}
              {i === 0 && citizenships.length < 2 && (
                <button
                  type="button"
                  onClick={addCitizenship}
                  className="flex items-center gap-1 text-xs text-indigo hover:underline mt-1"
                >
                  <Plus size={13} /> Add second citizenship
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Password *</label>
          <input
            required
            type="password"
            value={form.password}
            onChange={(e) => setField('password', e.target.value)}
            placeholder="Min. 8 characters"
            minLength={8}
            className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-indigo transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Confirm password *</label>
          <input
            required
            type="password"
            value={form.confirmPassword}
            onChange={(e) => setField('confirmPassword', e.target.value)}
            placeholder="Repeat password"
            className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-indigo transition-colors"
          />
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
