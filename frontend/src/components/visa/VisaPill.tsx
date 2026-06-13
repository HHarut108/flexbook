import {
  ShieldCheck,
  FileCheck,
  Zap,
  FileText,
  ShieldAlert,
  Ban,
  ChevronRight,
} from 'lucide-react';
import type { VisaRequirement } from '../../api/visa.api';

export type VisaTone = 'green' | 'amber' | 'blue' | 'red' | 'slate' | 'gray';

const TONE: Record<VisaRequirement['status'], VisaTone> = {
  'visa free': 'green',
  'visa on arrival': 'amber',
  eta: 'blue',
  'e-visa': 'blue',
  'visa required': 'red',
  // Slate (not red) — separates "blocked but possible to apply" from
  // "fundamentally not admitted." Calmer hue avoids overcrying-wolf.
  'no admission': 'slate',
};

export function visaTone(status?: VisaRequirement['status']): VisaTone {
  if (!status) return 'gray';
  return TONE[status];
}

// Hex tokens, applied via inline style. The project's tailwind config
// redefines `emerald` and `sky` as single CSS-variable colors, which kills
// `bg-emerald-100` / `border-l-sky-500` etc. Inline styles sidestep the
// palette entirely and guarantee these tones actually render.
export interface VisaToneColors {
  /** Strong color — rail, dot, icon-on-soft */
  solid: string;
  /** Chip background */
  soft: string;
  /** Chip text */
  ink: string;
  /** Chip border */
  border: string;
}

export const VISA_TONE_COLORS: Record<VisaTone, VisaToneColors> = {
  green: { solid: '#059669', soft: '#d1fae5', ink: '#064e3b', border: '#a7f3d0' },
  amber: { solid: '#d97706', soft: '#fef3c7', ink: '#78350f', border: '#fcd34d' },
  blue:  { solid: '#0284c7', soft: '#e0f2fe', ink: '#0c4a6e', border: '#7dd3fc' },
  red:   { solid: '#e11d48', soft: '#ffe4e6', ink: '#881337', border: '#fda4af' },
  slate: { solid: '#64748b', soft: '#f1f5f9', ink: '#1e293b', border: '#cbd5e1' },
  gray:  { solid: '#94a3b8', soft: '#f1f5f9', ink: '#475569', border: '#e2e8f0' },
};

// Returned as a hex string so consumers apply it via inline style:
//   style={{ borderLeft: `4px solid ${VISA_TONE_BORDER[tone]}` }}
export const VISA_TONE_BORDER: Record<VisaTone, string> = {
  green: VISA_TONE_COLORS.green.solid,
  amber: VISA_TONE_COLORS.amber.solid,
  blue:  VISA_TONE_COLORS.blue.solid,
  red:   VISA_TONE_COLORS.red.solid,
  slate: VISA_TONE_COLORS.slate.solid,
  gray:  'transparent',
};

const ICON: Record<VisaRequirement['status'], typeof ShieldCheck> = {
  'visa free': ShieldCheck,
  'visa on arrival': FileCheck,
  // ETA = lightweight automated screening (fast, lightning).
  // eVisa = real application with documents (paperwork).
  eta: Zap,
  'e-visa': FileText,
  'visa required': ShieldAlert,
  'no admission': Ban,
};

const SHORT_LABEL: Record<VisaRequirement['status'], string> = {
  'visa free': 'Visa free',
  'visa on arrival': 'On arrival',
  eta: 'ETA',
  'e-visa': 'eVisa',
  'visa required': 'Visa required',
  'no admission': 'Not allowed',
};

function buildCompactLabel(req: VisaRequirement): string {
  const base = SHORT_LABEL[req.status];
  // Only visa-free surfaces days in the chip — "Visa required · 30d" was
  // ambiguous (required for 30 days? valid for 30 days?). For everything
  // else the days move into the details popover.
  if (req.status === 'visa free' && typeof req.days === 'number') {
    return `${base} · up to ${req.days} d`;
  }
  return base;
}

interface VisaPillProps {
  requirement?: VisaRequirement;
  loading?: boolean;
  variant?: 'compact' | 'full';
  className?: string;
  /** When provided, the pill renders as a button (with hover/focus affordances
      and a chevron affix) and calls this handler on click. Otherwise renders
      as a static <span>. */
  onClick?: () => void;
}

const BASE_CHIP_CLASSES =
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold border whitespace-nowrap';

export function VisaPill({ requirement, loading, variant = 'compact', className = '', onClick }: VisaPillProps) {
  if (loading) {
    const gray = VISA_TONE_COLORS.gray;
    return (
      <span
        style={{ backgroundColor: gray.soft, color: gray.ink, borderColor: gray.border }}
        className={`${BASE_CHIP_CLASSES} animate-pulse ${className}`}
      >
        <ShieldCheck size={14} className="opacity-50 shrink-0" />
        <span>Visa…</span>
      </span>
    );
  }
  if (!requirement) return null;

  const tone = TONE[requirement.status];
  const colors = VISA_TONE_COLORS[tone];
  const Icon = ICON[requirement.status];
  const label = variant === 'full' ? requirement.label : buildCompactLabel(requirement);
  const style = {
    backgroundColor: colors.soft,
    color: colors.ink,
    borderColor: colors.border,
  } as const;

  if (onClick) {
    return (
      <button
        type="button"
        title={`${requirement.label} — tap for details`}
        aria-label={`${requirement.label}. Tap for details.`}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        style={style}
        className={`${BASE_CHIP_CLASSES} cursor-pointer hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40 transition ${className}`}
      >
        <Icon size={14} style={{ color: colors.solid }} className="shrink-0" />
        <span>{label}</span>
        <ChevronRight size={12} className="shrink-0 opacity-50" aria-hidden />
      </button>
    );
  }

  return (
    <span title={requirement.label} style={style} className={`${BASE_CHIP_CLASSES} ${className}`}>
      <Icon size={14} style={{ color: colors.solid }} className="shrink-0" />
      <span>{label}</span>
    </span>
  );
}
