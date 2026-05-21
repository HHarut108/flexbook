import type { VisaRequirement } from '../../api/visa.api';

type Tone = 'green' | 'amber' | 'red' | 'gray';

const TONE: Record<VisaRequirement['status'], Tone> = {
  'visa free': 'green',
  'visa on arrival': 'green',
  eta: 'amber',
  'e-visa': 'amber',
  'visa required': 'red',
  'no admission': 'red',
};

const TONE_CLASSES: Record<Tone, string> = {
  green:
    'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/50',
  amber:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/50',
  red: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700/50',
  gray: 'bg-surface-2 text-text-muted border-border',
};

const SHORT_LABEL: Record<VisaRequirement['status'], string> = {
  'visa free': 'Visa Free',
  'visa on arrival': 'On Arrival',
  eta: 'ETA',
  'e-visa': 'eVisa',
  'visa required': 'Visa Required',
  'no admission': 'No Admission',
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
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${TONE_CLASSES.gray} animate-pulse ${className}`}
      >
        Visa…
      </span>
    );
  }
  if (!requirement) return null;

  const tone = TONE[requirement.status];
  const label =
    variant === 'full'
      ? requirement.label
      : requirement.status === 'visa free' && typeof requirement.days === 'number'
        ? `Visa Free · ${requirement.days}d`
        : SHORT_LABEL[requirement.status];

  return (
    <span
      title={requirement.label}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`}
    >
      {label}
    </span>
  );
}
