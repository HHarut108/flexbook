import { FlightOption } from '@fast-travel/shared';
import { apiClient } from './client';

export interface BudgetPlanParams {
  originIata: string;
  departureDateFrom: string;
  departureDateTo: string;
  budgetPerPerson: number;
  passengers: number;
  maxStops: number; // 1–15
  nightsPerStop: number;
  nightsPerStopArray?: number[];
  tripStyle: 'value' | 'offpath' | 'sunny' | 'short' | 'visafree';
  excludedDestinations?: string[];
  /** ISO-2 citizenship — required when tripStyle === 'visafree'. */
  passportCode?: string;
}

export interface BudgetPlanLeg extends FlightOption {
  isReturn?: boolean;
}

export interface BudgetPlanResult {
  legs: BudgetPlanLeg[];
  totalCostPerPerson: number;
  budgetPerPerson: number;
}

export async function planBudgetTrip(params: BudgetPlanParams): Promise<BudgetPlanResult> {
  // Budget planning chains up to 4 sequential flight searches — allow 90 s.
  const { data } = await apiClient.post<BudgetPlanResult>('/trips/budget-plan', params, {
    timeout: 90_000,
  });
  return data;
}
