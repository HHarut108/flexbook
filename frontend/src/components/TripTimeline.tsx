import { useRef, useEffect, useState } from 'react';
import { TripLeg } from '@fast-travel/shared';
import { formatShortDate, formatDate, formatTime, durationLabel } from '../utils/date.utils';
import { formatPrice } from '../utils/price.utils';
import { Plane, X, MapPin, Clock, Calendar } from 'lucide-react';

interface Props {
  legs: TripLeg[];
  highlightLast?: boolean;
}

function LegDetailModal({ leg, onClose }: { leg: TripLeg; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-[28px] p-5 animate-fade-in"
        style={{
          background: 'linear-gradient(135deg, rgba(238,242,255,0.99) 0%, rgba(240,244,255,0.97) 100%)',
          border: '1px solid #C7D2FE',
          boxShadow: '0 24px 60px rgba(55,48,163,0.18), 0 2px 0 rgba(255,255,255,0.9) inset',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-indigo-mid font-mono mb-1">
              Stop {leg.stopIndex}
            </p>
            <h3 className="text-xl font-bold text-text-primary">
              {leg.originIata} → {leg.destinationIata}
            </h3>
            <p className="text-sm text-text-muted">{leg.originCity} → {leg.destinationCity}</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white border border-border flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="rounded-2xl bg-white border border-border px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-text-muted text-[10px] uppercase tracking-wide mb-1">
              <Calendar size={11} /> Date
            </div>
            <p className="text-text-primary font-semibold text-sm">{formatDate(leg.departureDatetime)}</p>
          </div>
          <div className="rounded-2xl bg-white border border-border px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-text-muted text-[10px] uppercase tracking-wide mb-1">
              <Clock size={11} /> Duration
            </div>
            <p className="text-text-primary font-semibold text-sm">{durationLabel(leg.durationMinutes)}</p>
          </div>
          <div className="rounded-2xl bg-white border border-border px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-text-muted text-[10px] uppercase tracking-wide mb-1">
              <Plane size={11} /> Flight
            </div>
            <p className="text-text-primary font-semibold text-sm">
              {formatTime(leg.departureDatetime)} → {formatTime(leg.arrivalDatetime)}
            </p>
          </div>
          <div className="rounded-2xl bg-white border border-border px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-text-muted text-[10px] uppercase tracking-wide mb-1">
              <MapPin size={11} /> Stay
            </div>
            <p className="text-text-primary font-semibold text-sm">
              {leg.stayDurationDays > 0 ? `${leg.stayDurationDays} night${leg.stayDurationDays > 1 ? 's' : ''}` : '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-orange-soft border border-orange/20 px-4 py-3">
          <p className="text-sm text-text-muted">{leg.airlineName}</p>
          <p className="font-mono font-bold text-orange text-lg">{formatPrice(leg.priceUsd)}</p>
        </div>
      </div>
    </div>
  );
}

export function TripTimeline({ legs, highlightLast = true }: Props) {
  const outbound = legs.filter((l) => !l.isReturn);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeLeg, setActiveLeg] = useState<TripLeg | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [outbound.length]);

  if (outbound.length === 0) return null;

  return (
    <>
      <div
        ref={scrollRef}
        className="flex items-stretch gap-0 overflow-x-auto py-1 -mx-4 px-4"
        style={{ scrollbarWidth: 'none' }}
      >
        {outbound.map((leg, i) => {
          const isLast = i === outbound.length - 1;
          const isHighlighted = highlightLast && isLast;
          const arrivalDate = leg.arrivalDatetime.split('T')[0];
          const dateRange =
            leg.stayDurationDays > 0 && leg.nextDepartureDate
              ? `${formatShortDate(arrivalDate)} – ${formatShortDate(leg.nextDepartureDate)}`
              : formatShortDate(arrivalDate);

          return (
            <div key={leg.stopIndex} className="flex items-center shrink-0">
              {i > 0 && (
                <div className="flex items-center px-1.5 text-text-xmuted">
                  <Plane size={10} className="rotate-90 opacity-50" />
                </div>
              )}

              <button
                onClick={() => setActiveLeg(leg)}
                className={`flex flex-col justify-center rounded-xl px-3 py-2 min-w-0 transition-all active:scale-95
                  ${isHighlighted
                    ? 'bg-orange-soft border border-orange/30 hover:border-orange/60'
                    : 'bg-indigo-soft border border-indigo-border hover:border-indigo/40'}
                `}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className={`w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center shrink-0 text-white
                      ${isHighlighted ? 'bg-orange' : 'bg-indigo'}
                    `}
                  >
                    {leg.stopIndex}
                  </span>
                  <span className="text-xs font-semibold text-text-primary whitespace-nowrap">
                    {leg.originIata} → {leg.destinationIata}
                  </span>
                </div>
                <div className="flex items-center gap-2 pl-[22px]">
                  <span className="text-[10px] text-text-muted whitespace-nowrap">{dateRange}</span>
                  <span className={`text-[10px] font-mono font-bold ${isHighlighted ? 'text-orange' : 'text-indigo-mid'}`}>
                    {formatPrice(leg.priceUsd)}
                  </span>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {activeLeg && (
        <LegDetailModal leg={activeLeg} onClose={() => setActiveLeg(null)} />
      )}
    </>
  );
}
