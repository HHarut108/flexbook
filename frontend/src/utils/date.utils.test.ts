import { describe, it, expect } from 'vitest';
import {
  durationLabel,
  computeNextDeparture,
  addDaysToDate,
  daysBetween,
  formatTime,
  formatDate,
} from './date.utils';

describe('durationLabel', () => {
  it('shows hours only when no remainder minutes', () => {
    expect(durationLabel(60)).toBe('1h');
    expect(durationLabel(120)).toBe('2h');
  });

  it('shows hours and minutes when remainder exists', () => {
    expect(durationLabel(90)).toBe('1h 30m');
    expect(durationLabel(135)).toBe('2h 15m');
  });

  it('handles sub-hour duration', () => {
    expect(durationLabel(45)).toBe('0h 45m');
  });

  it('handles zero', () => {
    expect(durationLabel(0)).toBe('0h');
  });
});

describe('computeNextDeparture', () => {
  it('adds stay days to the arrival date part', () => {
    expect(computeNextDeparture('2026-04-10T14:30:00', 3)).toBe('2026-04-13');
  });

  it('handles month rollover', () => {
    expect(computeNextDeparture('2026-04-29T20:00:00', 5)).toBe('2026-05-04');
  });

  it('stay of 0 days returns the arrival date itself', () => {
    expect(computeNextDeparture('2026-06-15T10:00:00', 0)).toBe('2026-06-15');
  });
});

describe('addDaysToDate', () => {
  it('adds days correctly', () => {
    expect(addDaysToDate('2026-04-10', 7)).toBe('2026-04-17');
  });

  it('handles year rollover', () => {
    expect(addDaysToDate('2026-12-30', 5)).toBe('2027-01-04');
  });
});

describe('daysBetween', () => {
  it('returns positive number when B is after A', () => {
    expect(daysBetween('2026-04-10', '2026-04-15')).toBe(5);
  });

  it('returns 0 for same dates', () => {
    expect(daysBetween('2026-04-10', '2026-04-10')).toBe(0);
  });

  it('returns negative number when B is before A', () => {
    expect(daysBetween('2026-04-15', '2026-04-10')).toBe(-5);
  });
});

describe('formatTime', () => {
  it('formats HH:mm from ISO datetime', () => {
    expect(formatTime('2026-04-10T08:30:00')).toBe('08:30');
    expect(formatTime('2026-04-10T23:05:00')).toBe('23:05');
  });
});

describe('formatDate', () => {
  it('formats a date string as EEE, MMM d', () => {
    // 2026-04-10 is a Friday
    expect(formatDate('2026-04-10')).toBe('Fri, Apr 10');
  });
});
