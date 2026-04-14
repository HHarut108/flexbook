import axios from 'axios';
import { config } from '../config';
import { getCache, setCache } from '../utils/cache';

interface AirhexLogoVariant {
  url: string;
}

interface AirhexLogoEntry {
  iata?: string;
  icao?: string;
  png?: {
    light?: {
      rectangular?: AirhexLogoVariant;
      square?: AirhexLogoVariant;
    };
  };
}

interface AirhexLogoResponse {
  data: AirhexLogoEntry[];
}

function normalizeAirlineCode(code: string) {
  return code.trim().toUpperCase();
}

function pickLogoUrl(entry: AirhexLogoEntry) {
  return entry.png?.light?.rectangular?.url ?? entry.png?.light?.square?.url ?? null;
}

const MOCK_AIRLINES_LOGOS: Record<string, string> = {
  'FR': 'https://via.placeholder.com/50?text=Ryanair',
  'U2': 'https://via.placeholder.com/50?text=EasyJet',
  'VY': 'https://via.placeholder.com/50?text=Vueling',
  'W6': 'https://via.placeholder.com/50?text=WizzAir',
  'DY': 'https://via.placeholder.com/50?text=Norwegian',
  'IB': 'https://via.placeholder.com/50?text=Iberia',
  'BA': 'https://via.placeholder.com/50?text=British',
  'AA': 'https://via.placeholder.com/50?text=American',
  'SW': 'https://via.placeholder.com/50?text=Southwest',
};

export class AirlineLogoService {
  async getLogos(codes: string[], height = 48, apiMode?: 'real' | 'mock'): Promise<Record<string, string>> {
    const normalizedCodes = Array.from(
      new Set(codes.map(normalizeAirlineCode).filter((code) => code.length >= 2 && code.length <= 3)),
    );

    if (normalizedCodes.length === 0) {
      return {};
    }

    // If apiMode is explicitly set to 'mock', return mock data
    if (apiMode === 'mock') {
      const result: Record<string, string> = {};
      normalizedCodes.forEach((code) => {
        if (MOCK_AIRLINES_LOGOS[code]) {
          result[code] = MOCK_AIRLINES_LOGOS[code];
        }
      });
      return result;
    }

    if (!config.AIRHEX_API_KEY) {
      return {};
    }

    const logos: Record<string, string> = {};

    await Promise.allSettled(
      normalizedCodes.map(async (code) => {
        const cacheKey = `airhex:logo:${height}:${code}`;
        const cached = getCache<string>(cacheKey);
        if (cached) {
          logos[code] = cached;
          return;
        }

        const { data } = await axios.get<AirhexLogoResponse>('https://api.airhex.com/v1/logos', {
          params: { codes: code, height },
          headers: { Authorization: `Bearer ${config.AIRHEX_API_KEY}` },
          timeout: 15000,
        });

        for (const entry of data.data) {
          const logoUrl = pickLogoUrl(entry);
          if (!logoUrl) continue;

          const iata = entry.iata ? normalizeAirlineCode(entry.iata) : null;
          const icao = entry.icao ? normalizeAirlineCode(entry.icao) : null;

          if (code === iata || code === icao) {
            logos[code] = logoUrl;
            setCache(cacheKey, logoUrl, 60 * 60 * 24);
            return;
          }
        }
      }),
    );

    return logos;
  }
}

export const airlineLogoService = new AirlineLogoService();
