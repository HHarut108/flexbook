import type { Airport } from '@fast-travel/shared';
import type { BudgetPlanResult } from '../api/budgetTrip.api';

/** A snapshot of the V2 Plan by Budget form + last result. Persisted to
 *  sessionStorage so a refresh on the result view restores the trip plan
 *  instead of dropping the user back at empty inputs. Cleared by the
 *  "Modify search" link and overwritten by each new submit. */
export interface BudgetPlannerSnapshot {
  origin: Airport;
  budget: number;
  dateFrom: string;
  dateTo: string;
  passengers: number;
  destCount: number | 'max';
  nightsPerStopArr: number[];
  tripStyle: 'value' | 'visafree' | 'offpath' | 'sunny' | 'short';
  excludedDestinations: string[];
  result: BudgetPlanResult;
}

const KEY = 'flexbook.budgetPlanner.snapshot';

export function saveBudgetSnapshot(snap: BudgetPlannerSnapshot): void {
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(KEY, JSON.stringify(snap));
    }
  } catch {
    // sessionStorage may be unavailable (private mode) — refresh just won't
    // survive; the in-memory state still works for the active tab.
  }
}

export function loadBudgetSnapshot(): BudgetPlannerSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BudgetPlannerSnapshot;
  } catch {
    return null;
  }
}

export function clearBudgetSnapshot(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore — same reasoning as save
  }
}
