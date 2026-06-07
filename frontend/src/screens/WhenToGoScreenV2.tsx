import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LocationSelection, selectionLabel } from '@fast-travel/shared';
import { format, addDays, addMonths, endOfMonth, startOfMonth } from 'date-fns';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { MarketingShellV2 } from '../components/MarketingShellV2';
import { AirportSearchInput } from '../components/AirportSearchInput';
import { TripMapColumn } from '../components/TripMapColumn';
import { V2ToolHero } from '../components/V2ToolHero';
import { MobileViewToggle, type MobileView } from '../components/MobileViewToggle';
import { DateRangePicker } from '../components/DateRangePicker';
import { formatYMD } from '../utils/date.utils';

interface Props {
  onMenuOpen?: () => void;
}

type RangePresetId = 'this-month' | 'next-month' | 'next-90' | 'custom';

interface DateRange {
  id: RangePresetId;
  label: string;
  start: string;
  end: string;
}

function buildPresetRange(id: Exclude<RangePresetId, 'custom'>): DateRange {
  const today = new Date();
  if (id === 'this-month') {
    return {
      id,
      label: 'This month',
      start: formatYMD(today),
      end: formatYMD(endOfMonth(today)),
    };
  }
  if (id === 'next-month') {
    const next = addMonths(today, 1);
    return {
      id,
      label: 'Next month',
      start: formatYMD(startOfMonth(next)),
      end: formatYMD(endOfMonth(next)),
    };
  }
  return {
    id,
    label: 'Next 90 days',
    start: formatYMD(today),
    end: formatYMD(addDays(today, 90)),
  };
}

const PRESETS = [
  buildPresetRange('this-month'),
  buildPresetRange('next-month'),
  buildPresetRange('next-90'),
];

function fmtRange(start: string, end: string): string {
  try {
    const s = format(new Date(start + 'T12:00:00'), 'MMM d');
    const e = format(new Date(end + 'T12:00:00'), 'MMM d');
    return `${s} – ${e}`;
  } catch {
    return `${start} – ${end}`;
  }
}

export function WhenToGoScreenV2({ onMenuOpen }: Props) {
  const navigate = useNavigate();
  const [destQuery, setDestQuery] = useState('');
  const [destination, setDestination] = useState<LocationSelection | null>(null);
  const [origin, setOrigin] = useState<LocationSelection | null>(null);
  const [originQuery, setOriginQuery] = useState('');
  const [range, setRange] = useState<DateRange>(PRESETS[2]); // default: Next 90 days
  const [customStart, setCustomStart] = useState(formatYMD(new Date()));
  const [customEnd, setCustomEnd] = useState(formatYMD(addDays(new Date(), 30)));
  const [mobileView, setMobileView] = useState<MobileView>('list');

  function selectPreset(p: DateRange) {
    setRange(p);
  }

  function selectCustom() {
    setRange({
      id: 'custom',
      label: 'Custom range',
      start: customStart,
      end: customEnd,
    });
  }

  function handleSearch() {
    // Hand off to V1 When To Go for the real heatmap.
    navigate('/when-to-go');
  }

  return (
    <MarketingShellV2
      active="when"
      title="When to Go"
      description="Find the cheapest day to fly between any two cities."
      onMenuOpen={onMenuOpen}
    >
      <section className="max-w-6xl xl:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 pt-6 md:pt-14 pb-10">
        {/* Two-column on lg+: [hero + map] left, form right */}
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 lg:gap-10">
          {/* LEFT: hero + (mobile toggle) + map */}
          <div>
            <V2ToolHero
              toolName="When to Go"
              titleLine1="Find the cheapest"
              titleAccent="time"
              subhead="Pick where you want to go — we'll surface the single cheapest day to fly. Change anything and the answer updates live."
            />

            <div className="md:hidden mb-5">
              <MobileViewToggle value={mobileView} onChange={setMobileView} />
            </div>

            <div className={`${mobileView === 'map' ? '' : 'hidden'} md:block`}>
              <TripMapColumn
                origin={origin}
                destination={destination}
              />
            </div>
          </div>

          {/* RIGHT: form card */}
          <div
            className={`bg-surface rounded-[24px] border border-border/60 p-5 md:p-6 ${mobileView === 'list' ? '' : 'hidden'} md:block`}
            style={{ boxShadow: '0 20px 50px -20px rgba(15,23,42,0.18)' }}
          >
            <FieldLabel>I want to go to</FieldLabel>
            <div className="mb-4">
              <AirportSearchInput
                value={destQuery}
                onChange={(v) => {
                  setDestQuery(v);
                  if (destination) setDestination(null);
                }}
                onSelect={(s) => {
                  setDestination(s);
                  setDestQuery(selectionLabel(s));
                }}
                placeholder="Destination city or airport"
                ariaLabel="Destination"
              />
            </div>

            <FieldLabel>From (optional)</FieldLabel>
            <div className="mb-6">
              <AirportSearchInput
                value={originQuery}
                onChange={(v) => {
                  setOriginQuery(v);
                  if (origin) setOrigin(null);
                }}
                onSelect={(s) => {
                  setOrigin(s);
                  setOriginQuery(selectionLabel(s));
                }}
                placeholder="Anywhere — we'll detect your nearest"
                ariaLabel="Origin"
              />
            </div>

            <FieldLabel>Date range</FieldLabel>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPreset(p)}
                  className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-all border ${
                    range.id === p.id
                      ? 'bg-text-primary text-bg border-text-primary'
                      : 'bg-surface text-text-secondary border-border hover:bg-surface-2 hover:text-text-primary'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={selectCustom}
                className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-all border ${
                  range.id === 'custom'
                    ? 'bg-text-primary text-bg border-text-primary'
                    : 'bg-surface text-text-secondary border-border hover:bg-surface-2 hover:text-text-primary'
                }`}
              >
                Custom range
              </button>
            </div>

            {range.id === 'custom' ? (
              <div className="mb-5">
                <DateRangePicker
                  dateFrom={customStart}
                  dateTo={customEnd}
                  today={formatYMD(new Date())}
                  label=""
                  fromLabel="Earliest"
                  toLabel="Latest"
                  onChangeFrom={(v) => {
                    setCustomStart(v);
                    setRange((r) => ({ ...r, start: v }));
                  }}
                  onChangeTo={(v) => {
                    setCustomEnd(v);
                    setRange((r) => ({ ...r, end: v }));
                  }}
                />
              </div>
            ) : (
              <p className="text-[11px] text-text-muted mb-5 px-1">
                Searching {fmtRange(range.start, range.end)}
              </p>
            )}

            <button
              type="button"
              onClick={handleSearch}
              disabled={!destination}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-full bg-orange text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-orange-dark transition-all"
              style={{ boxShadow: '0 14px 32px -10px rgba(249,115,22,0.5)' }}
            >
              Find cheapest dates
              <ArrowRight size={14} />
            </button>
          </div>

        </div>

        {/* Empty heatmap hint */}
        <div className="mt-10 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-surface border border-border/60 flex items-center justify-center mb-3">
            <CalendarDays size={20} className="text-text-muted" />
          </div>
          <p className="text-sm text-text-muted">
            Type a destination to see a 3-month price heatmap.
          </p>
        </div>
      </section>
    </MarketingShellV2>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
      {children}
    </div>
  );
}

// DateField removed — custom range now uses the shared DateRangePicker
// (same single-month calendar Budget Planner uses).
