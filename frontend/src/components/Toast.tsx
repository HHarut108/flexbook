import { useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { useSessionStore } from '../store/session.store';

export function Toast() {
  const toast = useSessionStore((s) => s.toast);
  const clearToast = useSessionStore((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, 3500);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  if (!toast) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
      style={{ width: 'calc(100% - 2rem)', maxWidth: '400px' }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-2xl text-white text-sm font-medium pointer-events-auto animate-fade-in"
        style={{
          background: 'linear-gradient(135deg, #14A085 0%, #0f8a73 100%)',
          boxShadow: '0 8px 28px rgba(20,160,133,0.40), 0 2px 0 rgba(255,255,255,0.15) inset',
        }}
      >
        <CheckCircle size={16} className="shrink-0" />
        <span className="flex-1">{toast}</span>
        <button
          onClick={clearToast}
          className="opacity-70 hover:opacity-100 transition-opacity pointer-events-auto"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
