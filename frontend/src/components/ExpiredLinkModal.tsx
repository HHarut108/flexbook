import { Clock, X } from 'lucide-react';
import { useSessionStore } from '../store/session.store';

export function ExpiredLinkModal() {
  const expiredLinkModal = useSessionStore((s) => s.expiredLinkModal);
  const closeExpiredLinkModal = useSessionStore((s) => s.closeExpiredLinkModal);

  if (!expiredLinkModal) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={closeExpiredLinkModal}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-[380px] bg-white rounded-3xl overflow-hidden animate-fade-in"
        style={{ boxShadow: '0 24px 64px rgba(15,23,42,0.20)' }}
      >
        {/* Close button */}
        <button
          onClick={closeExpiredLinkModal}
          className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-surface border border-border flex items-center justify-center text-text-muted hover:text-text-primary transition-all active:scale-95 z-10"
        >
          <X size={14} />
        </button>

        {/* Icon */}
        <div className="flex justify-center pt-8 pb-3">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)', border: '1px solid #FCD34D' }}
          >
            <Clock size={28} className="text-amber-500" />
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-7 text-center">
          <h3 className="text-xl font-bold text-text-primary mb-2">Link expired</h3>
          <p className="text-sm text-text-muted leading-relaxed mb-6">
            This trip link is no longer active. Trip links expire after{' '}
            <span className="font-semibold text-text-primary">24 hours</span>.
            Ask the sender to share a fresh link.
          </p>
          <button
            onClick={closeExpiredLinkModal}
            className="btn-primary"
          >
            Plan a new trip
          </button>
        </div>
      </div>
    </div>
  );
}
