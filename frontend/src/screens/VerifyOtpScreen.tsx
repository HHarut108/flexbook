import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';

export function VerifyOtpScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const email: string = (location.state as any)?.email ?? '';
  const setUser = useAuthStore((s) => s.setUser);

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!email) navigate('/signup', { replace: true });
  }, [email, navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  function handleDigit(i: number, val: string) {
    const char = val.replace(/\D/g, '').slice(-1);
    const next = digits.map((d, idx) => (idx === i ? char : d));
    setDigits(next);
    if (char && i < 5) inputRefs.current[i + 1]?.focus();
    if (next.every((d) => d)) submitCode(next.join(''));
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setDigits(text.split(''));
      submitCode(text);
    }
  }

  async function submitCode(code: string) {
    setError('');
    setLoading(true);
    try {
      const { user } = await authApi.verifyOtp(email, code);
      setUser(user);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message ?? 'Invalid code');
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    try {
      await authApi.resendOtp(email);
      setResendCooldown(60);
      setError('');
    } catch (err: any) {
      setError(err.message ?? 'Failed to resend code');
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col max-w-[448px] mx-auto">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-border">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold text-text-primary">Verify email</h1>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-indigo/10 flex items-center justify-center">
          <Mail size={28} className="text-indigo" />
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">Check your email</h2>
          <p className="text-sm text-text-muted">
            We sent a 6-digit code to<br />
            <span className="text-text-primary font-medium">{email}</span>
          </p>
        </div>

        {/* OTP inputs */}
        <div className="flex gap-3" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              disabled={loading}
              onChange={(e) => handleDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-12 h-14 text-center text-xl font-bold rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:border-indigo transition-colors disabled:opacity-50"
            />
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-500/10 rounded-xl px-4 py-3 w-full text-center">{error}</p>
        )}

        {loading && (
          <p className="text-sm text-text-muted">Verifying…</p>
        )}

        <p className="text-sm text-text-muted">
          Didn't receive a code?{' '}
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className="text-indigo hover:underline disabled:opacity-50 disabled:no-underline font-medium"
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend'}
          </button>
        </p>

        <p className="text-xs text-text-muted text-center">
          Code expires in 10 minutes
        </p>
      </div>
    </div>
  );
}
