import { WeatherSummary } from '@fast-travel/shared';
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

function generateMockWeather(): WeatherSummary {
  const descriptions = ['Sunny', 'Cloudy', 'Partly Cloudy', 'Rainy', 'Windy', 'Clear'];
  const temperature = Math.round(Math.random() * 40 + 50); // Between 50-90°F
  const humidity = Math.round(Math.random() * 50 + 40); // Between 40-90%
  const windSpeed = Math.round(Math.random() * 25 + 5); // Between 5-30 mph

  return {
    temperature,
    description: descriptions[Math.floor(Math.random() * descriptions.length)],
    humidity,
    windSpeed,
    feelsLike: Math.max(temperature - Math.round(Math.random() * 5), 40),
  };
}

export class WeatherService {
  async getBatch(requests: WeatherRequest[], apiMode?: 'real' | 'mock'): Promise<WeatherResult[]> {
    // If apiMode is explicitly set to 'mock', return mock data
    if (apiMode === 'mock') {
      return requests.map((r) => ({
        ...r,
        weather: generateMockWeather(),
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
