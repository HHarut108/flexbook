import { useState } from 'react';
import { TripLeg } from '@fast-travel/shared';
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
  startOfDay,
} from 'date-fns';
import { minDepartureDate, maxDepartureDate } from '../utils/date.utils';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface Props {
  currentDate: string;
  legs: TripLeg[];
  onConfirm: (date: string) => void;
  onClose: () => void;
}

export function DatePickerOverlay({ currentDate, legs, onConfirm, onClose }: Props) {
  const nonReturnLegs = legs.filter((l) => !l.isReturn);
  const stopIndex = nonReturnLegs.length + 1;
  const prevArrival = nonReturnLegs.at(-1)?.arrivalDatetime;

  const minStr = minDepartureDate(stopIndex, prevArrival);
  const maxStr = maxDepartureDate();
  const minDate = startOfDay(parseISO(minStr));
  const maxDate = startOfDay(parseISO(maxStr));

  const [viewMonth, setViewMonth] = useState(parseISO(currentDate));
  const [selected, setSelected] = useState<string>(currentDate);

  const days = eachDayOfInterval({
    start: startOfMonth(viewMonth),
    end: endOfMonth(viewMonth),
  });
  const startDayOfWeek = startOfMonth(viewMonth).getDay();

  function canSelect(day: Date) {
    const d = startOfDay(day);
    return !isBefore(d, minDate) && !isAfter(d, maxDate);
  }

  function handleConfirm() {
    onConfirm(selected);
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      {/* Sheet */}
      <div
        className="bg-surface rounded-t-3xl px-4 pt-4 pb-8 max-w-md w-full mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle + close */}
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-1 bg-border rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
          <h3 className="text-text-primary font-semibold">Pick a date</h3>
          <button
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-indigo-soft text-text-muted transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setViewMonth((m) => subMonths(m, 1))}
            disabled={isSameDay(startOfMonth(viewMonth), startOfMonth(minDate))}
            className="p-2 rounded-xl hover:bg-indigo-soft disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="font-semibold text-text-primary text-sm">
            {format(viewMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
            className="p-2 rounded-xl hover:bg-indigo-soft transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 mb-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
            <div key={d} className="text-center text-xs text-text-muted py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-0.5 mb-5">
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div key={`e-${i}`} />
          ))}
          {days.map((day) => {
            const selectable = canSelect(day);
            const isSelected = selected && isSameDay(parseISO(selected), day);
            return (
              <button
                key={day.toISOString()}
                disabled={!selectable}
                onClick={() => setSelected(format(day, 'yyyy-MM-dd'))}
                className={[
                  'rounded-xl py-2 text-sm font-medium transition-colors',
                  isSelected
                    ? 'bg-indigo text-white'
                    : selectable
                    ? 'hover:bg-indigo-soft text-text-primary'
                    : 'text-text-muted opacity-25 cursor-not-allowed',
                ].join(' ')}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>

        <button className="btn-primary" onClick={handleConfirm}>
          {selected
            ? `Search flights for ${format(parseISO(selected), 'MMM d')}`
            : 'Select a date'}
        </button>
      </div>
    </div>
  );
}
