import { useState } from 'react';
import { X, Copy, Check, Clock } from 'lucide-react';
import { useSessionStore } from '../store/session.store';

export function ShareModal() {
  const shareModal = useSessionStore((s) => s.shareModal);
  const closeShareModal = useSessionStore((s) => s.closeShareModal);
  const [copied, setCopied] = useState(false);

  if (!shareModal) return null;

  async function handleCopy() {
    const url = shareModal!.url;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for restricted clipboard contexts
      const el = document.createElement('textarea');
      el.value = url;
      el.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center px-4 pb-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={closeShareModal}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-[448px] bg-white rounded-3xl overflow-hidden animate-fade-in"
        style={{ boxShadow: '0 24px 64px rgba(15,23,42,0.20)' }}
      >
        {/* Header */}
        <div
          className="px-5 pt-5 pb-4 flex items-center justify-between"
          style={{
            background: 'linear-gradient(135deg, rgba(55,48,163,0.97) 0%, rgba(79,70,229,0.97) 100%)',
          }}
        >
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-indigo-200 font-mono mb-0.5">
              Share your trip
            </p>
            <h3 className="text-lg font-bold text-white">Trip link ready</h3>
          </div>
          <button
            onClick={closeShareModal}
            className="w-9 h-9 rounded-2xl bg-white/15 flex items-center justify-center text-white hover:bg-white/25 transition-all active:scale-95"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pt-5 pb-6 space-y-4">
          {/* URL box */}
          <div className="flex items-center gap-2 bg-surface rounded-2xl border border-border px-4 py-3">
            <span className="flex-1 text-sm text-text-primary font-mono truncate select-all">
              {shareModal.url}
            </span>
            <button
              onClick={handleCopy}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                copied
                  ? 'bg-emerald-500 text-white'
                  : 'bg-indigo text-white hover:bg-indigo/90'
              }`}
            >
              {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
            </button>
          </div>

          {/* 24h notice */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <Clock size={15} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              This link is active for <span className="font-semibold">24 hours</span>. After that it expires and the recipient will need to ask for a new link in order to view the trip plan.
            </p>
          </div>

          <button
            onClick={closeShareModal}
            className="btn-outline text-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
