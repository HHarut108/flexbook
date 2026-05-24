import { useState, useEffect } from 'react';
import { useNavigate, NavigateFunction } from 'react-router-dom';
import { ArrowLeft, LogOut, Trash2, Key, User, ChevronRight, Pencil, Plus, MapPin, Loader2 } from 'lucide-react';
import { authApi } from '../api/auth.api';
import { useAuthStore, AuthUser, UserVisa } from '../store/auth.store';
import { CountrySelect } from '../components/CountrySelect';
import { COUNTRIES, type Country } from '../data/countries';

type View = 'main' | 'edit-profile' | 'change-password' | 'delete-account';

function formatBirthday(birthday: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthday);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString();
  }
  return new Date(birthday).toLocaleDateString();
}

export function AccountScreen() {
  const navigate = useNavigate();
  const { user, loading: authLoading, logout } = useAuthStore();
  const [view, setView] = useState<View>('main');

  useEffect(() => {
    if (!authLoading && !user) navigate('/login', { replace: true });
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 size={32} className="text-indigo animate-spin" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="min-h-screen bg-bg flex flex-col max-w-[448px] mx-auto">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-border">
        <button
          onClick={() => view === 'main' ? navigate(-1) : setView('main')}
          className="p-1 -ml-1 text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold text-text-primary">
          {view === 'main' && 'Account'}
          {view === 'edit-profile' && 'Edit profile'}
          {view === 'change-password' && 'Change password'}
          {view === 'delete-account' && 'Delete account'}
        </h1>
      </header>

      {view === 'main' && <MainView user={user} logout={logout} navigate={navigate} setView={setView} />}
      {view === 'edit-profile' && <EditProfileView user={user} setView={setView} />}
      {view === 'change-password' && <ChangePasswordView setView={setView} />}
      {view === 'delete-account' && <DeleteAccountView logout={logout} navigate={navigate} />}
    </div>
  );
}

interface MainViewProps {
  user: AuthUser;
  logout: () => void;
  navigate: NavigateFunction;
  setView: (v: View) => void;
}

function MainView({ user, logout, navigate, setView }: MainViewProps) {
  async function handleLogout() {
    try { await authApi.logout(); } catch { /* ignore */ }
    logout();
    navigate('/', { replace: true });
  }

  return (
    <div className="flex-1 px-4 py-6 space-y-6">
      {/* Profile */}
      <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo/20 flex items-center justify-center">
            <User size={20} className="text-indigo" />
          </div>
          <div>
            <p className="font-semibold text-text-primary">{user.firstName} {user.lastName}</p>
            <p className="text-sm text-text-muted">{user.email}</p>
          </div>
        </div>
        {user.birthday && (
          <p className="text-sm text-text-muted">Born: {formatBirthday(user.birthday)}</p>
        )}
        {user.countryOfResidenceName && (
          <p className="text-sm text-text-muted flex items-center gap-1">
            <MapPin size={13} /> Lives in {user.countryOfResidenceName}
          </p>
        )}
        {user.citizenships?.length > 0 && (
          <div className="space-y-1">
            {user.citizenships.map((c) => {
              const visasForC = user.visas?.filter((v) => v.citizenshipId === c.id) ?? [];
              return (
                <div key={c.id} className="text-sm text-text-muted">
                  <p>🌍 {c.countryName}{c.documentNumber ? ` · ${c.documentNumber}` : ''}</p>
                  {visasForC.length > 0 && (
                    <ul className="ml-5 mt-0.5 space-y-0.5 text-xs">
                      {visasForC.map((v) => (
                        <li key={v.id}>
                          Visa: {v.countryName}
                          {v.visaType ? ` · ${v.visaType}` : ''}
                          {v.validUntil ? ` · valid until ${v.validUntil}` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
        <button
          onClick={() => setView('edit-profile')}
          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-indigo/5 transition-colors"
        >
          <div className="flex items-center gap-3 text-sm text-text-primary">
            <Pencil size={16} className="text-text-muted" /> Edit profile
          </div>
          <ChevronRight size={16} className="text-text-muted" />
        </button>

        <button
          onClick={() => setView('change-password')}
          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-indigo/5 transition-colors"
        >
          <div className="flex items-center gap-3 text-sm text-text-primary">
            <Key size={16} className="text-text-muted" /> Change password
          </div>
          <ChevronRight size={16} className="text-text-muted" />
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-indigo/5 transition-colors"
        >
          <div className="flex items-center gap-3 text-sm text-text-primary">
            <LogOut size={16} className="text-text-muted" /> Log out
          </div>
          <ChevronRight size={16} className="text-text-muted" />
        </button>

        <button
          onClick={() => setView('delete-account')}
          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-red-500/5 transition-colors"
        >
          <div className="flex items-center gap-3 text-sm text-red-500">
            <Trash2 size={16} /> Delete account
          </div>
          <ChevronRight size={16} className="text-red-400" />
        </button>
      </div>
    </div>
  );
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function findCountry(code?: string | null): Country | null {
  if (!code) return null;
  return COUNTRIES.find((c) => c.code === code) ?? null;
}

interface VisaDraft {
  id?: string;
  citizenshipKey: string; // local key matching the citizenship draft (id or temp)
  country: Country | null;
  visaType: string;
  documentNumber: string;
  validUntil: string;
}

interface CitizenshipDraft {
  id?: string;
  key: string;
  country: Country | null;
  documentNumber: string;
}

function EditProfileView({ user, setView }: { user: AuthUser; setView: (v: View) => void }) {
  const setUser = useAuthStore((s) => s.setUser);

  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);

  const initBirthday = user.birthday ?? '';
  const initParts = /^(\d{4})-(\d{2})-(\d{2})/.exec(initBirthday);
  const [birthDay, setBirthDay] = useState(initParts ? String(Number(initParts[3])) : '');
  const [birthMonth, setBirthMonth] = useState(initParts ? MONTHS[Number(initParts[2]) - 1] : '');
  const [birthYear, setBirthYear] = useState(initParts ? initParts[1] : '');

  const [residence, setResidence] = useState<Country | null>(findCountry(user.countryOfResidenceCode));

  const [citizenships, setCitizenships] = useState<CitizenshipDraft[]>(() =>
    user.citizenships.length > 0
      ? user.citizenships.map((c) => ({
          id: c.id,
          key: c.id,
          country: findCountry(c.countryCode),
          documentNumber: c.documentNumber ?? '',
        }))
      : [{ key: 'new-0', country: null, documentNumber: '' }],
  );

  const [visas, setVisas] = useState<VisaDraft[]>(() =>
    user.visas?.map((v: UserVisa) => ({
      id: v.id,
      citizenshipKey: v.citizenshipId,
      country: findCountry(v.countryCode),
      visaType: v.visaType ?? '',
      documentNumber: v.documentNumber ?? '',
      validUntil: v.validUntil ?? '',
    })) ?? [],
  );

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const currentYear = new Date().getFullYear();
  const YEARS = Array.from({ length: currentYear - 1899 }, (_, i) => currentYear - i);

  function addCitizenship() {
    if (citizenships.length >= 2) return;
    setCitizenships((prev) => [...prev, { key: `new-${prev.length}`, country: null, documentNumber: '' }]);
  }

  function removeCitizenship(i: number) {
    const removed = citizenships[i];
    setCitizenships((prev) => prev.filter((_, idx) => idx !== i));
    // Drop any visas attached to the removed citizenship
    setVisas((prev) => prev.filter((v) => v.citizenshipKey !== removed.key));
  }

  function updateCitizenship(i: number, patch: Partial<CitizenshipDraft>) {
    setCitizenships((prev) => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  }

  function addVisa(citizenshipKey: string) {
    setVisas((prev) => [...prev, { citizenshipKey, country: null, visaType: '', documentNumber: '', validUntil: '' }]);
  }

  function removeVisa(idx: number) {
    setVisas((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateVisa(idx: number, patch: Partial<VisaDraft>) {
    setVisas((prev) => prev.map((v, i) => i === idx ? { ...v, ...patch } : v));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Build birthday string from parts (or null to clear).
    let birthday: string | null = null;
    if (birthDay || birthMonth || birthYear) {
      if (!birthDay || !birthMonth || !birthYear) {
        setError('Please complete or clear all three date-of-birth fields');
        return;
      }
      const mm = String(MONTHS.indexOf(birthMonth) + 1).padStart(2, '0');
      const dd = String(birthDay).padStart(2, '0');
      birthday = `${birthYear}-${mm}-${dd}`;
      const parsed = new Date(birthday);
      if (isNaN(parsed.getTime()) || parsed.getDate() !== Number(dd)) {
        setError('Invalid date of birth');
        return;
      }
    }

    // Citizenships: require at least one if any visa is set.
    const filledCitizenships = citizenships
      .filter((c) => c.country)
      .map((c, i) => ({
        countryCode: c.country!.code,
        countryName: c.country!.name,
        documentNumber: c.documentNumber.trim() || null,
        isPrimary: i === 0,
      }));

    // Build visa payload, attaching each visa to its citizenship via the local key
    // (which equals the citizenship's existing id or the temp `new-N` key).
    const visaPayload = visas
      .filter((v) => v.country)
      .map((v) => {
        const c = citizenships.find((x) => x.key === v.citizenshipKey);
        return {
          id: v.id,
          citizenshipId: c?.id, // existing rows have an id; new ones don't yet
          citizenshipCountryCode: c?.country?.code, // fallback so backend can resolve after recreate
          countryCode: v.country!.code,
          countryName: v.country!.name,
          visaType: v.visaType.trim() || null,
          documentNumber: v.documentNumber.trim() || null,
          validUntil: v.validUntil.trim() || null,
        };
      });

    setLoading(true);
    try {
      const { user: updated } = await authApi.updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        birthday,
        countryOfResidenceCode: residence?.code ?? null,
        countryOfResidenceName: residence?.name ?? null,
        citizenships: filledCitizenships,
        visas: visaPayload,
      });
      setUser(updated);
      setView('main');
    } catch (err: any) {
      setError(err.message ?? 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full px-4 py-3 rounded-xl border border-border bg-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-indigo transition-colors';
  const selectCls = 'flex-1 px-3 py-3 rounded-xl border border-border bg-surface text-sm text-text-primary focus:outline-none focus:border-indigo transition-colors appearance-none cursor-pointer';

  return (
    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">First name</label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} required />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Last name</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} required />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Date of birth</label>
        <div className="flex gap-2">
          <select value={birthDay} onChange={(e) => setBirthDay(e.target.value)} className={selectCls} style={{ minWidth: 0 }}>
            <option value="">Day</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} className={selectCls} style={{ minWidth: 0, flex: 2 }}>
            <option value="">Month</option>
            {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={birthYear} onChange={(e) => setBirthYear(e.target.value)} className={selectCls} style={{ minWidth: 0, flex: 1.5 }}>
            <option value="">Year</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Country of residence</label>
        <CountrySelect value={residence} onChange={setResidence} placeholder="Select country" />
      </div>

      <div className="space-y-3">
        <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Citizenships & visas</label>
        {citizenships.map((c, i) => {
          const visasForThis = visas.map((v, idx) => ({ v, idx })).filter((x) => x.v.citizenshipKey === c.key);
          return (
            <div key={c.key} className="space-y-2 p-3 rounded-xl border border-border bg-surface/50">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">{i === 0 ? 'Primary' : 'Secondary'} citizenship</span>
                {i > 0 && (
                  <button type="button" onClick={() => removeCitizenship(i)} className="text-text-muted hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <CountrySelect value={c.country} onChange={(country) => updateCitizenship(i, { country })} placeholder="Select country" />
              {c.country && (
                <>
                  <input
                    value={c.documentNumber}
                    onChange={(e) => updateCitizenship(i, { documentNumber: e.target.value })}
                    placeholder="Passport / ID number (optional)"
                    className={inputCls}
                  />

                  {/* Visas connected to this passport */}
                  <div className="space-y-2 mt-2">
                    {visasForThis.map(({ v, idx }) => (
                      <div key={idx} className="space-y-2 p-2.5 rounded-lg border border-border bg-bg/40">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-text-muted">Visa</span>
                          <button type="button" onClick={() => removeVisa(idx)} className="text-text-muted hover:text-red-500 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <CountrySelect
                          value={v.country}
                          onChange={(country) => updateVisa(idx, { country })}
                          placeholder="Destination country"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={v.visaType}
                            onChange={(e) => updateVisa(idx, { visaType: e.target.value })}
                            placeholder="Type (e.g. Tourist)"
                            className={inputCls}
                          />
                          <input
                            value={v.documentNumber}
                            onChange={(e) => updateVisa(idx, { documentNumber: e.target.value })}
                            placeholder="Visa number"
                            className={inputCls}
                          />
                        </div>
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
                      onClick={() => addVisa(c.key)}
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
        {citizenships.length < 2 && (
          <button
            type="button"
            onClick={addCitizenship}
            className="flex items-center gap-1 text-xs text-indigo hover:underline"
          >
            <Plus size={13} /> Add second citizenship
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-500 bg-red-500/10 rounded-xl px-4 py-3">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 rounded-xl bg-indigo text-white font-semibold text-sm hover:bg-indigo/90 transition-colors disabled:opacity-60"
      >
        {loading ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}

function ChangePasswordView({ setView }: { setView: (v: View) => void }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.next !== form.confirm) { setError('New passwords do not match'); return; }
    setLoading(true);
    try {
      await authApi.changePassword(form.current, form.next);
      setSuccess(true);
      setTimeout(() => setView('main'), 1500);
    } catch (err: any) {
      setError(err.message ?? 'Failed to change password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex-1 px-4 py-6 space-y-4">
      {(['current', 'next', 'confirm'] as const).map((key) => (
        <div key={key} className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
            {key === 'current' ? 'Current password' : key === 'next' ? 'New password' : 'Confirm new password'}
          </label>
          <input
            required
            type="password"
            value={form[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            minLength={key !== 'current' ? 8 : undefined}
            className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-sm text-text-primary focus:outline-none focus:border-indigo transition-colors"
          />
        </div>
      ))}

      {error && <p className="text-sm text-red-500 bg-red-500/10 rounded-xl px-4 py-3">{error}</p>}
      {success && <p className="text-sm text-green-600 bg-green-500/10 rounded-xl px-4 py-3">Password updated!</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 rounded-xl bg-indigo text-white font-semibold text-sm hover:bg-indigo/90 transition-colors disabled:opacity-60"
      >
        {loading ? 'Saving…' : 'Update password'}
      </button>
    </form>
  );
}

function DeleteAccountView({ logout, navigate }: { logout: () => void; navigate: any }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (confirm !== 'DELETE') { setError('Type DELETE to confirm'); return; }
    setLoading(true);
    try {
      await authApi.deleteAccount(password);
      logout();
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message ?? 'Failed to delete account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleDelete} className="flex-1 px-4 py-6 space-y-4">
      <div className="bg-red-500/10 rounded-xl px-4 py-3">
        <p className="text-sm text-red-600 font-medium">This action is permanent and cannot be undone.</p>
        <p className="text-sm text-red-500 mt-1">All your data will be deleted immediately.</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Your password</label>
        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-sm text-text-primary focus:outline-none focus:border-red-500 transition-colors"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Type DELETE to confirm</label>
        <input
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="DELETE"
          className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-sm text-text-primary focus:outline-none focus:border-red-500 transition-colors"
        />
      </div>

      {error && <p className="text-sm text-red-500 bg-red-500/10 rounded-xl px-4 py-3">{error}</p>}

      <button
        type="submit"
        disabled={loading || confirm !== 'DELETE'}
        className="w-full py-3.5 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-colors disabled:opacity-50"
      >
        {loading ? 'Deleting…' : 'Delete my account'}
      </button>
    </form>
  );
}
