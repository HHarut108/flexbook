import { CheckCircle2, MapPin, Sparkles } from 'lucide-react';

export interface PlanStayNudgeProps {
  city: string;
  nights: number;
  visited: boolean;
  onTap: () => void;
}

export function PlanStayNudge({ city, nights, visited, onTap }: PlanStayNudgeProps) {
  return (
    <div
      role="region"
      aria-label={
        visited
          ? `${nights} nights in ${city} — already viewed`
          : `Plan your stay in ${city}`
      }
      className={`rounded-[20px] border px-4 py-4 transition-all duration-200 ${
        visited
          ? 'bg-surface-2 border-border opacity-70'
          : 'bg-surface border-indigo-border'
      }`}
      style={
        visited
          ? {}
          : { boxShadow: '0 8px 24px rgba(55,48,163,0.07), 0 2px 0 rgba(255,255,255,0.9) inset' }
      }
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2">
        {visited ? (
          <CheckCircle2 size={14} className="text-emerald shrink-0" />
        ) : (
          <MapPin size={14} className="text-indigo shrink-0" />
        )}
        <p
          className={`text-[0.7rem] font-bold tracking-[0.22em] uppercase ${
            visited ? 'text-text-xmuted' : 'text-text-muted'
          }`}
        >
          {nights} {nights === 1 ? 'night' : 'nights'} in {city.toUpperCase()}
          {visited && ' ✓'}
        </p>
      </div>

      {/* Body — hidden when visited */}
      {!visited && (
        <p className="text-sm text-text-secondary leading-[1.6] mb-4">
          What's worth your time here — places to stay, things to do, where to eat.
        </p>
      )}

      {/* CTA button */}
      {!visited ? (
        <button
          onClick={onTap}
          className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 px-4 text-sm font-semibold text-white transition-all duration-150 active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
            boxShadow: '0 4px 14px rgba(79,70,229,0.35)',
          }}
          aria-label={`Plan your time in ${city}`}
        >
          <Sparkles size={15} />
          Plan your time in {city}
        </button>
      ) : (
        <p className="text-xs text-text-xmuted">Tap to revisit your {city} guide</p>
      )}
    </div>
  );
}
