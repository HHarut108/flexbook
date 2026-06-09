/** Per-trip Booking Concierge state.
 *
 *  The user lands on /book/concierge/:tripId and works through their multi-city
 *  itinerary one leg at a time. Each leg is its own Kiwi ticket — we open the
 *  per-leg deep link in a new tab, the user completes checkout on Kiwi, comes
 *  back to Flexbook, and marks the leg booked (or skipped, or "not yet"). They
 *  can leave and resume later; status survives reloads in the same browser
 *  session via sessionStorage.
 *
 *  We deliberately do NOT trust the user's "yes I booked it" claim as a real
 *  booking record — there's no Kiwi callback. It's just the user's own checklist
 *  marker so the UI knows where to focus next. Treat it like a kanban "done"
 *  column the user moves cards into themselves.
 */
export type LegBookingStatus = 'pending' | 'booked' | 'skipped';

export interface ConciergeState {
  /** Per-leg status, parallel to SelectedTrip.flights. */
  statuses: LegBookingStatus[];
}

const STORAGE_PREFIX = 'flexbook.concierge.';

export function initialConciergeState(legCount: number): ConciergeState {
  return {
    statuses: Array.from({ length: legCount }, () => 'pending' as LegBookingStatus),
  };
}

export function loadConciergeState(tripId: string, legCount: number): ConciergeState {
  if (typeof window === 'undefined') return initialConciergeState(legCount);
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + tripId);
    if (!raw) return initialConciergeState(legCount);
    const parsed = JSON.parse(raw) as Partial<ConciergeState>;
    if (
      !parsed ||
      !Array.isArray(parsed.statuses) ||
      parsed.statuses.length !== legCount
    ) {
      // Schema drift (e.g. trip mutated between sessions) — start fresh rather
      // than show inconsistent progress.
      return initialConciergeState(legCount);
    }
    // Coerce any unknown status values back to 'pending' to be defensive.
    const statuses = parsed.statuses.map((s) =>
      s === 'booked' || s === 'skipped' ? s : 'pending',
    ) as LegBookingStatus[];
    return { statuses };
  } catch {
    return initialConciergeState(legCount);
  }
}

export function saveConciergeState(tripId: string, state: ConciergeState): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + tripId, JSON.stringify(state));
  } catch {
    // Storage full / private mode — fall through silently. The in-memory state
    // still drives the current page; we just lose resume-after-reload.
  }
}

/** Index of the leg the user should focus on next, or -1 when every leg is in
 *  a terminal state (booked or skipped). */
export function currentLegIndex(state: ConciergeState): number {
  return state.statuses.findIndex((s) => s === 'pending');
}

export function bookedCount(state: ConciergeState): number {
  return state.statuses.filter((s) => s === 'booked').length;
}

export function skippedCount(state: ConciergeState): number {
  return state.statuses.filter((s) => s === 'skipped').length;
}

export function isComplete(state: ConciergeState): boolean {
  return state.statuses.every((s) => s !== 'pending');
}
