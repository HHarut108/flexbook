import { useEffect, useState, useCallback } from 'react';
import {
  AirportSearchEntry,
  LocationSelection,
  selectionLabel,
  selectionToMarker,
} from '@fast-travel/shared';
import { addDays, format } from 'date-fns';
import { CalendarDays, Plus, Search, X } from 'lucide-react';
import { AirportSearchInput } from './AirportSearchInput';
import { SegmentedControl } from './SegmentedControl';
import { getAirportIndex, resolveMarkerInIndex } from '../lib/airportIndex';
import { formatYMD } from '../utils/date.utils';

export type TripType = 'oneway' | 'return' | 'multi';

export interface EditSearchLeg {
  origin: string;
  destination: string;
  date: string;
}

interface Props {
  type: TripType;
  legs: EditSearchLeg[];
  passengers: number;
  /** Called with the new URLSearchParams when the user submits Update results.
   *  The parent owns navigation. */
  onSubmit: (params: URLSearchParams) => void;
  onClose: () => void;
}

const TRIP_TYPE_OPTIONS: { value: TripType; label: string }[] = [
  { value: 'oneway', label: 'One-way' },
  { value: 'return', label: 'Return' },
  { value: 'multi', label: 'Multi-city' },
];

interface EditableLeg {
  fromQuery: string;
  fromAirport: LocationSelection | null;
  toQuery: string;
  toAirport: LocationSelection | null;
  date: string;
}

/** Hydrate an editable leg from a serialized {origin,destination,date}. The
 *  airport index resolves the markers back to AirportSearchEntry; if it can't
 *  resolve (e.g. a city marker that isn't in the index yet), the field stays
 *  empty and the input shows the raw marker so the user can re-pick. */
function emptyLeg(date: string, fromAirport: LocationSelection | null = null): EditableLeg {
  return {
    fromQuery: fromAirport ? selectionLabel(fromAirport) : '',
    fromAirport,
    toQuery: '',
    toAirport: null,
    date,
  };
}

export function EditSearchPanel({ type, legs, passengers, onSubmit, onClose }: Props) {
  const todayYMD = formatYMD(new Date());
  const [tripType, setTripType] = useState<TripType>(type);

  // One-way + Return state
  const [fromQuery, setFromQuery] = useState('');
  const [fromAirport, setFromAirport] = useState<LocationSelection | null>(null);
  const [toQuery, setToQuery] = useState('');
  const [toAirport, setToAirport] = useState<LocationSelection | null>(null);
  const [departDate, setDepartDate] = useState(legs[0]?.date ?? formatYMD(addDays(new Date(), 7)));
  const [returnDate, setReturnDate] = useState(
    legs[1]?.date ?? formatYMD(addDays(new Date(), 14)),
  );
  const [pax, setPax] = useState(passengers);

  // Multi-city state — separate so switching between one-way and multi doesn't
  // clobber the user's filled-in legs.
  const [multiLegs, setMultiLegs] = useState<EditableLeg[]>(() =>
    type === 'multi' && legs.length > 0
      ? legs.map((l) => ({
          fromQuery: l.origin,
          fromAirport: null,
          toQuery: l.destination,
          toAirport: null,
          date: l.date,
        }))
      : [
          emptyLeg(formatYMD(addDays(new Date(), 7))),
          emptyLeg(formatYMD(addDays(new Date(), 10))),
        ],
  );

  // Hydrate from props: resolve the URL markers against the airport index so
  // the inputs pre-fill with the right "City (IATA)" label rather than the
  // raw marker. Runs once per mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const index = await getAirportIndex();
      if (cancelled) return;

      if (type === 'oneway' || type === 'return') {
        const first = legs[0];
        if (first) {
          const o = resolveMarkerInIndex(index, first.origin);
          const d = resolveMarkerInIndex(index, first.destination);
          if (o) {
            const sel = entryToSelection(o);
            setFromAirport(sel);
            setFromQuery(selectionLabel(sel));
          } else {
            setFromQuery(first.origin);
          }
          if (d) {
            const sel = entryToSelection(d);
            setToAirport(sel);
            setToQuery(selectionLabel(sel));
          } else {
            setToQuery(first.destination);
          }
        }
      }

      if (type === 'multi') {
        setMultiLegs((prev) =>
          prev.map((leg) => {
            const o = resolveMarkerInIndex(index, leg.fromQuery);
            const d = resolveMarkerInIndex(index, leg.toQuery);
            return {
              ...leg,
              fromAirport: o ? entryToSelection(o) : null,
              fromQuery: o ? selectionLabel(entryToSelection(o)) : leg.fromQuery,
              toAirport: d ? entryToSelection(d) : null,
              toQuery: d ? selectionLabel(entryToSelection(d)) : leg.toQuery,
            };
          }),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
    // We intentionally only hydrate once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addLeg = useCallback(() => {
    setMultiLegs((prev) => {
      if (prev.length >= 6) return prev;
      const last = prev[prev.length - 1];
      const carryFrom = last.toAirport;
      const nextDate = formatYMD(addDays(new Date(last.date + 'T12:00:00'), 3));
      return [...prev, emptyLeg(nextDate, carryFrom)];
    });
  }, []);

  const removeLeg = useCallback((index: number) => {
    setMultiLegs((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  function canSubmit(): boolean {
    if (tripType === 'multi') {
      return multiLegs.every((leg) => leg.fromAirport && leg.toAirport && leg.date);
    }
    if (!fromAirport || !toAirport || !departDate) return false;
    if (tripType === 'return' && !returnDate) return false;
    return true;
  }

  function handleSubmit() {
    if (!canSubmit()) return;
    const params = new URLSearchParams();
    params.set('type', tripType);
    params.set('pax', String(pax));
    if (tripType === 'multi') {
      const encoded = multiLegs
        .map(
          (leg) =>
            `${selectionToMarker(leg.fromAirport!)},${selectionToMarker(leg.toAirport!)},${leg.date}`,
        )
        .join('|');
      params.set('legs', encoded);
    } else {
      params.set('origin', selectionToMarker(fromAirport!));
      params.set('destination', selectionToMarker(toAirport!));
      params.set('depart', departDate);
      if (tripType === 'return') params.set('return', returnDate);
    }
    onSubmit(params);
  }

  return (
    <div className="bg-surface rounded-2xl border border-border/70 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.22)] p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <SegmentedControl
          value={tripType}
          onChange={setTripType}
          options={TRIP_TYPE_OPTIONS}
          ariaLabel="Trip type"
        />
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-muted hover:text-text-primary hover:border-indigo-border transition-colors"
          aria-label="Close edit search"
        >
          <X size={14} />
        </button>
      </div>

      {tripType !== 'multi' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto] gap-3">
          <Field label="From">
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
              placeholder="Origin city or airport"
              ariaLabel="Origin"
              initialSelectedLabel={fromAirport ? selectionLabel(fromAirport) : null}
            />
          </Field>
          <Field label="To">
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
              placeholder="Destination city or airport"
              ariaLabel="Destination"
              initialSelectedLabel={toAirport ? selectionLabel(toAirport) : null}
            />
          </Field>
          <Field label="Depart">
            <DateField value={departDate} onChange={setDepartDate} min={todayYMD} />
          </Field>
          {tripType === 'return' && (
            <Field label="Return">
              <DateField value={returnDate} onChange={setReturnDate} min={departDate || todayYMD} />
            </Field>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {multiLegs.map((leg, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-border/60 p-3 bg-surface-2/40 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-2.5"
            >
              <Field label={`Flight ${idx + 1} · from`}>
                <AirportSearchInput
                  value={leg.fromQuery}
                  onChange={(v) =>
                    setMultiLegs((prev) =>
                      prev.map((l, i) =>
                        i === idx ? { ...l, fromQuery: v, fromAirport: null } : l,
                      ),
                    )
                  }
                  onSelect={(s) =>
                    setMultiLegs((prev) =>
                      prev.map((l, i) =>
                        i === idx ? { ...l, fromAirport: s, fromQuery: selectionLabel(s) } : l,
                      ),
                    )
                  }
                  placeholder="From"
                  ariaLabel={`Flight ${idx + 1} origin`}
                  initialSelectedLabel={leg.fromAirport ? selectionLabel(leg.fromAirport) : null}
                />
              </Field>
              <Field label="to">
                <AirportSearchInput
                  value={leg.toQuery}
                  onChange={(v) =>
                    setMultiLegs((prev) =>
                      prev.map((l, i) => (i === idx ? { ...l, toQuery: v, toAirport: null } : l)),
                    )
                  }
                  onSelect={(s) =>
                    setMultiLegs((prev) =>
                      prev.map((l, i) =>
                        i === idx ? { ...l, toAirport: s, toQuery: selectionLabel(s) } : l,
                      ),
                    )
                  }
                  placeholder="To"
                  ariaLabel={`Flight ${idx + 1} destination`}
                  initialSelectedLabel={leg.toAirport ? selectionLabel(leg.toAirport) : null}
                />
              </Field>
              <Field label="date">
                <DateField
                  value={leg.date}
                  onChange={(v) =>
                    setMultiLegs((prev) => prev.map((l, i) => (i === idx ? { ...l, date: v } : l)))
                  }
                  min={todayYMD}
                />
              </Field>
              {multiLegs.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeLeg(idx)}
                  className="md:self-end w-10 h-12 rounded-2xl bg-surface border border-border flex items-center justify-center text-text-muted hover:text-error hover:border-error/40 transition-colors"
                  aria-label={`Remove flight ${idx + 1}`}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          {multiLegs.length < 6 && (
            <button
              type="button"
              onClick={addLeg}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-dashed border-border text-sm font-semibold text-text-secondary hover:bg-surface-2 transition-all"
            >
              <Plus size={14} /> Add another flight
            </button>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-end justify-between">
        <div className="max-w-[200px]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5 px-1">
            Passengers
          </p>
          <div
            className="input-field flex items-center justify-between gap-1 px-2 rounded-2xl"
            style={{ height: '44px' }}
          >
            <button
              type="button"
              onClick={() => setPax((v) => Math.max(1, v - 1))}
              disabled={pax <= 1}
              className="w-7 h-7 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-text-primary font-semibold text-base disabled:opacity-30 hover:border-indigo-border shrink-0"
              aria-label="Remove passenger"
            >
              −
            </button>
            <span className="text-text-primary font-medium text-base text-center flex-1">
              {pax}
            </span>
            <button
              type="button"
              onClick={() => setPax((v) => Math.min(9, v + 1))}
              disabled={pax >= 9}
              className="w-7 h-7 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-text-primary font-semibold text-base disabled:opacity-30 hover:border-indigo-border shrink-0"
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
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-orange text-white text-sm font-bold hover:bg-orange-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] shrink-0"
          style={{ boxShadow: '0 12px 24px -8px rgba(249,115,22,0.5)' }}
        >
          <Search size={14} /> Update results
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5 px-1">
        {label}
      </p>
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
    <label
      className="input-field relative flex items-center gap-2 px-3 rounded-2xl cursor-pointer"
      style={{ height: '44px' }}
    >
      <CalendarDays size={14} className="text-text-xmuted shrink-0 pointer-events-none" />
      <span
        className={`text-sm flex-1 truncate pointer-events-none ${
          value ? 'text-text-primary font-medium' : 'text-text-xmuted'
        }`}
      >
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

/** AirportSearchEntry → LocationSelection. The two are structurally identical
 *  unions but TypeScript needs the conversion explicit. */
function entryToSelection(entry: AirportSearchEntry): LocationSelection {
  return entry as LocationSelection;
}
