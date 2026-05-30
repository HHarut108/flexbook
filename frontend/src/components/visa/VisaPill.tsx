import { ShieldCheck, FileCheck, Globe2, ShieldAlert, ShieldX } from 'lucide-react';
import type { VisaRequirement } from '../../api/visa.api';

export type VisaTone = 'green' | 'amber' | 'blue' | 'red' | 'gray';

const TONE: Record<VisaRequirement['status'], VisaTone> = {
  'visa free': 'green',
  'visa on arrival': 'amber',
  eta: 'blue',
  'e-visa': 'blue',
  'visa required': 'red',
  'no admission': 'red',
};

export function visaTone(status?: VisaRequirement['status']): VisaTone {
  if (!status) return 'gray';
  return TONE[status];
}

// Saturated enough to read against a white card without competing with the
// country title's bold weight — the previous "-50" tints washed out at small
// sizes. Border carries the same hue for a continuous frame.
const TONE_CLASSES: Record<VisaTone, string> = {
  green:
    'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-600/60',
  amber:
    'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-600/60',
  blue:
    'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-900/40 dark:text-sky-200 dark:border-sky-600/60',
  red:
    'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-600/60',
  gray: 'bg-surface-2 text-text-muted border-border',
};

// Used by parents (e.g. CountryGroup) that want to echo the visa status on
// their own chrome — a colored left rail on the card, for example.
export const VISA_TONE_BORDER: Record<VisaTone, string> = {
  green: 'border-l-emerald-500 dark:border-l-emerald-400',
  amber: 'border-l-amber-500 dark:border-l-amber-400',
  blue: 'border-l-sky-500 dark:border-l-sky-400',
  red: 'border-l-rose-500 dark:border-l-rose-400',
  gray: 'border-l-transparent',
};

const ICON: Record<VisaRequirement['status'], typeof ShieldCheck> = {
  'visa free': ShieldCheck,
  'visa on arrival': FileCheck,
  eta: Globe2,
  'e-visa': Globe2,
  'visa required': ShieldAlert,
  'no admission': ShieldX,
};

const SHORT_LABEL: Record<VisaRequirement['status'], string> = {
  'visa free': 'Visa free',
  'visa on arrival': 'On arrival',
  eta: 'ETA',
  'e-visa': 'eVisa',
  'visa required': 'Visa required',
  'no admission': 'No entry',
};

function buildCompactLabel(req: VisaRequirement): string {
  const base = SHORT_LABEL[req.status];
  if (typeof req.days !== 'number') return base;
  // Surface days on every status that has it, not just visa-free —
  // an "ETA · 90d" badge is more useful than a bare "ETA".
  return `${base} · ${req.days}d`;
}

interface VisaPillProps {
  requirement?: VisaRequirement;
  loading?: boolean;
  variant?: 'compact' | 'full';
  className?: string;
  /** When provided, the pill renders as a button (with hover/focus affordances)
      and calls this handler on click. Otherwise renders as a static <span>. */
  onClick?: () => void;
}

export function VisaPill({ requirement, loading, variant = 'compact', className = '', onClick }: VisaPillProps) {
  if (loading) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border ${TONE_CLASSES.gray} animate-pulse ${className}`}
      >
        <ShieldCheck size={12} className="opacity-50" />
        <span>Visa…</span>
      </span>
    );
  }
  if (!requirement) return null;

  const tone = TONE[requirement.status];
  const Icon = ICON[requirement.status];
  const label = variant === 'full' ? requirement.label : buildCompactLabel(requirement);
  const baseClasses = `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`;

  if (onClick) {
    return (
      <button
        type="button"
        title={`${requirement.label} — tap for details`}
        aria-label={`${requirement.label}. Tap for details.`}
        onClick={(e) => {
          // Prevents any enclosing clickable surface (e.g. a country card) from
          // also reacting to the click.
          e.stopPropagation();
          onClick();
        }}
        className={`${baseClasses} cursor-pointer hover:brightness-95 dark:hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40 transition`}
      >
        <Icon size={12} className="shrink-0" />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <span
      title={requirement.label}
      className={baseClasses}
    >
      <Icon size={12} className="shrink-0" />
      <span>{label}</span>
    </span>
  );
}
