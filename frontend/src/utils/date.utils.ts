import { format, addDays, parseISO, differenceInDays } from 'date-fns';

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'EEE, MMM d');
}

export function formatDateLong(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'EEEE, MMMM d');
}

export function formatTime(datetime: string): string {
  return format(parseISO(datetime), 'HH:mm');
}

export function formatYMD(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function addDaysToDate(dateStr: string, days: number): string {
  return formatYMD(addDays(parseISO(dateStr), days));
}

export function computeNextDeparture(arrivalDatetime: string, stayDays: number): string {
  const arrivalDate = arrivalDatetime.split('T')[0];
  return addDaysToDate(arrivalDate, stayDays);
}

export function minDepartureDate(stopIndex: number, prevArrival?: string): string {
  if (stopIndex === 1 || !prevArrival) {
    return formatYMD(addDays(new Date(), 1));
  }
  const arrivalDate = prevArrival.split('T')[0];
  return addDaysToDate(arrivalDate, 1);
}

export function maxDepartureDate(): string {
  return formatYMD(addDays(new Date(), 365));
}

export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function daysBetween(dateA: string, dateB: string): number {
  return differenceInDays(parseISO(dateB), parseISO(dateA));
}

/** "Apr 12" — used in the trip timeline strip */
export function formatShortDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'MMM d');
}
