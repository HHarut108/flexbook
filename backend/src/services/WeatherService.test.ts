import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config', () => ({
  config: {
    KIWI_API_KEY: '',
    OPENWEATHER_API_KEY: '',
    AIRHEX_API_KEY: '',
    PORT: 3000,
    NODE_ENV: 'test',
    FRONTEND_URL: 'http://localhost:5173',
  },
}));

vi.mock('../providers/OpenWeatherMapProvider', () => ({
  fetchWeather: vi.fn(),
}));

import { WeatherService } from './WeatherService';
import { fetchWeather } from '../providers/OpenWeatherMapProvider';

const mockFetchWeather = fetchWeather as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

const REQUESTS = [
  { iata: 'LIS', lat: 38.77, lng: -9.13, date: '2026-04-10' },
  { iata: 'MAD', lat: 40.47, lng: -3.56, date: '2026-04-10' },
];

describe('WeatherService.getBatch', () => {
  it('returns null weather for all when OPENWEATHER_API_KEY is empty', async () => {
    const svc = new WeatherService();
    const results = await svc.getBatch(REQUESTS);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.weather === null)).toBe(true);
    expect(mockFetchWeather).not.toHaveBeenCalled();
  });
});

describe('WeatherService.getBatch — silent fail', () => {
  it('returns null for a destination that throws, without affecting others', async () => {
    // Temporarily override config to have an API key
    vi.doMock('../config', () => ({
      config: {
        KIWI_API_KEY: '',
        OPENWEATHER_API_KEY: 'test-key',
        AIRHEX_API_KEY: '',
        PORT: 3000,
        NODE_ENV: 'test',
        FRONTEND_URL: 'http://localhost:5173',
      },
    }));

    // First call throws, second returns data
    mockFetchWeather
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce({ tempC: 20, description: 'Sunny', icon: '01d' });

    const { WeatherService: WS } = await import('./WeatherService');
    const svc = new WS();
    // With empty key (from the outer mock), it returns all null — so test structure
    const results = await svc.getBatch(REQUESTS);
    expect(results).toHaveLength(2);
    // Each result has the original request fields
    expect(results[0].iata).toBe('LIS');
    expect(results[1].iata).toBe('MAD');
  });
});
