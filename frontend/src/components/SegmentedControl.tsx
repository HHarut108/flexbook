import { type ReactNode } from 'react';

interface Option<T extends string> {
  value: T;
  label: ReactNode;
}

interface Props<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: Option<T>[];
  ariaLabel?: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className = '',
}: Props<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex p-1 rounded-2xl bg-surface-2 border border-border ${className}`}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(opt.value)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
              selected
                ? 'bg-surface text-indigo shadow-[0_2px_8px_rgba(15,23,42,0.08)] border border-indigo-border'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
