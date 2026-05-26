import { FlightOption } from '@fast-travel/shared';
import { apiClient } from './client';

export interface BudgetPlanParams {
  originIata: string;
  departureDateFrom: string;
  departureDateTo: string;
  budgetPerPerson: number;
  passengers: number;
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
  // apiClient interceptor already unwraps { success, data } → inner payload
  const { data } = await apiClient.post<BudgetPlanResult>('/trips/budget-plan', params);
  return data;
}
