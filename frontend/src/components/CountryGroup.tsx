import { forwardRef, lazy, Suspense, useState } from 'react';
import { FlightOption } from '@fast-travel/shared';
import { formatTime, durationLabel } from '../utils/date.utils';
import { formatPrice } from '../utils/price.utils';
import { ChevronDown, ChevronRight, Home, Plane } from 'lucide-react';
import { VisaPill, VISA_TONE_BORDER, visaTone } from './visa/VisaPill';
import type { VisaRequirement } from '../api/visa.api';
// VisaDetailsPopover only mounts when a user taps a visa chip — kept out
// of the inline render path so the country group ships smaller.
const VisaDetailsPopover = lazy(() =>
  import('./visa/VisaDetailsPopover').then((m) => ({ default: m.VisaDetailsPopover })),
);

/** Compact layover summary used in the row meta line: "3h FCO" for a
 *  single stop, "3h FCO + 2h 40m SVQ" for two. Filters zero-duration
 *  layovers (rare data-quality holes from Kiwi) so we never render "0m
 *  XXX". Returns null when the flight is direct or all layovers are
 *  zero so callers can render the separator conditionally. */
function layoverLabel(flight: FlightOption): string | null {
  if (!flight.layovers || flight.layovers.length === 0) return null;
  const parts = flight.layovers
    .filter((l) => l.durationMinutes > 0)
    .map((l) => `${durationLabel(l.durationMinutes)} ${l.iata}`);
  return parts.length > 0 ? parts.join(' + ') : null;
}

interface CompactFlightRowProps {
  flight: FlightOption;
  onSelect: (flight: FlightOption) => void;
  returnHome?: boolean;
}

function CompactFlightRow({ flight, onSelect, returnHome = false }: CompactFlightRowProps) {
  const direct = flight.stops === 0;
  return (
    <button
      type="button"
      onClick={() => onSelect(flight)}
      aria-label={
        returnHome
          ? `Wrap up and fly home to ${flight.destinationCity}`
          : `Select flight ${flight.originCity} (${flight.originIata}) to ${flight.destinationCity} (${flight.destinationIata})`
      }
      className="group w-full text-left flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 transition-colors hover:border-indigo-border hover:bg-indigo-soft/40"
    >
      <div className="flex-1 min-w-0">
        {/* Route line — origin city + IATA → destination city + IATA.
            Each endpoint is an atomic inline-flex span so the city name
            and its IATA pill never split across a wrap (the old layout
            could land "Thessaloniki" on line 1 and "SKG" alone on line 2).
            Direct/N-stops moved to the meta line below so the route line
            looks consistent across all rows regardless of name length. */}
        <div className="flex items-center gap-x-1.5 gap-y-0.5 min-w-0 flex-wrap text-sm font-semibold text-text-primary">
          <span className="inline-flex items-center gap-1.5">
            <span>{flight.originCity}</span>
            <span className="font-mono text-[10px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded-md">
              {flight.originIata}
            </span>
          </span>
          <span className="text-text-xmuted" aria-hidden>→</span>
          <span className="inline-flex items-center gap-1.5">
            <span>{flight.destinationCity}</span>
            <span className="font-mono text-[10px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded-md">
              {flight.destinationIata}
            </span>
          </span>
          {returnHome && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-orange-700 dark:text-orange-300 bg-orange/10 border border-orange/30 rounded-md px-1.5 py-0.5"
              title="Selecting this finalizes your trip"
            >
              <Home size={9} />
              Return home
            </span>
          )}
        </div>
        <div className="flex items-center gap-x-1.5 gap-y-0.5 mt-1 text-[11px] text-text-muted font-mono min-w-0 flex-wrap">
          {direct ? (
            <span className="font-semibold text-emerald-700 dark:text-emerald-400 not-italic font-sans">
              Direct
            </span>
          ) : (
            <span className="font-semibold text-sky-700 dark:text-sky-400 not-italic font-sans">
              {flight.stops} stop{flight.stops > 1 ? 's' : ''}
              {/* Layover detail — prefer duration-aware label ("11h OTP")
                  when available, otherwise fall back to bare IATAs
                  ("via OTP, MAD"). Keeps the row informative without
                  doubling up the airport code. */}
              {(() => {
                const layovers = layoverLabel(flight);
                if (layovers) {
                  return <span className="font-normal text-text-muted"> · {layovers}</span>;
                }
                if (flight.viaIatas && flight.viaIatas.length > 0) {
                  return <span className="font-normal text-text-muted"> via {flight.viaIatas.join(', ')}</span>;
                }
                return null;
              })()}
            </span>
          )}
          <span className="text-text-xmuted">·</span>
          <span className="not-italic font-sans">{flight.airlineName}</span>
          <span className="text-text-xmuted">·</span>
          <span className="inline-flex items-center gap-1">
            <span>{formatTime(flight.departureDatetime)}</span>
            <Plane size={9} className="rotate-90 text-text-xmuted" />
            <span>{formatTime(flight.arrivalDatetime)}</span>
          </span>
          <span className="text-text-xmuted">·</span>
          <span className="text-text-muted">
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
  airportCount: number;
  expanded: boolean;
  onToggle: () => void;
  onSelectFlight: (flight: FlightOption) => void;
  // When provided, each row is checked against this predicate; rows that match
  // render a "Return home" badge. Selecting one is wired upstream to finalize
  // the trip instead of prompting for stay duration.
  isReturnHomeFlight?: (flight: FlightOption) => boolean;
  visa?: VisaRequirement;
  visaLoading?: boolean;
  /** ISO-2 of the user's current passport, for the popover header. */
  passport?: string | null;
}

export const CountryGroup = forwardRef<HTMLElement, CountryGroupProps>(function CountryGroup(
  {
    country,
    flights,
    minPrice,
    cityCount,
    airportCount,
    expanded,
    onToggle,
    onSelectFlight,
    isReturnHomeFlight,
    visa,
    visaLoading,
    passport,
  },
  ref,
) {
  const safe = country.replace(/\s+/g, '-');
  const headerId = `country-${safe}-header`;
  const panelId = `country-${safe}-panel`;
  const tone = visaTone(visa?.status);
  const railColor = tone === 'gray' ? null : VISA_TONE_BORDER[tone];
  const [popoverOpen, setPopoverOpen] = useState(false);
  // The header is split into two side-by-side buttons (title-area and
  // price-area) so the chip can sit between them as its own button without
  // nesting interactive elements. Both toggle buttons share onToggle so the
  // header still behaves like one big tap target visually.
  return (
    <section
      ref={ref}
      style={railColor ? { borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: railColor } : undefined}
      className={`bg-surface border rounded-2xl overflow-hidden scroll-mt-4 lg:scroll-mt-6 transition-shadow ${
        expanded
          ? 'border-indigo-border shadow-[0_10px_28px_rgba(55,48,163,0.10)]'
          : 'border-border shadow-[0_2px_8px_rgba(15,23,42,0.04)]'
      }`}
    >
      <div className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] hover:bg-indigo-soft/40 transition-colors">
        <button
          id={headerId}
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex-1 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40 rounded-md"
        >
          <div className="text-base font-bold text-text-primary leading-tight truncate">
            {country}
          </div>
          <div className="text-[11px] text-text-muted leading-tight mt-0.5">
            {flights.length} flight{flights.length > 1 ? 's' : ''} · {cityCount}{' '}
            {cityCount === 1 ? 'city' : 'cities'}
            {airportCount > cityCount && (
              <> · {airportCount} airports</>
            )}
          </div>
        </button>
        {(visa || visaLoading) && (
          <VisaPill
            requirement={visa}
            loading={visaLoading && !visa}
            onClick={visa ? () => setPopoverOpen(true) : undefined}
          />
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? `Collapse ${country}` : `Expand ${country}`}
          className="shrink-0 flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40 rounded-md"
        >
          <div className="text-right">
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
      </div>

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
              returnHome={isReturnHomeFlight?.(flight) ?? false}
            />
          ))}
        </div>
      )}

      {popoverOpen && visa && (
        <Suspense fallback={null}>
          <VisaDetailsPopover
            requirement={visa}
            destinationName={country}
            passport={passport}
            onClose={() => setPopoverOpen(false)}
          />
        </Suspense>
      )}
    </section>
  );
});
