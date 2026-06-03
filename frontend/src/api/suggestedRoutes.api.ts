import { Airport } from '@fast-travel/shared';
import { apiClient, getApiMode } from './client';
import { mockAirports } from './mock-data';

export interface SuggestedRoute {
  from: Airport;
  to: Airport;
  tagline: string;
  source: 'analytics' | 'curated';
}

export interface SuggestedRoutesResponse {
  origin: Airport;
  routes: SuggestedRoute[];
}

export async function fetchSuggestedRoutes(
  fromIata: string,
  limit = 3,
  signal?: AbortSignal,
): Promise<SuggestedRoutesResponse> {
  const mode = getApiMode();

  if (mode === 'mock') {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const origin =
      mockAirports.find((a) => a.iata === fromIata) ?? mockAirports[0];
    const routes: SuggestedRoute[] = mockAirports
      .filter((a) => a.iata !== origin.iata)
      .slice(0, limit)
      .map((to) => ({ from: origin, to, tagline: 'Popular right now', source: 'curated' }));
    return { origin, routes };
  }

  const { data } = await apiClient.get<SuggestedRoutesResponse>('/suggested-routes', {
    params: { from: fromIata, limit },
    signal,
  });
  return data;
}
