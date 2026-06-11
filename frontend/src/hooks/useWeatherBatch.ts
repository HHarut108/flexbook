import { useEffect } from 'react';
import { FlightOption } from '@fast-travel/shared';
import { batchWeather } from '../api/weather.api';
import { useSessionStore } from '../store/session.store';

/** Backend cap on the `/weather/batch` destinations array — keep in sync
 *  with backend/src/routes/weather.ts `batchBodySchema.array(...).max(10)`. */
const BACKEND_BATCH_LIMIT = 10;

export function useWeatherBatch(flights: FlightOption[], date: string) {
  const setWeather = useSessionStore((s) => s.setWeather);

  useEffect(() => {
    if (!flights.length || !date) return;

    // Dedupe by destination IATA before we count — flight result sets are
    // usually multiple flights to the same handful of cities, and the
    // weather lookup is per-city, not per-flight.
    const seen = new Set<string>();
    const allDestinations = flights
      .filter((f) => f.destinationLat && f.destinationLng)
      .filter((f) => {
        if (seen.has(f.destinationIata)) return false;
        seen.add(f.destinationIata);
        return true;
      })
      .map((f) => ({
        iata: f.destinationIata,
        lat: f.destinationLat,
        lng: f.destinationLng,
        date,
      }));

    if (!allDestinations.length) return;

    // Backend rejects payloads with more than 10 destinations (returns 400).
    // Slice to the first N — they're already in the order the screen
    // prioritises (cheapest first), so the user sees weather on the
    // results most likely to matter.
    const destinations = allDestinations.slice(0, BACKEND_BATCH_LIMIT);

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
