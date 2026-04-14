import { WeatherCondition, WeatherSummary } from '@fast-travel/shared';
import axios from 'axios';
import { config } from '../config';

interface OWMForecastItem {
  dt: number;
  main: { temp: number };
  weather: Array<{ id: number; description: string }>;
}

interface OWMForecastResponse {
  list: OWMForecastItem[];
}

function mapCondition(weatherId: number): WeatherCondition {
  if (weatherId >= 200 && weatherId < 300) return 'storm';
  if (weatherId >= 300 && weatherId < 600) return 'rain';
  if (weatherId >= 600 && weatherId < 700) return 'snow';
  if (weatherId >= 800 && weatherId < 801) return 'clear';
  if (weatherId >= 801 && weatherId < 900) return 'cloudy';
  return 'unknown';
}

export async function fetchWeather(
  lat: number,
  lng: number,
  date: string,
): Promise<WeatherSummary> {
  const targetTime = new Date(date).getTime();
  const now = Date.now();
  const daysDiff = (targetTime - now) / (1000 * 60 * 60 * 24);

  // 5-day / 3-hour forecast — only useful within 5 days
  if (daysDiff <= 5) {
    const { data: response } = await axios.get<OWMForecastResponse>(
      'https://api.openweathermap.org/data/2.5/forecast',
      { params: { lat, lon: lng, appid: config.OPENWEATHER_API_KEY, units: 'metric', cnt: 40 } },
    );

    // Find the forecast item closest to noon on the target date
    const noonTarget = new Date(`${date}T12:00:00Z`).getTime();
    const best = response.list.reduce(
      (prev: OWMForecastItem, curr: OWMForecastItem) =>
        Math.abs(curr.dt * 1000 - noonTarget) < Math.abs(prev.dt * 1000 - noonTarget) ? curr : prev,
    );

    return {
      temperatureC: Math.round(best.main.temp),
      condition: mapCondition(best.weather[0]?.id ?? 800),
      isForecast: true,
      date,
    };
  }

  // For dates beyond 5 days, use current weather as a rough proxy
  const { data: response } = await axios.get<{ main: { temp: number }; weather: Array<{ id: number }> }>(
    'https://api.openweathermap.org/data/2.5/weather',
    { params: { lat, lon: lng, appid: config.OPENWEATHER_API_KEY, units: 'metric' } },
  );

  return {
    temperatureC: Math.round(response.main.temp),
    condition: mapCondition(response.weather[0]?.id ?? 800),
    isForecast: false,
    date,
  };
}
