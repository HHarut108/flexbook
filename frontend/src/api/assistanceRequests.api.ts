import { TripLeg } from '@fast-travel/shared';
import { apiClient } from './client';

export interface AssistanceRequestPayload {
  fullName: string;
  email: string;
  phone: string;
  tripData: {
    origin?: string;
    cities: string[];
    totalPrice: number;
    legs: TripLeg[];
  };
}

export async function submitAssistanceRequest(payload: AssistanceRequestPayload): Promise<{ id: string; tripSlug?: string }> {
  const { data } = await apiClient.post<{ id: string; tripSlug?: string }>('/assistance-requests', payload);
  return data;
}
