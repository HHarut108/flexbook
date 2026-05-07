import { getAirlineLogoUrl } from '../data/airlineLogos';

function normalizeAirlineCode(code: string) {
  return code.trim().toUpperCase();
}

export class AirlineLogoService {
  async getLogos(codes: string[], _height = 48, _apiMode?: 'real' | 'mock'): Promise<Record<string, string>> {
    const normalizedCodes = Array.from(
      new Set(codes.map(normalizeAirlineCode).filter((code) => code.length >= 2 && code.length <= 3)),
    );

    if (normalizedCodes.length === 0) {
      return {};
    }

    return Object.fromEntries(normalizedCodes.map((code) => [code, getAirlineLogoUrl(code)]));
  }
}

export const airlineLogoService = new AirlineLogoService();
