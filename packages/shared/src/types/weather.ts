export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'unknown';

export interface WeatherSummary {
  temperatureC: number;
  condition: WeatherCondition;
  isForecast: boolean;
  date: string; // YYYY-MM-DD
}
