import { Airport } from '@fast-travel/shared';
import { apiClient, getApiMode } from './client';
import { mockAirports } from './mock-data';

export async function searchAirports(q: string): Promise<Airport[]> {
  const mode = getApiMode();

  if (mode === 'mock') {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return mockAirports.filter(
      (airport) =>
        airport.name.toLowerCase().includes(q.toLowerCase()) ||
        airport.city.name.toLowerCase().includes(q.toLowerCase()) ||
        airport.iata.toLowerCase().includes(q.toLowerCase()),
    );
  }

  const { data } = await apiClient.get<Airport[]>('/airports/search', { params: { q } });
  return data;
}

export async function nearbyAirports(iata: string): Promise<Airport[]> {
  const mode = getApiMode();

  if (mode === 'mock') {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return mockAirports.filter((airport) => airport.iata !== iata).slice(0, 3);
  }

  const { data } = await apiClient.get<Airport[]>('/airports/nearby', { params: { iata } });
  return data;
}

export async function nearbyAirportsByCoords(lat: number, lng: number): Promise<Airport[]> {
  const mode = getApiMode();

  if (mode === 'mock') {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return mockAirports.slice(0, 3);
  }

  const { data } = await apiClient.get<Airport[]>('/airports/nearby-coords', {
    params: { lat, lng },
  });
  return data;
}
