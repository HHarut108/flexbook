import { WeatherSummary } from '@fast-travel/shared';
import { apiClient, getApiMode } from './client';

export interface WeatherRequest {
  iata: string;
  lat: number;
  lng: number;
  date: string;
}

export interface WeatherResult extends WeatherRequest {
  weather: WeatherSummary | null;
}

export async function batchWeather(destinations: WeatherRequest[]): Promise<WeatherResult[]> {
  const mode = getApiMode();

  const { data } = await apiClient.post<WeatherResult[]>('/weather/batch', {
    destinations,
    apiMode: mode, // Pass the current API mode
  });
  return data;
}
