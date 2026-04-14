import { useEffect } from 'react';
import { FlightOption } from '@fast-travel/shared';
import { batchWeather } from '../api/weather.api';
import { useSessionStore } from '../store/session.store';

export function useWeatherBatch(flights: FlightOption[], date: string) {
  const setWeather = useSessionStore((s) => s.setWeather);

  useEffect(() => {
    if (!flights.length || !date) return;

    const destinations = flights
      .filter((f) => f.destinationLat && f.destinationLng)
      .map((f) => ({
        iata: f.destinationIata,
        lat: f.destinationLat,
        lng: f.destinationLng,
        date,
      }));

    if (!destinations.length) return;

    batchWeather(destinations)
      .then((results) => {
        for (const r of results) {
          if (r.weather) setWeather(r.iata, r.weather);
        }
      })
      .catch(() => {
        // Silent fail — weather is non-critical
      });
  }, [flights, date, setWeather]);
}
