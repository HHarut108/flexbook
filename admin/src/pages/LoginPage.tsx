import { useState, FormEvent } from 'react';
import { Zap, AlertCircle } from 'lucide-react';
import { storeToken } from '../auth';
import { adminLogin } from '../api/metrics';

interface Props {
  onSuccess: () => void;
}

export function LoginPage({ onSuccess }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shaking, setShaking] = useState(false);

  function shake() {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const token = await adminLogin(password);
      storeToken(token);
      onSuccess();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : 'Login failed.');
      setError(msg);
      shake();
      setPassword('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login">
      <div className={`admin-login__card ${shaking ? 'admin-login__card--shake' : ''}`}>
        <div className="admin-login__brand">
          <Zap size={28} className="admin-login__brand-icon" />
          <div>
            <div className="admin-login__brand-name">FlexBook Admin</div>
            <div className="admin-login__brand-sub">Internal dashboard</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="admin-login__form">
          <label className="admin-login__label" htmlFor="admin-pw">
            Password
          </label>
          <input
            id="admin-pw"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            className="admin-login__input"
            placeholder="Enter admin password"
            autoFocus
            autoComplete="current-password"
            disabled={loading}
          />
          {error && (
            <p className="admin-login__error">
              <AlertCircle size={14} />
              {error}
            </p>
          )}
          <button type="submit" className="admin-login__btn" disabled={!password || loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
