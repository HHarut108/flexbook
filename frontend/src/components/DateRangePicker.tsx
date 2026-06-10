import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/* ────────────────────────────────────────────────────────────────────────────
   DateRangePicker — single-month calendar with prev/next month navigation.
   Range-select: tap once for the start date, again for the end date. Used by
   the V2 Budget Planner and When To Go custom-range form.

   Pagination is intentionally one *month* at a time (not one week) so the
   header always reads "June 2026" and the user always knows what they're
   looking at.
   ──────────────────────────────────────────────────────────────────────────── */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function dateStrOf(d: Date): string {
  // Build the YYYY-MM-DD in *local* time — `toISOString()` converts to UTC,
  // which in any positive-offset timezone rolls midnight back to the previous
  // day (e.g. Armenia/UTC+4: tapping the 25th wrote "2026-06-24").
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtDisplay(dateStr: string): string {
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00');
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/** First Sunday on/before the first day of the month — the grid origin. */
function gridStart(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const out = new Date(first);
  out.setDate(out.getDate() - first.getDay());
  return out;
}

interface Props {
  dateFrom: string;
  dateTo: string;
  today: string;
  onChangeFrom: (v: string) => void;
  onChangeTo: (v: string) => void;
  label?: string;
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
  // On desktop the calendar grid collapses once both dates are chosen to free
  // up form space — re-opens when the user taps a chip. Mobile always shows
  // it. Mounting with both dates set (URL prefill, modify-search) starts
  // collapsed.
  const [expanded, setExpanded] = useState<boolean>(!(dateFrom && dateTo));

  // Anchor month: prefer the user's existing dateFrom; otherwise show today's.
  const initAnchor = dateFrom
    ? new Date(dateFrom.slice(0, 10) + 'T12:00:00')
    : todayObj;
  const [viewYear, setViewYear] = useState(initAnchor.getFullYear());
  const [viewMonth, setViewMonth] = useState(initAnchor.getMonth());

  // Disable "previous" when stepping back would land entirely before today's
  // month — keeps the user from drifting deep into the past.
  const canGoPrev = !(
    viewYear < todayObj.getFullYear() ||
    (viewYear === todayObj.getFullYear() && viewMonth <= todayObj.getMonth())
  );

  function prevMonth() {
    if (!canGoPrev) return;
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }
  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  // 6 rows × 7 cols = 42 cells. Cells from the previous/next month get a
  // muted treatment so the focal month is obvious.
  const start = gridStart(viewYear, viewMonth);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });

  const headerLabel = `${MONTH_NAMES[viewMonth]} ${viewYear}`;

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
      setExpanded(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <span className="text-xs font-medium text-text-muted px-1">{label}</span>
      )}

      {/* Departure / Return chips */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => { setPhase('from'); setExpanded(true); }}
          className={`flex flex-col p-3 md:p-2.5 rounded-2xl border transition-all text-left ${
            phase === 'from' && !(dateFrom && dateTo) ? 'border-indigo bg-indigo-soft' : 'border-border bg-surface-2'
          }`}
        >
          <span className="text-[10px] md:text-[9px] uppercase tracking-wide font-semibold text-text-xmuted">
            {fromLabel}
          </span>
          <span className={`text-sm md:text-[13px] font-semibold mt-0.5 ${dateFrom ? 'text-text-primary' : 'text-text-xmuted'}`}>
            {dateFrom ? fmtDisplay(dateFrom) : 'dd.mm.yyyy'}
          </span>
        </button>
        <button
          type="button"
          onClick={() => { if (dateFrom) { setPhase('to'); setExpanded(true); } }}
          disabled={!dateFrom}
          className={`flex flex-col p-3 md:p-2.5 rounded-2xl border transition-all text-left ${
            phase === 'to' && !(dateFrom && dateTo) ? 'border-indigo bg-indigo-soft' : 'border-border bg-surface-2'
          } ${!dateFrom ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          <span className="text-[10px] md:text-[9px] uppercase tracking-wide font-semibold text-text-xmuted">
            {toLabel}
          </span>
          <span className={`text-sm md:text-[13px] font-semibold mt-0.5 ${dateTo ? 'text-text-primary' : 'text-text-xmuted'}`}>
            {dateTo ? fmtDisplay(dateTo) : 'dd.mm.yyyy'}
          </span>
        </button>
      </div>

      {/* Single-month calendar — collapses on desktop once both dates are
          picked; mobile keeps it visible. Tap a chip above to re-open. */}
      <div className={`bg-surface border border-border rounded-2xl p-3 md:p-2.5 ${expanded ? '' : 'md:hidden'}`}>
        <div className="flex items-center justify-between mb-2 md:mb-1.5">
          <button
            type="button"
            onClick={prevMonth}
            disabled={!canGoPrev}
            className="p-1.5 md:p-1 rounded-lg hover:bg-surface-2 transition-colors text-text-muted disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} className="md:hidden" />
            <ChevronLeft size={14} className="hidden md:block" />
          </button>
          <span className="text-sm md:text-[13px] font-bold text-text-primary">{headerLabel}</span>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1.5 md:p-1 rounded-lg hover:bg-surface-2 transition-colors text-text-muted"
            aria-label="Next month"
          >
            <ChevronRight size={16} className="md:hidden" />
            <ChevronRight size={14} className="hidden md:block" />
          </button>
        </div>

        <div className="grid grid-cols-7 mb-0.5">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-[10px] md:text-[9px] font-semibold text-text-xmuted py-0.5">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((dayObj, i) => {
            const dateStr = dateStrOf(dayObj);
            const isPast = dateStr < today;
            const isFrom = dateStr === dateFrom;
            const isTo = dateStr === dateTo;
            const inRange = !!(dateFrom && dateTo && dateStr > dateFrom && dateStr < dateTo);
            const isToday = dateStr === today;
            const isOffMonth = dayObj.getMonth() !== viewMonth;

            let cls =
              'relative flex items-center justify-center h-9 md:h-7 w-full text-[13px] md:text-[12px] transition-colors select-none rounded-lg ';
            if (isPast) {
              cls += 'opacity-25 cursor-not-allowed ';
            } else if (isFrom || isTo) {
              cls += 'bg-indigo text-white font-bold cursor-pointer ';
            } else if (inRange) {
              cls += 'bg-indigo/10 text-indigo cursor-pointer ';
            } else if (isOffMonth) {
              cls += 'text-text-xmuted hover:bg-surface-2 cursor-pointer ';
            } else {
              cls += 'text-text-primary hover:bg-surface-2 cursor-pointer ';
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
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <p className={`text-[11px] text-text-xmuted px-1 ${expanded ? '' : 'md:hidden'}`}>
        {phase === 'from' ? `Tap a ${fromLabel.toLowerCase()} date` : `Now tap your ${toLabel.toLowerCase()} date`}
      </p>
    </div>
  );
}
