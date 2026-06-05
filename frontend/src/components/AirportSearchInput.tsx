import { useRef, useState } from 'react';
import { Airport, AirportSearchEntry, City, LocationSelection, selectionLabel } from '@fast-travel/shared';
import { PlaneTakeoff, Search, Loader2, X, ArrowRight, Building2 } from 'lucide-react';
import { useAirportSearch } from '../hooks/useAirportSearch';

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Receives either a single-airport selection or a multi-airport city pick
   *  (e.g. "Rome (all airports)" → fans out to FCO+CIA on search). */
  onSelect: (selection: LocationSelection) => void;
  placeholder?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
  /** Show the prominent orange search affordance inside the input. Used on the
   *  Hop Planner where the airport input is the primary call to action. */
  accentButton?: boolean;
}

function AirportRow({
  airport,
  onSelect,
  delay,
}: {
  airport: Airport;
  onSelect: () => void;
  delay: number;
}) {
  return (
    <button
      className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-indigo-soft/50 transition-colors border-b border-border/40 last:border-0 text-left"
      style={{ animationDelay: `${delay}ms` }}
      onClick={onSelect}
      aria-label={`Select ${airport.city.name} (${airport.iata})`}
    >
      <div className="w-9 h-9 rounded-xl bg-indigo-soft border border-indigo-border flex items-center justify-center shrink-0">
        <PlaneTakeoff size={14} className="text-indigo" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <p className="text-[15px] font-semibold text-text-primary truncate">
            {airport.city.name}
          </p>
          <span className="text-xs font-mono font-bold text-indigo-mid shrink-0">
            {airport.iata}
          </span>
        </div>
        <p className="text-xs text-text-muted mt-0.5 truncate">
          {airport.name}
          {airport.distanceKm !== undefined && ` · ${airport.distanceKm} km`}
        </p>
      </div>
      <div className="w-8 h-8 rounded-full bg-indigo-soft/60 text-indigo flex items-center justify-center shrink-0">
        <ArrowRight size={14} />
      </div>
    </button>
  );
}

function CityRow({
  city,
  onSelect,
  delay,
}: {
  city: City & { airports: string[] };
  onSelect: () => void;
  delay: number;
}) {
  const count = city.airports.length;
  return (
    <button
      className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-amber-50/60 transition-colors border-b border-border/40 last:border-0 text-left"
      style={{ animationDelay: `${delay}ms` }}
      onClick={onSelect}
      aria-label={`Select ${city.name} — all ${count} airports`}
    >
      <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
        <Building2 size={14} className="text-amber-700" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <p className="text-[15px] font-semibold text-text-primary truncate">
            {city.name}
          </p>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">
            City · {count} airports
          </span>
        </div>
        <p className="text-xs text-text-muted mt-0.5 truncate">
          Search all {count}: {city.airports.join(', ')}
        </p>
      </div>
      <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
        <ArrowRight size={14} />
      </div>
    </button>
  );
}

export function AirportSearchInput({
  value,
  onChange,
  onSelect,
  placeholder = 'City or airport code...',
  autoFocus = false,
  ariaLabel = 'Search airport',
  accentButton = false,
}: Props) {
  const [lastSelected, setLastSelected] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Once a result is picked, the input shows "City (IATA)". Keep the dropdown
  // suppressed for that exact string — otherwise it stays open and re-queries
  // for "City (IATA)", which both looks broken and yields a 500 from the
  // airport search backend (parens aren't a valid query).
  const showResults = value.trim().length > 0 && value !== lastSelected;
  const { results, fallback, loading, error } = useAirportSearch(showResults ? value : '');

  return (
    <div className="relative">
      <PlaneTakeoff
        size={16}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-text-xmuted pointer-events-none"
      />
      {value && (
        <button
          className={`absolute ${accentButton ? 'right-14' : 'right-3'} top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-surface-2 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors`}
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          type="button"
        >
          <X size={13} />
        </button>
      )}
      {accentButton && (
        <button
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-xl text-white flex items-center justify-center transition-all active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #F97316 0%, #EA6C0A 100%)',
            boxShadow: '0 8px 24px rgba(249,115,22,0.28)',
            minHeight: '44px',
            minWidth: '44px',
          }}
          tabIndex={-1}
          aria-hidden
          type="button"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        </button>
      )}
      <input
        ref={inputRef}
        type="text"
        className={`input-field pl-11 ${accentButton ? 'pr-28' : 'pr-12'} rounded-2xl text-base`}
        style={{ minHeight: '48px' }}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
      />

      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-2 z-20 section-shell overflow-hidden animate-fade-in max-h-[320px] overflow-y-auto">
          {error && !loading && results.length === 0 && (
            <p className="px-5 py-4 text-rose-400 text-sm" role="alert">
              {error}
            </p>
          )}
          {!error && results.length === 0 && !loading && !fallback && (
            <p className="px-5 py-4 text-text-muted text-sm">
              No airports found. Try a different city or code.
            </p>
          )}
          {!error && results.length === 0 && !loading && fallback && (
            <p className="px-5 py-4 text-text-muted text-sm">
              We found <strong className="text-text-primary">{fallback.matchedPlace}</strong>, but no
              commercial airport sits within {fallback.radiusKm} km.
            </p>
          )}
          {loading && results.length === 0 && (
            <div className="flex items-center gap-2.5 px-5 py-4 text-text-muted text-sm">
              <Loader2 size={14} className="animate-spin text-indigo-mid" />
              Searching airports...
            </div>
          )}
          {fallback && results.length > 0 && !loading && (
            <div className="px-5 py-3 border-b border-border bg-indigo-soft/40">
              <p className="text-[13px] text-text-primary">
                No commercial airport in <strong>{fallback.matchedPlace}</strong>.
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                Nearest commercial airports within {fallback.radiusKm} km:
              </p>
            </div>
          )}
          {results.map((entry: AirportSearchEntry, i) => {
            if (entry.kind === 'city') {
              return (
                <CityRow
                  key={`city:${entry.city.id}`}
                  city={entry.city}
                  onSelect={() => {
                    const selection: LocationSelection = { kind: 'city', city: entry.city };
                    setLastSelected(selectionLabel(selection));
                    onSelect(selection);
                  }}
                  delay={i * 20}
                />
              );
            }
            return (
              <AirportRow
                key={`airport:${entry.airport.iata}`}
                airport={entry.airport}
                onSelect={() => {
                  const selection: LocationSelection = { kind: 'airport', airport: entry.airport };
                  setLastSelected(selectionLabel(selection));
                  onSelect(selection);
                }}
                delay={i * 20}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
