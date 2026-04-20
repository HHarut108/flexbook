export interface Coords {
  lat: number;
  lng: number;
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

export async function resolveUserCoords(): Promise<Coords> {
  try {
    return await getBrowserCoords();
  } catch {
    return await getIpCoords();
  }
}
