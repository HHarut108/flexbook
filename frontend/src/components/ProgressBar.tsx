import { useTripStore } from '../store/trip.store';
import { useSessionStore } from '../store/session.store';
import { GoHomeLogo } from './GoHomeLogo';
import { Menu } from 'lucide-react';

const MAX_STOPS = 15;

function stepLabel(screen: string, stopCount: number): string {
  switch (screen) {
    case 'flight-results':
      return stopCount === 0 ? 'Choosing your first destination' : `Adding stop ${stopCount + 1}`;
    case 'stay-duration':
      return 'Picking your stay duration';
    case 'decision':
      return "What's next for your trip?";
    case 'return-flights':
      return 'Finding your way home';
    case 'itinerary':
      return 'Your trip is ready!';
    default:
      return '';
  }
}

export function ProgressBar({ onMenuOpen }: { onMenuOpen?: () => void }) {
  const legs = useTripStore((s) => s.legs);
  const origin = useTripStore((s) => s.origin);
  const screen = useSessionStore((s) => s.screen);

  if (screen === 'home' || screen === 'booking-review' || screen === 'partial-booking') return null;

  const nonReturnLegs = legs.filter((l) => !l.isReturn);
  const stopCount = nonReturnLegs.length;
  const slotsRemaining = MAX_STOPS - stopCount;

  const crumbs = [
    origin?.iata ?? '?',
    ...nonReturnLegs.map((l) => l.destinationIata),
  ];

  const label = stepLabel(screen, stopCount);

  return (
    <div className="sticky top-0 z-50">
      <div
        className="px-4 py-2.5 flex items-center gap-3"
        style={{
          background: 'rgba(55,48,163,0.97)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.10)',
        }}
      >
        <div className="shrink-0">
          <GoHomeLogo size="sm" variant="dark" />
        </div>

        {/* Step label + breadcrumb */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {label && (
            <p className="text-white/55 text-[10px] leading-none mb-0.5 truncate">{label}</p>
          )}
          <div className="flex items-center gap-1 overflow-x-auto text-xs text-white/70 whitespace-nowrap" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {crumbs.map((iata, i) => {
              const isLast = i === crumbs.length - 1;
              return (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-white/30 text-[10px]">›</span>}
                  <span className={`font-mono ${isLast ? 'text-white font-semibold' : 'text-white/60'}`}>
                    {isLast && <span className="text-orange mr-0.5">●</span>}
                    {iata}
                  </span>
                </span>
              );
            })}
          </div>
        </div>

        {/* Stops remaining pill */}
        {screen !== 'itinerary' && screen !== 'return-flights' && (
          <div className="shrink-0 flex items-center gap-1.5">
            <div className="flex flex-col items-end">
              <span className="text-white/40 text-[9px] leading-none mb-0.5">stops left</span>
              <span className="text-white font-mono font-bold text-xs leading-none">{slotsRemaining}</span>
            </div>
            <div className="w-12 h-1.5 rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(6, (stopCount / MAX_STOPS) * 100)}%`,
                  background: 'linear-gradient(90deg, #F97316, #FBBF24)',
                }}
              />
            </div>
          </div>
        )}

        {/* Menu button */}
        <button
          onClick={onMenuOpen}
          className="shrink-0 ml-1 w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-white hover:bg-white/25 transition-all active:scale-95"
          aria-label="Open menu"
        >
          <Menu size={16} />
        </button>
      </div>
    </div>
  );
}
