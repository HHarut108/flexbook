import { useState } from 'react';
import { X, Headphones, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { TripLeg } from '@fast-travel/shared';
import { formatPrice } from '../utils/price.utils';
import { submitAssistanceRequest } from '../api/assistanceRequests.api';
import { useAuthStore } from '../store/auth.store';

interface Props {
  onClose: () => void;
  origin?: string;
  legs: TripLeg[];
  total: number;
}

type Status = 'idle' | 'submitting' | 'success' | 'error';

export function AssistanceRequestModal({ onClose, origin, legs, total }: Props) {
  const user = useAuthStore((s) => s.user);
  const [fullName, setFullName] = useState(
    user ? `${user.firstName} ${user.lastName}`.trim() : '',
  );
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const emailLocked = !!user;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');
    try {
      const cities = origin
        ? [origin, ...legs.map((l) => l.destinationCity)]
        : legs.map((l) => l.destinationCity);
      await submitAssistanceRequest({
        fullName,
        email,
        phone,
        tripData: {
          origin,
          cities,
          totalPrice: total,
          legs,
        },
      });
      setStatus('success');
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Something went wrong. Please try again.');
      setStatus('error');
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center px-4 pb-6 md:pb-0">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-[448px] md:max-w-lg bg-white rounded-3xl overflow-hidden animate-fade-in"
        style={{ boxShadow: '0 24px 64px rgba(15,23,42,0.20)' }}
      >
        {/* Header */}
        <div
          className="px-5 pt-5 pb-4 flex items-center justify-between"
          style={{
            background: 'linear-gradient(135deg, rgba(55,48,163,0.97) 0%, rgba(79,70,229,0.97) 100%)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <Headphones size={17} className="text-white" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-indigo-200 font-mono mb-0.5">
                Need help?
              </p>
              <h3 className="text-lg font-bold text-white leading-tight">Request assistant help</h3>
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
        <div className="px-5 pt-5 pb-6">
          {status === 'success' ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <CheckCircle2 size={28} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-base font-bold text-text-primary mb-1">Request received!</p>
                <p className="text-sm text-text-muted leading-relaxed">
                  Our team will reach out to you shortly to help with your booking.
                </p>
              </div>
              <button className="btn-primary mt-2" onClick={onClose}>
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-text-muted leading-relaxed">
                Share your contact details and our team will assist you with this{' '}
                {total > 0 ? <span className="font-semibold text-text-primary">{formatPrice(total)}</span> : 'trip'}{' '}
                booking.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-[0.14em] mb-1.5">
                    Full name
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Jane Smith"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input-field w-full px-4 py-3 rounded-2xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-[0.14em] mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="jane@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      readOnly={emailLocked}
                      aria-readonly={emailLocked}
                      title={emailLocked ? 'Signed-in email — managed in your account' : undefined}
                      className={`input-field w-full px-4 py-3 rounded-2xl text-sm ${
                        emailLocked ? 'bg-slate-50 text-text-muted cursor-not-allowed pr-10' : ''
                      }`}
                    />
                    {emailLocked && (
                      <Lock
                        size={14}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-[0.14em] mb-1.5">
                    Phone number
                  </label>
                  <input
                    type="tel"
                    required
                    autoComplete="tel"
                    placeholder="+1 555 000 0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input-field w-full px-4 py-3 rounded-2xl text-sm"
                  />
                </div>
              </div>

              {status === 'error' && (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5">
                  <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{errorMsg}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'submitting'}
                className="btn-primary flex items-center justify-center gap-2"
                style={{ minHeight: '48px' }}
              >
                {status === 'submitting' ? 'Sending request…' : 'Send request'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
