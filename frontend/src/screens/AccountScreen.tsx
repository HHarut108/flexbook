import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, Trash2, Key, User, ChevronRight } from 'lucide-react';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';

type View = 'main' | 'change-password' | 'delete-account';

export function AccountScreen() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [view, setView] = useState<View>('main');

  if (!user) {
    navigate('/login', { replace: true });
    return null;
  }

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
          {view === 'change-password' && 'Change password'}
          {view === 'delete-account' && 'Delete account'}
        </h1>
      </header>

      {view === 'main' && <MainView user={user} logout={logout} navigate={navigate} setView={setView} />}
      {view === 'change-password' && <ChangePasswordView setView={setView} />}
      {view === 'delete-account' && <DeleteAccountView logout={logout} navigate={navigate} />}
    </div>
  );
}

function MainView({ user, logout, navigate, setView }: any) {
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
          <p className="text-sm text-text-muted">Born: {new Date(user.birthday).toLocaleDateString()}</p>
        )}
        {user.citizenships?.length > 0 && (
          <div className="space-y-1">
            {user.citizenships.map((c: any) => (
              <p key={c.id} className="text-sm text-text-muted">
                🌍 {c.countryName}{c.documentNumber ? ` · ${c.documentNumber}` : ''}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
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
