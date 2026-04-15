import { WeatherCondition, WeatherSummary } from '@fast-travel/shared';
import { fetchWeather } from '../providers/OpenWeatherMapProvider';
import { getCache, setCache } from '../utils/cache';
import { config } from '../config';

interface WeatherRequest {
  iata: string;
  lat: number;
  lng: number;
  date: string;
}

interface WeatherResult extends WeatherRequest {
  weather: WeatherSummary | null;
}

function generateMockWeather(date: string): WeatherSummary {
  const conditions: WeatherCondition[] = ['clear', 'cloudy', 'rain', 'snow', 'storm', 'unknown'];
  const temperatureC = Math.round(Math.random() * 25 + 10); // 10–35°C

  return {
    temperatureC,
    condition: conditions[Math.floor(Math.random() * conditions.length)],
    isForecast: false,
    date,
  };
}

export class WeatherService {
  async getBatch(requests: WeatherRequest[], apiMode?: 'real' | 'mock'): Promise<WeatherResult[]> {
    // If apiMode is explicitly set to 'mock', return mock data
    if (apiMode === 'mock') {
      return requests.map((r) => ({
        ...r,
        weather: generateMockWeather(r.date),
      }));
    }

    if (!config.OPENWEATHER_API_KEY) {
      return requests.map((r) => ({ ...r, weather: null }));
    }

    const results = await Promise.allSettled(
      requests.map(async (req) => {
        const cacheKey = `weather:${req.iata}:${req.date}`;
        const cached = getCache<WeatherSummary>(cacheKey);
        if (cached) return { ...req, weather: cached };

        const weather = await fetchWeather(req.lat, req.lng, req.date);
        setCache(cacheKey, weather, 3600); // 1-hour TTL for weather
        return { ...req, weather };
      }),
    );

    return results.map((result, i) => {
      if (result.status === 'fulfilled') return result.value;
      return { ...requests[i], weather: null }; // silent fail
    });
  }
}

export const weatherService = new WeatherService();
