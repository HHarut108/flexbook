import { lazy, Suspense, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LocationSelection, selectionLabel, selectionToMarker } from '@fast-travel/shared';
import { addDays, format } from 'date-fns';
import { Send, CalendarDays, Plus, X } from 'lucide-react';
import { MarketingShellV2 } from '../components/MarketingShellV2';
import { AirportSearchInput } from '../components/AirportSearchInput';
import { SegmentedControl } from '../components/SegmentedControl';
// TripMapColumn lives behind a leaflet import — lazy so the form ships
// without ~150 KB of map code.
const TripMapColumn = lazy(() =>
  import('../components/TripMapColumn').then((m) => ({ default: m.TripMapColumn })),
);
import { V2ToolHero } from '../components/V2ToolHero';
import { MobileViewToggle, type MobileView } from '../components/MobileViewToggle';
import { formatYMD } from '../utils/date.utils';

interface Props {
  onMenuOpen?: () => void;
}

type TripType = 'oneway' | 'return' | 'multi';

interface Leg {
  fromQuery: string;
  fromAirport: LocationSelection | null;
  toQuery: string;
  toAirport: LocationSelection | null;
  date: string;
}

const TRIP_TYPE_OPTIONS: { value: TripType; label: string }[] = [
  { value: 'oneway', label: 'One-way' },
  { value: 'return', label: 'Return' },
  { value: 'multi', label: 'Multi-city' },
];

const MAX_LEGS = 6;

function emptyLeg(date: string, fromAirport: LocationSelection | null = null): Leg {
  return {
    fromQuery: fromAirport ? selectionLabel(fromAirport) : '',
    fromAirport,
    toQuery: '',
    toAirport: null,
    date,
  };
}

/**
 * V2 redesign of "Find a Flight" (formerly the home form, previously
 * displayed as "Quick Search"). Route stays at `/quick-search` for
 * shared-link compatibility; only the display name is verb-led.
 * Wrapped in MarketingShellV2. Submits the same /search?... params as
 * V1 so the downstream flow is unchanged.
 */
export function QuickSearchScreenV2({ onMenuOpen }: Props) {
  const navigate = useNavigate();
  const todayYMD = formatYMD(new Date());

  const [tripType, setTripType] = useState<TripType>('oneway');
  const [fromQuery, setFromQuery] = useState('');
  const [fromAirport, setFromAirport] = useState<LocationSelection | null>(null);
  const [toQuery, setToQuery] = useState('');
  const [toAirport, setToAirport] = useState<LocationSelection | null>(null);
  const [departDate, setDepartDate] = useState(formatYMD(addDays(new Date(), 7)));
  const [returnDate, setReturnDate] = useState(formatYMD(addDays(new Date(), 14)));
  const [passengers, setPassengers] = useState(1);
  const [legs, setLegs] = useState<Leg[]>(() => [
    emptyLeg(formatYMD(addDays(new Date(), 7))),
    emptyLeg(formatYMD(addDays(new Date(), 10))),
  ]);
  const [mobileView, setMobileView] = useState<MobileView>('list');

  const addLeg = useCallback(() => {
    setLegs((prev) => {
      if (prev.length >= MAX_LEGS) return prev;
      const last = prev[prev.length - 1];
      const carryFrom = last.toAirport;
      const nextDate = formatYMD(addDays(new Date(last.date + 'T12:00:00'), 3));
      return [...prev, emptyLeg(nextDate, carryFrom)];
    });
  }, []);

  const removeLeg = useCallback((index: number) => {
    setLegs((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  function canSubmit(): boolean {
    if (tripType === 'multi') {
      return legs.every((leg) => leg.fromAirport && leg.toAirport && leg.date);
    }
    if (!fromAirport || !toAirport || !departDate) return false;
    if (tripType === 'return' && !returnDate) return false;
    return true;
  }

  function handleSubmit() {
    if (!canSubmit()) return;
    const params = new URLSearchParams();
    params.set('type', tripType);
    params.set('pax', String(passengers));
    if (tripType === 'multi') {
      const encoded = legs
        .map((leg) => `${selectionToMarker(leg.fromAirport!)},${selectionToMarker(leg.toAirport!)},${leg.date}`)
        .join('|');
      params.set('legs', encoded);
    } else {
      params.set('origin', selectionToMarker(fromAirport!));
      params.set('destination', selectionToMarker(toAirport!));
      params.set('depart', departDate);
      if (tripType === 'return') params.set('return', returnDate);
    }
    navigate(`/search?${params.toString()}`);
  }

  return (
    <MarketingShellV2
      active="search"
      title="Find a Flight"
      description="Find the cheapest one-way, return, or multi-city flights. Live fares, no account needed."
      onMenuOpen={onMenuOpen}
    >
      <section className="max-w-6xl xl:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 pt-6 md:pt-14 pb-10">
        {/* Two-column on lg+: [hero + map] left, form right. The hero sits in
            the left column so the form (right) horizontally aligns with the
            tagline rather than stacking below it. On mobile the columns stack
            and a List/Map toggle controls which one is visible. */}
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 lg:gap-10">
          {/* LEFT: hero + (mobile toggle) + map */}
          <div>
            <V2ToolHero
              toolName="Find a Flight"
              titleLine1="Find your"
              titleAccent="flight"
              subhead="Compare cheapest fares across millions of routes. One-way, return, or multi-city — pick the option that fits."
            />

            {/* The mobile List/Map toggle is only meaningful once the user has
                picked at least one airport. Before that, the map renders an
                empty placeholder and the toggle just confuses things — so we
                hide both the toggle and the map until a pin can land. Desktop
                always shows the map column (md:block below). */}
            {(() => {
              const hasMobileMapTarget =
                tripType === 'multi'
                  ? legs.some((l) => l.fromAirport || l.toAirport)
                  : Boolean(fromAirport || toAirport);
              return (
                <>
                  {hasMobileMapTarget && (
                    <div className="md:hidden mb-5">
                      <MobileViewToggle value={mobileView} onChange={setMobileView} />
                    </div>
                  )}
                  <div
                    className={
                      // On mobile, show the map column only when the toggle is
                      // visible AND set to "map". On md+, always show.
                      (hasMobileMapTarget && mobileView === 'map' ? '' : 'hidden') +
                      ' md:block'
                    }
                  >
                    <Suspense fallback={<div className="aspect-square w-full rounded-2xl bg-surface-muted" aria-hidden />}>
                      {tripType === 'multi' ? (
                        <TripMapColumn
                          legs={legs
                            .filter((l) => l.fromAirport && l.toAirport)
                            .map((l) => ({ from: l.fromAirport!, to: l.toAirport! }))}
                        />
                      ) : (
                        <TripMapColumn origin={fromAirport} destination={toAirport} />
                      )}
                    </Suspense>
                  </div>
                </>
              );
            })()}
          </div>

          {/* RIGHT: form card */}
          <div
            className={`bg-surface rounded-[24px] border border-border/60 p-5 md:p-6 ${mobileView === 'list' ? '' : 'hidden'} md:block`}
            style={{ boxShadow: '0 20px 50px -20px rgba(15,23,42,0.18)' }}
          >
            <div className="flex justify-end mb-5">
              <SegmentedControl
                value={tripType}
                onChange={setTripType}
                options={TRIP_TYPE_OPTIONS}
                ariaLabel="Trip type"
              />
            </div>

            {tripType !== 'multi' ? (
              <>
                <FieldLabel>From</FieldLabel>
                <AirportSearchInput
                  value={fromQuery}
                  onChange={(v) => {
                    setFromQuery(v);
                    if (fromAirport) setFromAirport(null);
                  }}
                  onSelect={(s) => {
                    setFromAirport(s);
                    setFromQuery(selectionLabel(s));
                  }}
                  placeholder="Origin city or airport code"
                  ariaLabel="Origin airport"
                />

                <div className="mt-4">
                  <FieldLabel>To</FieldLabel>
                  <AirportSearchInput
                    value={toQuery}
                    onChange={(v) => {
                      setToQuery(v);
                      if (toAirport) setToAirport(null);
                    }}
                    onSelect={(s) => {
                      setToAirport(s);
                      setToQuery(selectionLabel(s));
                    }}
                    placeholder="Destination city or airport code"
                    ariaLabel="Destination airport"
                  />
                </div>

                <div className={`mt-4 grid ${tripType === 'return' ? 'grid-cols-2 gap-3' : 'grid-cols-1'}`}>
                  <div>
                    <FieldLabel>Depart</FieldLabel>
                    <DateField value={departDate} onChange={setDepartDate} min={todayYMD} />
                  </div>
                  {tripType === 'return' && (
                    <div>
                      <FieldLabel>Return</FieldLabel>
                      <DateField value={returnDate} onChange={setReturnDate} min={departDate || todayYMD} />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-3">
                {legs.map((leg, idx) => (
                  <div key={idx} className="rounded-2xl border border-border/60 p-3 bg-surface-2/40">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                        Flight {idx + 1}
                      </span>
                      {legs.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeLeg(idx)}
                          className="text-text-muted hover:text-error transition-colors"
                          aria-label={`Remove flight ${idx + 1}`}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-2.5">
                      <AirportSearchInput
                        value={leg.fromQuery}
                        onChange={(v) =>
                          setLegs((prev) =>
                            prev.map((l, i) => (i === idx ? { ...l, fromQuery: v, fromAirport: null } : l)),
                          )
                        }
                        onSelect={(s) =>
                          setLegs((prev) =>
                            prev.map((l, i) =>
                              i === idx ? { ...l, fromAirport: s, fromQuery: selectionLabel(s) } : l,
                            ),
                          )
                        }
                        placeholder="From"
                        ariaLabel={`Flight ${idx + 1} origin`}
                      />
                      <AirportSearchInput
                        value={leg.toQuery}
                        onChange={(v) =>
                          setLegs((prev) =>
                            prev.map((l, i) => (i === idx ? { ...l, toQuery: v, toAirport: null } : l)),
                          )
                        }
                        onSelect={(s) =>
                          setLegs((prev) =>
                            prev.map((l, i) =>
                              i === idx ? { ...l, toAirport: s, toQuery: selectionLabel(s) } : l,
                            ),
                          )
                        }
                        placeholder="To"
                        ariaLabel={`Flight ${idx + 1} destination`}
                      />
                      <DateField
                        value={leg.date}
                        onChange={(v) =>
                          setLegs((prev) => prev.map((l, i) => (i === idx ? { ...l, date: v } : l)))
                        }
                        min={todayYMD}
                      />
                    </div>
                  </div>
                ))}
                {legs.length < MAX_LEGS && (
                  <button
                    type="button"
                    onClick={addLeg}
                    className="flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-border text-sm font-semibold text-text-secondary hover:bg-surface-2 transition-all"
                  >
                    <Plus size={14} /> Add another flight
                  </button>
                )}
              </div>
            )}

            <div className="mt-5">
              <FieldLabel>Passengers</FieldLabel>
              <div
                className="input-field flex items-center justify-between gap-1 px-2 rounded-2xl"
                style={{ height: '48px' }}
              >
                <button
                  type="button"
                  onClick={() => setPassengers((v) => Math.max(1, v - 1))}
                  disabled={passengers <= 1}
                  className="w-8 h-8 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-primary font-semibold text-lg disabled:opacity-30 hover:border-indigo-border shrink-0"
                  aria-label="Remove passenger"
                >
                  −
                </button>
                <span className="text-text-primary font-medium text-base text-center flex-1">{passengers}</span>
                <button
                  type="button"
                  onClick={() => setPassengers((v) => Math.min(9, v + 1))}
                  disabled={passengers >= 9}
                  className="w-8 h-8 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-primary font-semibold text-lg disabled:opacity-30 hover:border-indigo-border shrink-0"
                  aria-label="Add passenger"
                >
                  +
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit()}
              className="w-full mt-6 flex items-center justify-center gap-2 py-4 rounded-2xl bg-orange text-white text-sm font-bold hover:bg-orange-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              style={{ boxShadow: '0 14px 30px -10px rgba(249,115,22,0.5)' }}
            >
              <Send size={15} />
              Search flights
            </button>
          </div>

        </div>
      </section>
    </MarketingShellV2>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1.5 px-1">
      {children}
    </div>
  );
}

function DateField({
  value,
  onChange,
  min,
}: {
  value: string;
  onChange: (v: string) => void;
  min: string;
}) {
  const display = value ? format(new Date(value + 'T12:00:00'), 'EEE, MMM d') : 'Pick a date';
  return (
    <label className="input-field relative flex items-center gap-2 px-3 rounded-2xl cursor-pointer" style={{ height: '48px' }}>
      <CalendarDays size={16} className="text-text-xmuted shrink-0 pointer-events-none" />
      <span className={`text-base flex-1 truncate pointer-events-none ${value ? 'text-text-primary font-medium' : 'text-text-xmuted'}`}>
        {display}
      </span>
      <input
        type="date"
        className="absolute inset-0 opacity-0 cursor-pointer"
        value={value}
        min={min}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
        aria-label={`Date: ${display}`}
      />
    </label>
  );
}
