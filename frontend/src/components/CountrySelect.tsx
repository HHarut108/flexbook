import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Search } from 'lucide-react';
import { COUNTRIES, type Country } from '../data/countries';

function countryFlag(code: string): string {
  return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(c.charCodeAt(0) + 127397));
}

interface CountrySelectProps {
  value: Country | null;
  onChange: (country: Country | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function CountrySelect({ value, onChange, placeholder = 'Select country', disabled }: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : COUNTRIES;

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropHeight = Math.min(280, spaceBelow - 8);
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
      maxHeight: dropHeight,
    });
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      updatePosition();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function handleClose(e: MouseEvent) {
      const dropdown = document.getElementById('country-dropdown');
      if (
        buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
        dropdown && !dropdown.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClose);
    window.addEventListener('scroll', () => setOpen(false), { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClose);
      window.removeEventListener('scroll', () => setOpen(false));
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-border bg-surface text-left text-sm transition-colors hover:border-primary/50 focus:outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={value ? 'text-text' : 'text-text-muted'}>
          {value ? `${countryFlag(value.code)} ${value.name}` : placeholder}
        </span>
        {value ? (
          <X
            size={16}
            className="text-text-muted shrink-0"
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
          />
        ) : (
          <ChevronDown size={16} className="text-text-muted shrink-0" />
        )}
      </button>

      {open && createPortal(
        <div
          id="country-dropdown"
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
              placeholder="Search countries..."
              className="flex-1 text-sm bg-transparent outline-none text-text placeholder:text-text-muted"
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
                    onMouseDown={(e) => { e.preventDefault(); onChange(c); setOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo/10 transition-colors text-text"
                  >
                    <span className="mr-2">{countryFlag(c.code)}</span>{c.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
}
