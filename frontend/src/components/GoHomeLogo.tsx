import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { useTripStore } from '../store/trip.store';
import { useSessionStore } from '../store/session.store';

interface GoHomeLogoProps {
  size?: 'sm' | 'lg';
  variant?: 'light' | 'dark';
  onNavigate?: () => void;
}

export function GoHomeLogo({ size = 'sm', variant = 'dark', onNavigate }: GoHomeLogoProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const origin = useTripStore((s) => s.origin);
  const legs = useTripStore((s) => s.legs);
  const screen = useSessionStore((s) => s.screen);
  const tripReset = useTripStore((s) => s.reset);
  const sessionReset = useSessionStore((s) => s.reset);

  const tripInProgress = screen !== 'home' && origin !== null;
  const nonReturnLegs = legs.filter((l) => !l.isReturn);

  const textSize = size === 'lg' ? 'text-[1.4rem]' : 'text-[1.1rem]';
  const primaryColor = variant === 'light' ? 'text-indigo' : 'text-white';

  const handleConfirm = () => {
    setShowConfirm(false);
    onNavigate?.();
    tripReset();
    sessionReset();
  };

  const logoContent = (
    <>
      <span className={`${textSize} font-black tracking-[-0.05em] ${primaryColor}`}>flex</span>
      <span className={`${textSize} font-black tracking-[-0.05em] text-orange`}>/</span>
      <span className={`${textSize} font-black tracking-[-0.05em] ${primaryColor}`}>book</span>
    </>
  );

  const modal =
    showConfirm &&
    createPortal(
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center p-5"
        style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)' }}
      >
        <div className="bg-surface w-full max-w-sm rounded-3xl shadow-2xl border border-border p-6 animate-fade-in">
          <div className="w-12 h-12 rounded-2xl bg-orange/10 border border-orange/20 flex items-center justify-center mb-4 mx-auto">
            <AlertTriangle size={22} className="text-orange" />
          </div>
          <h2 className="text-lg font-bold text-text-primary text-center mb-2">Discard this trip?</h2>
          <p className="text-sm text-text-muted text-center leading-relaxed mb-6">
            You'll lose your trip from{' '}
            <strong className="text-text-secondary">{origin!.city.name}</strong>
            {nonReturnLegs.length > 0
              ? ` and ${nonReturnLegs.length} stop${nonReturnLegs.length > 1 ? 's' : ''}`
              : ''}
            . This can't be undone.
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleConfirm}
              className="w-full py-3 rounded-2xl font-semibold text-white text-sm transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #F97316 0%, #EA6C0A 100%)',
                boxShadow: '0 8px 24px rgba(249,115,22,0.28)',
              }}
            >
              Yes, discard trip
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="w-full py-3 rounded-2xl font-semibold text-text-secondary text-sm bg-surface-2 border border-border transition-all active:scale-95 hover:border-indigo-border"
            >
              Keep planning
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );

  return (
    <>
      {tripInProgress ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="flex items-baseline gap-0 active:opacity-70 transition-opacity"
          aria-label="Return to home screen"
        >
          {logoContent}
        </button>
      ) : (
        <div className="flex items-baseline gap-0">{logoContent}</div>
      )}
      {modal}
    </>
  );
}
