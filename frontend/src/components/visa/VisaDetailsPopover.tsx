import { useEffect } from 'react';
import {
  X,
  ShieldCheck,
  FileCheck,
  Globe2,
  ShieldAlert,
  ShieldX,
  DollarSign,
  Clock,
  Plane,
  Globe,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import type { VisaRequirement } from '../../api/visa.api';
import { VISA_TYPE_INFO } from '../../data/visaTypeInfo';
import { visaTone, type VisaTone } from './VisaPill';

interface Props {
  requirement: VisaRequirement;
  /** Display name of the destination (e.g. "Türkiye") — surfaced in the header. */
  destinationName?: string;
  /** ISO-2 of the passport (e.g. "AM") — surfaced in the meta line. */
  passport?: string | null;
  onClose: () => void;
}

const STATUS_LABEL: Record<VisaRequirement['status'], string> = {
  'visa free': 'Visa free',
  'visa on arrival': 'Visa on arrival',
  eta: 'Electronic Travel Authorisation',
  'e-visa': 'eVisa',
  'visa required': 'Visa required',
  'no admission': 'No admission',
};

const STATUS_ICON: Record<VisaRequirement['status'], typeof ShieldCheck> = {
  'visa free': ShieldCheck,
  'visa on arrival': FileCheck,
  eta: Globe2,
  'e-visa': Globe2,
  'visa required': ShieldAlert,
  'no admission': ShieldX,
};

const APPLY_FORMAT_ICON = {
  none: CheckCircle2,
  'at-border': Plane,
  online: Globe,
  embassy: Building2,
};

const APPLY_FORMAT_LABEL = {
  none: 'No application',
  'at-border': 'Apply at the border',
  online: 'Apply online',
  embassy: 'Apply at embassy',
};

// Header gradient per tone — same hues as the chip but at "card-header" weight.
const HEADER_GRADIENT: Record<VisaTone, string> = {
  green: 'linear-gradient(135deg, rgba(5,150,105,0.97) 0%, rgba(16,185,129,0.97) 100%)',
  amber: 'linear-gradient(135deg, rgba(217,119,6,0.97) 0%, rgba(245,158,11,0.97) 100%)',
  blue: 'linear-gradient(135deg, rgba(2,132,199,0.97) 0%, rgba(14,165,233,0.97) 100%)',
  red: 'linear-gradient(135deg, rgba(190,18,60,0.97) 0%, rgba(244,63,94,0.97) 100%)',
  gray: 'linear-gradient(135deg, rgba(71,85,105,0.97) 0%, rgba(100,116,139,0.97) 100%)',
};

function countryFlag(code?: string | null): string {
  if (!code || code.length !== 2) return '';
  return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(c.charCodeAt(0) + 127397));
}

function formatLastUpdated(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function VisaDetailsPopover({ requirement, destinationName, passport, onClose }: Props) {
  const tone = visaTone(requirement.status);
  const Icon = STATUS_ICON[requirement.status];
  const info = VISA_TYPE_INFO[requirement.status];
  const ApplyIcon = APPLY_FORMAT_ICON[info.applyFormat];
  const lastUpdated = formatLastUpdated(requirement.last_updated);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end md:items-center justify-center px-4 pb-6 md:pb-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="visa-details-heading"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-[448px] md:max-w-md bg-surface rounded-3xl overflow-hidden animate-fade-in"
        style={{ boxShadow: '0 24px 64px rgba(15,23,42,0.20)' }}
      >
        <div
          className="px-5 pt-5 pb-4 flex items-start justify-between"
          style={{ background: HEADER_GRADIENT[tone] }}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <Icon size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/80 font-mono mb-0.5">
                Visa status
                {passport && (
                  <>
                    {' · '}
                    <span className="normal-case tracking-normal">
                      {countryFlag(passport)} {passport} passport
                    </span>
                  </>
                )}
              </p>
              <h3 id="visa-details-heading" className="text-lg font-bold text-white leading-tight">
                {STATUS_LABEL[requirement.status]}
                {typeof requirement.days === 'number' && (
                  <span className="text-white/90 font-semibold"> · up to {requirement.days} days</span>
                )}
              </h3>
              {destinationName && (
                <p className="text-[12px] text-white/85 mt-0.5">For travel to {destinationName}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-2xl bg-white/15 flex items-center justify-center text-white hover:bg-white/25 transition-all active:scale-95 shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pt-4 pb-5 space-y-3">
          <p className="text-sm text-text-primary leading-snug">{info.whatItMeans}</p>

          <div className="rounded-2xl border border-border bg-surface-2/40 px-3.5 py-3 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-surface flex items-center justify-center shrink-0 border border-border">
              <ApplyIcon size={15} className="text-text-secondary" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold">
                {APPLY_FORMAT_LABEL[info.applyFormat]}
              </p>
              <p className="text-[13px] text-text-primary leading-snug mt-0.5">{info.howToGetIt}</p>
            </div>
          </div>

          {(info.typicalCostUsd || info.typicalProcessingTime) && (
            <div className="grid grid-cols-2 gap-2">
              {info.typicalCostUsd && (
                <div className="rounded-xl border border-border bg-surface-2/40 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-text-muted">
                    <DollarSign size={12} />
                    <span className="text-[10px] uppercase tracking-wide font-semibold">Typical cost</span>
                  </div>
                  <p className="text-sm font-bold text-text-primary mt-0.5">
                    ${info.typicalCostUsd.min}–{info.typicalCostUsd.max}
                  </p>
                </div>
              )}
              {info.typicalProcessingTime && (
                <div className="rounded-xl border border-border bg-surface-2/40 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-text-muted">
                    <Clock size={12} />
                    <span className="text-[10px] uppercase tracking-wide font-semibold">Processing</span>
                  </div>
                  <p className="text-sm font-bold text-text-primary mt-0.5">
                    {info.typicalProcessingTime}
                  </p>
                </div>
              )}
            </div>
          )}

          {info.typicalCostUsd && (
            <p className="text-[10px] text-text-muted leading-snug">
              Costs and processing times are typical ranges and can vary by passport, destination, and visa class. Always confirm with the destination country’s consulate before travel.
            </p>
          )}

          {lastUpdated && (
            <p className="text-[10px] text-text-muted text-center pt-1">
              Visa data last updated {lastUpdated}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
