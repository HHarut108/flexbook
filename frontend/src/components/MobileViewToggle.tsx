import { List, Map as MapIcon } from 'lucide-react';

export type MobileView = 'list' | 'map';

interface Props {
  value: MobileView;
  onChange: (v: MobileView) => void;
  className?: string;
}

/**
 * Mobile-only segmented control to switch between the form/results panel
 * ("List view") and the map ("Map view"). Hidden from md: up where both
 * panels render side-by-side. Mirrors the V1 production pattern.
 */
export function MobileViewToggle({ value, onChange, className = '' }: Props) {
  return (
    <div
      className={`md:hidden inline-flex items-center gap-1 p-1 rounded-full bg-surface-2 border border-border/60 ${className}`}
      role="tablist"
      aria-label="View mode"
    >
      <button
        type="button"
        onClick={() => onChange('list')}
        role="tab"
        aria-selected={value === 'list'}
        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
          value === 'list'
            ? 'bg-text-primary text-bg'
            : 'text-text-secondary'
        }`}
      >
        <List size={13} />
        List view
      </button>
      <button
        type="button"
        onClick={() => onChange('map')}
        role="tab"
        aria-selected={value === 'map'}
        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
          value === 'map'
            ? 'bg-text-primary text-bg'
            : 'text-text-secondary'
        }`}
      >
        <MapIcon size={13} />
        Map view
      </button>
    </div>
  );
}
