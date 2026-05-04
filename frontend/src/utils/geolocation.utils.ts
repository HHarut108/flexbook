export interface Coords {
  lat: number;
  lng: number;
}

const COORDS_CACHE_KEY = 'fta_coords_v1';
const NEARBY_CACHE_KEY = 'fta_nearby_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function readCachedCoords(): Coords | null {
  try {
    const raw = localStorage.getItem(COORDS_CACHE_KEY);
    if (!raw) return null;
    const { lat, lng, ts } = JSON.parse(raw) as { lat: number; lng: number; ts: number };
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

function cacheCoords(coords: Coords): void {
  try {
    localStorage.setItem(COORDS_CACHE_KEY, JSON.stringify({ ...coords, ts: Date.now() }));
  } catch {
    // localStorage unavailable (e.g. private browsing quota exceeded)
  }
}

export function getBrowserCoords(timeoutMs = 5000): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: timeoutMs },
    );
  });
}

export async function getIpCoords(): Promise<Coords> {
  const res = await fetch('https://ipapi.co/json/');
  if (!res.ok) throw new Error(`IP geolocation failed: ${res.status}`);
  const data = (await res.json()) as { latitude?: number; longitude?: number };
  if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
    throw new Error('IP geolocation returned no coordinates');
  }
  return { lat: data.latitude, lng: data.longitude };
}

export function readCachedNearby<T>(lat: number, lng: number): T[] | null {
  try {
    const raw = localStorage.getItem(NEARBY_CACHE_KEY);
    if (!raw) return null;
    const { lat: cachedLat, lng: cachedLng, airports, ts } = JSON.parse(raw) as {
      lat: number; lng: number; airports: T[]; ts: number;
    };
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    // Treat as same location if within ~1 km (≈0.01°)
    if (Math.abs(cachedLat - lat) > 0.01 || Math.abs(cachedLng - lng) > 0.01) return null;
    return airports;
  } catch {
    return null;
  }
}

export function cacheNearby<T>(lat: number, lng: number, airports: T[]): void {
  try {
    localStorage.setItem(NEARBY_CACHE_KEY, JSON.stringify({ lat, lng, airports, ts: Date.now() }));
  } catch {
    // localStorage unavailable
  }
}

export async function resolveUserCoords(): Promise<Coords> {
  // Return immediately if we have a fresh cached result (repeat visits)
  const cached = readCachedCoords();
  if (cached) return cached;

  // Race browser geo against IP lookup — first to resolve wins.
  // Promise.any rejects only if both fail (throws AggregateError).
  const coords = await Promise.any([getBrowserCoords(), getIpCoords()]);
  cacheCoords(coords);
  return coords;
}
