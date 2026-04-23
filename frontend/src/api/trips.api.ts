import { Itinerary } from '@fast-travel/shared';
import { apiClient } from './client';

export async function createTripShare(itinerary: Itinerary): Promise<string> {
  const { data } = await apiClient.post<{ id: string }>('/trips', itinerary);
  return data.id;
}

export async function fetchTripShare(id: string): Promise<Itinerary | null> {
  try {
    const { data } = await apiClient.get<Itinerary>(`/trips/${id}`);
    return data;
  } catch {
    return null;
  }
}
