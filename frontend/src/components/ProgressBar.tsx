import { useLocation } from 'react-router-dom';
import { useTripStore } from '../store/trip.store';
import { useAuthStore } from '../store/auth.store';
import { GoHomeLogo } from './GoHomeLogo';
import { User } from 'lucide-react';

const MAX_STOPS = 15;

function stepLabel(pathname: string, stopCount: number): string {
  switch (pathname) {
    case '/flights':
      return stopCount === 0 ? 'Choosing your first destination' : `Adding stop ${stopCount + 1}`;
    case '/stay':
      return 'Picking your stay duration';
    case '/review':
      return "What's next for your trip?";
    case '/return':
      return 'Finding your way home';
    case '/itinerary':
      return 'Your trip is ready!';
    case '/plan':
      return 'Planning your stay';
    default:
      return '';
  }
}

export function ProgressBar({ onMenuOpen }: { onMenuOpen?: () => void }) {
  const legs = useTripStore((s) => s.legs);
  const origin = useTripStore((s) => s.origin);
  const user = useAuthStore((s) => s.user);
  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : null;
  const { pathname } = useLocation();

  // Hide the trip progress bar on the home + auth/account screens. The crumb row
  // would otherwise render with a placeholder "?" because no trip origin is set yet,
  // which looks like a broken badge next to the brand mark.
  const HIDDEN_PATHS = new Set(['/', '/book', '/book/partial', '/login', '/signup', '/verify-email', '/account']);
  if (HIDDEN_PATHS.has(pathname)) return null;

  const nonReturnLegs = legs.filter((l) => !l.isReturn);
  const stopCount = nonReturnLegs.length;
  const slotsRemaining = MAX_STOPS - stopCount;

  const crumbs = [
    origin?.iata ?? '?',
    ...nonReturnLegs.map((l) => l.destinationIata),
  ];

  const label = stepLabel(pathname, stopCount);

  return (
    <div className="sticky top-0 z-50">
      <div
        className="px-5 py-2.5 md:px-8 lg:px-10 flex items-center gap-3"
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
        {pathname !== '/itinerary' && pathname !== '/return' && pathname !== '/plan' && (
          <div className="shrink-0 flex items-center gap-1.5">
            <div className="flex flex-col items-end">
              <span className={`text-[9px] leading-none mb-0.5 ${slotsRemaining <= 3 ? 'text-amber-300' : 'text-white/40'}`}>
                stops left
              </span>
              <span className={`font-mono font-bold text-xs leading-none ${slotsRemaining <= 3 ? 'text-amber-300' : 'text-white'}`}>
                {slotsRemaining}
              </span>
            </div>
            <div className="w-12 h-1.5 rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(6, (stopCount / MAX_STOPS) * 100)}%`,
                  background: slotsRemaining <= 3
                    ? 'linear-gradient(90deg, #F59E0B, #FCD34D)'
                    : 'linear-gradient(90deg, #F97316, #FBBF24)',
                }}
              />
            </div>
          </div>
        )}

        {/* Account button */}
        <button
          onClick={onMenuOpen}
          className="shrink-0 ml-1 w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center text-white hover:bg-white/25 transition-all active:scale-95"
          aria-label="Account"
        >
          {initials
            ? <span className="text-xs font-bold leading-none">{initials}</span>
            : <User size={16} />
          }
        </button>
      </div>
    </div>
  );
}
