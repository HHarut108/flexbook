import { Itinerary } from './trip';

export interface AssistanceRequest {
  id: string;
  itinerary: Itinerary;
  tripSlug: string;
  requestedAt: string; // ISO 8601
}
