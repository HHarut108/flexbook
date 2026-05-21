import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import { COUNTRIES } from '../../data/countries';

function countryFlag(code: string): string {
  return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(c.charCodeAt(0) + 127397));
}

interface PassportPickerProps {
  value: string | null;
  onChange: (code: string) => void;
  label?: string;
  size?: 'sm' | 'md';
}

/**
 * Compact, dropdown-style passport selector. Differs from the form-grade
 * `CountrySelect` in being inline and slim so it can sit in a results-header
 * row without dominating the layout.
 */
export function PassportPicker({ value, onChange, label, size = 'sm' }: PassportPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.code.toLowerCase().startsWith(query.toLowerCase()),
      )
    : COUNTRIES;

  const selected = value ? COUNTRIES.find((c) => c.code === value) : null;

  useEffect(() => {
    if (!open) return;
    setQuery('');
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        minWidth: Math.max(rect.width, 240),
        zIndex: 9999,
        maxHeight: Math.min(280, spaceBelow - 8),
      });
    }
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClose(e: MouseEvent) {
      const dropdown = document.getElementById('passport-picker-dropdown');
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node) &&
        dropdown &&
        !dropdown.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClose);
    return () => document.removeEventListener('mousedown', handleClose);
  }, [open]);

  const sizing =
    size === 'sm'
      ? 'px-2.5 py-1 text-xs'
      : 'px-3 py-1.5 text-sm';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-surface hover:border-indigo-border transition-colors ${sizing} font-medium text-text-primary`}
      >
        {label && <span className="text-text-muted">{label}</span>}
        {selected ? (
          <span className="inline-flex items-center gap-1">
            <span>{countryFlag(selected.code)}</span>
            <span className="truncate max-w-[8rem]">{selected.name}</span>
          </span>
        ) : (
          <span className="text-text-muted">Pick country</span>
        )}
        <ChevronDown size={12} className="text-text-muted shrink-0" />
      </button>

      {open &&
        createPortal(
          <div
            id="passport-picker-dropdown"
            style={dropdownStyle}
            className="rounded-xl border border-border bg-surface shadow-xl overflow-hidden flex flex-col"
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
              <Search size={14} className="text-text-muted shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search countries…"
                className="flex-1 text-sm bg-transparent outline-none text-text-primary placeholder:text-text-muted"
              />
            </div>
            <ul className="overflow-y-auto flex-1">
              {filtered.length === 0 ? (
                <li className="px-4 py-3 text-sm text-text-muted">No countries found</li>
              ) : (
                filtered.map((c) => (
                  <li key={c.code}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onChange(c.code);
                        setOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo/10 transition-colors text-text-primary ${value === c.code ? 'bg-indigo-soft/40' : ''}`}
                    >
                      <span className="mr-2">{countryFlag(c.code)}</span>
                      {c.name}
                      <span className="ml-2 font-mono text-[10px] text-text-muted">{c.code}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}
