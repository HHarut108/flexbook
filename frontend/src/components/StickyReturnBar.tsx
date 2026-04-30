import { ArrowLeft } from 'lucide-react';

export interface StickyReturnBarProps {
  onBack: () => void;
  crumbs: string[];
  currentCity: string;
}

export function StickyReturnBar({ onBack, crumbs, currentCity }: StickyReturnBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 max-w-[448px] mx-auto">
      <div
        className="px-4 flex items-center gap-3"
        style={{
          background: 'rgba(55,48,163,0.97)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255,255,255,0.10)',
          paddingTop: '12px',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-semibold text-white hover:text-white/80 transition-colors duration-150 active:scale-95 shrink-0"
          style={{ minHeight: '44px' }}
          aria-label="Back to your trip"
        >
          <ArrowLeft size={15} className="shrink-0" />
          Back to your trip
        </button>

        <div className="w-px h-4 bg-white/20 shrink-0" />

        <div
          className="flex items-center gap-1 overflow-x-auto flex-1 justify-end"
          style={{ scrollbarWidth: 'none' }}
          aria-label={`Trip route: ${crumbs.join(' to ')}, currently in ${currentCity}`}
        >
          {crumbs.map((iata, i) => (
            <span key={i} className="flex items-center gap-1 shrink-0">
              {i > 0 && <span className="text-white/30 text-[10px]">›</span>}
              <span
                className={`font-mono text-xs font-bold ${
                  iata === currentCity ? 'text-orange' : 'text-white/50'
                }`}
              >
                {iata}
              </span>
            </span>
          ))}
          <span className="flex items-center gap-1 shrink-0">
            <span className="text-white/30 text-[10px]">›</span>
            <span className="font-mono text-xs font-bold text-white/25">?</span>
          </span>
        </div>
      </div>
    </div>
  );
}
