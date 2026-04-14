import { apiClient, getApiMode } from './client';
import { mockAirlines } from './mock-data';

export async function fetchAirlineLogos(
  codes: string[],
  height = 48,
): Promise<Record<string, string>> {
  const uniqueCodes = Array.from(
    new Set(codes.map((code) => code.trim().toUpperCase()).filter((code) => code.length >= 2 && code.length <= 3)),
  );

  if (uniqueCodes.length === 0) {
    return {};
  }

  const mode = getApiMode();

  const { data } = await apiClient.get<Record<string, string>>('/airlines/logos', {
    params: {
      codes: uniqueCodes.join(','),
      height,
      apiMode: mode, // Pass the current API mode
    },
  });

  return data;
}
