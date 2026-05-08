import { Itinerary } from '@fast-travel/shared';
import { apiClient } from './client';

export async function submitAssistanceRequest(itinerary: Itinerary): Promise<{ id: string; tripSlug: string }> {
  const { data } = await apiClient.post<{ id: string; tripSlug: string }>('/assistance-requests', itinerary);
  return data;
}
