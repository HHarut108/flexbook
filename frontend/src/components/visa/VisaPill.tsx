import { ShieldCheck, FileCheck, Globe2, ShieldAlert, ShieldX } from 'lucide-react';
import type { VisaRequirement } from '../../api/visa.api';

type Tone = 'green' | 'amber' | 'blue' | 'red' | 'gray';

const TONE: Record<VisaRequirement['status'], Tone> = {
  'visa free': 'green',
  'visa on arrival': 'amber',
  eta: 'blue',
  'e-visa': 'blue',
  'visa required': 'red',
  'no admission': 'red',
};

// Each tone gets its own colour family for background, text and icon. The
// border stays subtle so the chip sits comfortably next to the country title
// instead of competing with it.
const TONE_CLASSES: Record<Tone, string> = {
  green:
    'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/50',
  amber:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/50',
  blue:
    'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700/50',
  red:
    'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700/50',
  gray: 'bg-surface-2 text-text-muted border-border',
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

interface VisaPillProps {
  requirement?: VisaRequirement;
  loading?: boolean;
  variant?: 'compact' | 'full';
  className?: string;
}

export function VisaPill({ requirement, loading, variant = 'compact', className = '' }: VisaPillProps) {
  if (loading) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${TONE_CLASSES.gray} animate-pulse ${className}`}
      >
        <ShieldCheck size={11} className="opacity-50" />
        <span>Visa…</span>
      </span>
    );
  }
  if (!requirement) return null;

  const tone = TONE[requirement.status];
  const Icon = ICON[requirement.status];
  const baseLabel =
    requirement.status === 'visa free' && typeof requirement.days === 'number'
      ? `Visa free · ${requirement.days}d`
      : SHORT_LABEL[requirement.status];
  const label = variant === 'full' ? requirement.label : baseLabel;

  return (
    <span
      title={requirement.label}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`}
    >
      <Icon size={11} className="shrink-0" />
      <span>{label}</span>
    </span>
  );
}
