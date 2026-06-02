import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/* ────────────────────────────────────────────────────────────────────────────
   DateRangePicker — compact 5-row week-view, today centred in row 2.
   Single calendar with range highlighting; tap once for departure, again for
   return. Shared between TripPlannerScreen (Budget Planner) and
   WhenToGoScreen (When To Go custom window).
   ──────────────────────────────────────────────────────────────────────────── */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function makeSundayOf(d: Date): Date {
  const s = new Date(d);
  s.setDate(s.getDate() - s.getDay());
  return s;
}

function dateStrOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Format "dd.mm.yyyy" for the departure/return chip labels. */
function fmtDisplay(dateStr: string): string {
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00');
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

interface Props {
  dateFrom: string;
  dateTo: string;
  today: string;
  onChangeFrom: (v: string) => void;
  onChangeTo: (v: string) => void;
  /** Override the section heading. Defaults to "Travel window". */
  label?: string;
  /** Labels for the two chips. Defaults to Departure / Return. */
  fromLabel?: string;
  toLabel?: string;
}

export function DateRangePicker({
  dateFrom,
  dateTo,
  today,
  onChangeFrom,
  onChangeTo,
  label = 'Travel window',
  fromLabel = 'Departure',
  toLabel = 'Return',
}: Props) {
  const todayObj = new Date(today + 'T12:00:00');
  const [phase, setPhase] = useState<'from' | 'to'>(dateFrom && !dateTo ? 'to' : 'from');

  // Window start = Sunday of the week 1 week before today → today lands in row 2
  const minWindowStart = makeSundayOf(todayObj);
  const initStart = makeSundayOf(new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate() - 7));
  const [windowStart, setWindowStart] = useState(initStart < minWindowStart ? minWindowStart : initStart);

  const canGoPrev = windowStart > minWindowStart;

  function prevWeek() {
    if (!canGoPrev) return;
    setWindowStart((ws) => {
      const n = new Date(ws);
      n.setDate(n.getDate() - 7);
      return n < minWindowStart ? minWindowStart : n;
    });
  }
  function nextWeek() {
    setWindowStart((ws) => {
      const n = new Date(ws);
      n.setDate(n.getDate() + 7);
      return n;
    });
  }

  // 5 rows × 7 cols = 35 cells
  const cells = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(windowStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const firstCell = cells[0];
  const lastCell = cells[34];
  const headerLabel =
    firstCell.getMonth() === lastCell.getMonth() && firstCell.getFullYear() === lastCell.getFullYear()
      ? `${MONTH_NAMES[firstCell.getMonth()]} ${firstCell.getFullYear()}`
      : firstCell.getFullYear() === lastCell.getFullYear()
        ? `${MONTH_NAMES[firstCell.getMonth()]} – ${MONTH_NAMES[lastCell.getMonth()]} ${lastCell.getFullYear()}`
        : `${MONTH_NAMES[firstCell.getMonth()]} ${firstCell.getFullYear()} – ${MONTH_NAMES[lastCell.getMonth()]} ${lastCell.getFullYear()}`;

  function handleDayClick(dateStr: string) {
    if (dateStr < today) return;
    if (phase === 'from' || (dateFrom && dateTo)) {
      onChangeFrom(dateStr);
      onChangeTo('');
      setPhase('to');
    } else if (dateStr <= dateFrom) {
      onChangeFrom(dateStr);
      onChangeTo('');
    } else {
      onChangeTo(dateStr);
      setPhase('from');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-text-muted px-1">{label}</span>

      {/* Departure / Return chips */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setPhase('from')}
          className={`flex flex-col p-3 rounded-2xl border transition-all text-left ${
            phase === 'from' && !(dateFrom && dateTo) ? 'border-indigo bg-indigo-soft' : 'border-border bg-surface-2'
          }`}
        >
          <span className="text-[10px] uppercase tracking-wide font-semibold text-text-xmuted">
            {fromLabel}
          </span>
          <span className={`text-sm font-semibold mt-0.5 ${dateFrom ? 'text-text-primary' : 'text-text-xmuted'}`}>
            {dateFrom ? fmtDisplay(dateFrom) : 'dd.mm.yyyy'}
          </span>
        </button>
        <button
          type="button"
          onClick={() => { if (dateFrom) setPhase('to'); }}
          disabled={!dateFrom}
          className={`flex flex-col p-3 rounded-2xl border transition-all text-left ${
            phase === 'to' && !(dateFrom && dateTo) ? 'border-indigo bg-indigo-soft' : 'border-border bg-surface-2'
          } ${!dateFrom ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          <span className="text-[10px] uppercase tracking-wide font-semibold text-text-xmuted">
            {toLabel}
          </span>
          <span className={`text-sm font-semibold mt-0.5 ${dateTo ? 'text-text-primary' : 'text-text-xmuted'}`}>
            {dateTo ? fmtDisplay(dateTo) : 'dd.mm.yyyy'}
          </span>
        </button>
      </div>

      {/* Compact week-view calendar */}
      <div className="bg-surface border border-border rounded-2xl p-3">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={prevWeek}
            disabled={!canGoPrev}
            className="p-1 rounded-lg hover:bg-surface-2 transition-colors text-text-muted disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous week"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-semibold text-text-primary">{headerLabel}</span>
          <button
            type="button"
            onClick={nextWeek}
            className="p-1 rounded-lg hover:bg-surface-2 transition-colors text-text-muted"
            aria-label="Next week"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-7 mb-0.5">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold text-text-xmuted py-0.5">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((dayObj, i) => {
            const dateStr = dateStrOf(dayObj);
            const isPast = dateStr < today;
            const isFrom = dateStr === dateFrom;
            const isTo = dateStr === dateTo;
            const inRange = !!(dateFrom && dateTo && dateStr > dateFrom && dateStr < dateTo);
            const isToday = dateStr === today;

            const midMonth = cells[17].getMonth();
            const isOffMonth = dayObj.getMonth() !== midMonth;

            let cls =
              'relative flex items-center justify-center h-8 w-full text-[13px] transition-colors select-none rounded-lg ';
            if (isPast) {
              cls += 'opacity-25 cursor-not-allowed ';
            } else if (isFrom || isTo) {
              cls += 'bg-indigo text-white font-bold cursor-pointer ';
            } else if (inRange) {
              cls += 'bg-indigo/10 text-indigo cursor-pointer ';
            } else {
              cls += `hover:bg-surface-2 cursor-pointer ${isOffMonth ? 'text-text-xmuted' : 'text-text-primary'} `;
            }

            return (
              <button
                key={i}
                type="button"
                disabled={isPast}
                onClick={() => handleDayClick(dateStr)}
                className={cls}
                aria-label={dateStr}
                aria-pressed={isFrom || isTo}
              >
                {dayObj.getDate()}
                {isToday && !isFrom && !isTo && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-text-xmuted px-1">
        {phase === 'from' ? `Tap a ${fromLabel.toLowerCase()} date` : `Now tap your ${toLabel.toLowerCase()} date`}
      </p>
    </div>
  );
}
