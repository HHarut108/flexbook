import { useState } from 'react';
import { ShieldCheck, Globe2, FileCheck, ShieldAlert, ShieldX, ChevronDown } from 'lucide-react';
import type { VisaRequirement } from '../../api/visa.api';

type Status = VisaRequirement['status'];

interface CountryEntry {
  country: string;
  visa: VisaRequirement;
}

interface Props {
  passport: string;
  entries: CountryEntry[];
}

const STATUS_ORDER: Status[] = [
  'visa free',
  'visa on arrival',
  'eta',
  'e-visa',
  'visa required',
  'no admission',
];

const STATUS_SHORT: Record<Status, string> = {
  'visa free': 'visa-free',
  'visa on arrival': 'on arrival',
  eta: 'ETA',
  'e-visa': 'eVisa',
  'visa required': 'visa required',
  'no admission': 'no admission',
};

const STATUS_TONE: Record<Status, string> = {
  'visa free': 'text-emerald-700 dark:text-emerald-300',
  'visa on arrival': 'text-amber-700 dark:text-amber-300',
  eta: 'text-sky-700 dark:text-sky-300',
  'e-visa': 'text-sky-700 dark:text-sky-300',
  'visa required': 'text-rose-700 dark:text-rose-300',
  'no admission': 'text-rose-700 dark:text-rose-300',
};

const STATUS_ICON: Record<Status, typeof ShieldCheck> = {
  'visa free': ShieldCheck,
  'visa on arrival': FileCheck,
  eta: Globe2,
  'e-visa': Globe2,
  'visa required': ShieldAlert,
  'no admission': ShieldX,
};

function countryFlag(code: string): string {
  if (code.length !== 2) return '';
  return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(c.charCodeAt(0) + 127397));
}

/**
 * One-line aggregate of visa status across all destination countries currently
 * in the results list. Shown above the country accordion so the user gets a
 * top-down read before scanning the list.
 *
 * Expands into a per-country breakdown when tapped — useful when there are
 * many countries and the user wants to know which specific destinations are
 * easy vs. need paperwork.
 */
export function VisaResultsSummary({ passport, entries }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (entries.length === 0) return null;

  // Bucket countries by status, then walk STATUS_ORDER so green tones lead
  // and red tones come last regardless of input order.
  const byStatus = new Map<Status, CountryEntry[]>();
  for (const entry of entries) {
    const list = byStatus.get(entry.visa.status) ?? [];
    list.push(entry);
    byStatus.set(entry.visa.status, list);
  }
  const ordered = STATUS_ORDER.flatMap((status) => {
    const list = byStatus.get(status);
    return list ? [{ status, list }] : [];
  });
  if (ordered.length === 0) return null;

  return (
    <button
      type="button"
      onClick={() => setExpanded((e) => !e)}
      aria-expanded={expanded}
      className="w-full text-left rounded-2xl border border-border bg-surface px-4 py-2.5 hover:border-indigo-border transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="text-base shrink-0" aria-hidden="true">{countryFlag(passport)}</span>
        <p className="text-[12px] text-text-secondary leading-snug flex-1 min-w-0">
          <span className="font-semibold text-text-primary">{passport} passport:</span>{' '}
          {ordered.map((group, i) => (
            <span key={group.status}>
              <span className={`font-semibold ${STATUS_TONE[group.status]}`}>
                {group.list.length} {STATUS_SHORT[group.status]}
              </span>
              {i < ordered.length - 1 && <span className="text-text-muted">, </span>}
            </span>
          ))}
        </p>
        <ChevronDown
          size={14}
          className={`text-text-muted shrink-0 motion-safe:transition-transform ${expanded ? '' : '-rotate-90'}`}
        />
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border/60 space-y-1.5">
          {ordered.map((group) => (
            <div key={group.status} className="flex items-start gap-2">
              {(() => {
                const Icon = STATUS_ICON[group.status];
                return <Icon size={12} className={`mt-0.5 shrink-0 ${STATUS_TONE[group.status]}`} />;
              })()}
              <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-semibold uppercase tracking-wide ${STATUS_TONE[group.status]}`}>
                  {STATUS_SHORT[group.status]}
                  {group.list[0].visa.days && (
                    <span className="ml-1 text-text-muted normal-case tracking-normal">
                      · up to {group.list[0].visa.days}d
                    </span>
                  )}
                </p>
                <p className="text-[12px] text-text-secondary mt-0.5">
                  {group.list.map((e) => e.country).join(', ')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}
