import { forwardRef } from 'react';
import { FlightOption } from '@fast-travel/shared';
import { formatTime, durationLabel } from '../utils/date.utils';
import { formatPrice } from '../utils/price.utils';
import { ChevronDown, ChevronRight, Plane } from 'lucide-react';

interface CompactFlightRowProps {
  flight: FlightOption;
  onSelect: (flight: FlightOption) => void;
}

function CompactFlightRow({ flight, onSelect }: CompactFlightRowProps) {
  const direct = flight.stops === 0;
  return (
    <button
      type="button"
      onClick={() => onSelect(flight)}
      className="group w-full text-left flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 transition-colors hover:border-indigo-border hover:bg-indigo-soft/40"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-semibold text-text-primary truncate">
            {flight.destinationCity}
          </span>
          <span className="font-mono text-[10px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded-md shrink-0">
            {flight.destinationIata}
          </span>
          {direct ? (
            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
              Direct
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-sky-700 dark:text-sky-400 shrink-0">
              {flight.stops} stop{flight.stops > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-text-muted font-mono min-w-0">
          <span className="truncate max-w-[7rem] not-italic font-sans">{flight.airlineName}</span>
          <span className="text-text-xmuted">·</span>
          <span className="inline-flex items-center gap-1 shrink-0">
            <span>{formatTime(flight.departureDatetime)}</span>
            <Plane size={9} className="rotate-90 text-text-xmuted" />
            <span>{formatTime(flight.arrivalDatetime)}</span>
          </span>
          <span className="text-text-xmuted hidden sm:inline">·</span>
          <span className="hidden sm:inline text-text-muted shrink-0">
            {durationLabel(flight.durationMinutes)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="font-mono text-orange font-bold text-sm">
          {formatPrice(flight.priceUsd)}
        </span>
        <ChevronRight
          size={14}
          className="text-text-xmuted group-hover:text-indigo transition-colors"
        />
      </div>
    </button>
  );
}

interface CountryGroupProps {
  country: string;
  flights: FlightOption[];
  minPrice: number;
  cityCount: number;
  expanded: boolean;
  onToggle: () => void;
  onSelectFlight: (flight: FlightOption) => void;
}

export const CountryGroup = forwardRef<HTMLElement, CountryGroupProps>(function CountryGroup(
  { country, flights, minPrice, cityCount, expanded, onToggle, onSelectFlight },
  ref,
) {
  const safe = country.replace(/\s+/g, '-');
  const headerId = `country-${safe}-header`;
  const panelId = `country-${safe}-panel`;
  return (
    <section
      ref={ref}
      className={`bg-surface border rounded-2xl overflow-hidden scroll-mt-4 lg:scroll-mt-6 transition-shadow ${
        expanded
          ? 'border-indigo-border shadow-[0_10px_28px_rgba(55,48,163,0.10)]'
          : 'border-border shadow-[0_2px_8px_rgba(15,23,42,0.04)]'
      }`}
    >
      <button
        id={headerId}
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-indigo-soft/40 transition-colors min-h-[56px]"
      >
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-text-primary leading-tight truncate">
            {country}
          </div>
          <div className="text-[11px] text-text-muted leading-tight mt-0.5">
            {flights.length} flight{flights.length > 1 ? 's' : ''} · {cityCount}{' '}
            {cityCount === 1 ? 'city' : 'cities'}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted leading-none">
            From
          </div>
          <div className="font-mono text-orange font-black text-lg leading-tight mt-0.5">
            {formatPrice(minPrice)}
          </div>
        </div>
        <ChevronDown
          size={18}
          className={`text-text-muted shrink-0 motion-safe:transition-transform motion-safe:duration-200 ${
            expanded ? '' : '-rotate-90'
          }`}
        />
      </button>

      {expanded && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headerId}
          className="px-3 pb-3 pt-1 space-y-1.5 border-t border-border/60 bg-surface-2/30"
        >
          {flights.map((flight) => (
            <CompactFlightRow
              key={flight.flightId}
              flight={flight}
              onSelect={onSelectFlight}
            />
          ))}
        </div>
      )}
    </section>
  );
});
