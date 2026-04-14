import { useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isBefore,
  isAfter,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
} from 'date-fns';
import { useTripStore } from '../store/trip.store';
import { useSessionStore } from '../store/session.store';
import { minDepartureDate, maxDepartureDate } from '../utils/date.utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function DatePickerScreen() {
  const origin = useTripStore((s) => s.origin);
  const legs = useTripStore((s) => s.legs);
  const { setSelectedDate, setScreen } = useSessionStore();

  const nonReturnLegs = legs.filter((l) => !l.isReturn);
  const stopIndex = nonReturnLegs.length + 1;
  const prevArrival = nonReturnLegs.at(-1)?.arrivalDatetime;

  const minStr = minDepartureDate(stopIndex, prevArrival);
  const maxStr = maxDepartureDate();
  const minDate = parseISO(minStr);
  const maxDate = parseISO(maxStr);

  const [viewMonth, setViewMonth] = useState(minDate);
  const [selected, setSelected] = useState<Date | null>(null);

  const days = eachDayOfInterval({
    start: startOfMonth(viewMonth),
    end: endOfMonth(viewMonth),
  });

  const startDayOfWeek = startOfMonth(viewMonth).getDay(); // 0=Sun

  function canSelect(day: Date) {
    return !isBefore(day, minDate) && !isAfter(day, maxDate);
  }

  function handleConfirm() {
    if (!selected) return;
    setSelectedDate(format(selected, 'yyyy-MM-dd'));
    setScreen('flight-results');
  }

  const title = stopIndex === 1
    ? `Departing from ${origin?.city.name}`
    : `Departing from ${legs.at(-1)?.destinationCity}`;

  return (
    <div className="px-4 pb-8 pt-4">
      <h2 className="text-xl font-bold text-text-primary mb-1">Pick a date</h2>
      <p className="text-text-muted text-sm mb-6">{title}</p>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
          disabled={isSameDay(startOfMonth(viewMonth), startOfMonth(minDate))}
          className="p-2 rounded-xl hover:bg-surface-2 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="font-semibold text-text-primary">
          {format(viewMonth, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="p-2 rounded-xl hover:bg-surface-2 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="text-center text-xs text-text-muted py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 mb-6">
        {/* Empty cells for offset */}
        {Array.from({ length: startDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {days.map((day) => {
          const selectable = canSelect(day);
          const isSelected = selected && isSameDay(day, selected);
          return (
            <button
              key={day.toISOString()}
              disabled={!selectable}
              onClick={() => setSelected(day)}
              className={[
                'rounded-xl py-2 text-sm font-medium transition-colors',
                isSelected
                  ? 'bg-accent text-bg'
                  : selectable
                  ? 'hover:bg-surface-2 text-text-primary'
                  : 'text-text-muted opacity-30 cursor-not-allowed',
              ].join(' ')}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>

      <button className="btn-primary" disabled={!selected} onClick={handleConfirm}>
        {selected ? `Search flights for ${format(selected, 'MMM d')}` : 'Select a date'}
      </button>

      <button
        className="btn-outline mt-3"
        onClick={() => setScreen('home')}
      >
        Back
      </button>
    </div>
  );
}
