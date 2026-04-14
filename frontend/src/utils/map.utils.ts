import { TripLeg } from '@fast-travel/shared';
import { Airport } from '@fast-travel/shared';

export interface MapPin {
  lat: number;
  lng: number;
  label: string;
  tooltip: string;
  isOrigin: boolean;
  isReturn: boolean;
}

export interface MapLine {
  from: [number, number];
  to: [number, number];
  dashed: boolean;
}

function hasCoords(lat: number | undefined, lng: number | undefined): boolean {
  return lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);
}

export function buildMapData(origin: Airport, legs: TripLeg[]): { pins: MapPin[]; lines: MapLine[] } {
  const pins: MapPin[] = [];
  const lines: MapLine[] = [];

  if (!hasCoords(origin.city.lat, origin.city.lng)) return { pins, lines };

  const originLat = origin.city.lat;
  const originLng = origin.city.lng;

  pins.push({
    lat: originLat,
    lng: originLng,
    label: '★',
    tooltip: `${origin.city.name} (origin)`,
    isOrigin: true,
    isReturn: false,
  });

  let prevLat = originLat;
  let prevLng = originLng;

  for (const leg of legs) {
    // Return legs fly back to origin — use origin coords when destination matches origin
    // or when the leg has placeholder 0,0 coordinates
    const isReturnToOrigin = leg.isReturn && (
      leg.destinationIata === origin.iata ||
      (leg.destinationLat === 0 && leg.destinationLng === 0) ||
      !hasCoords(leg.destinationLat, leg.destinationLng)
    );
    const destLat = isReturnToOrigin ? originLat : leg.destinationLat;
    const destLng = isReturnToOrigin ? originLng : leg.destinationLng;

    if (!hasCoords(destLat, destLng)) continue;

    lines.push({
      from: [prevLat, prevLng],
      to: [destLat, destLng],
      dashed: leg.isReturn,
    });

    // Don't add a duplicate pin at origin for return legs
    if (!isReturnToOrigin) {
      pins.push({
        lat: destLat,
        lng: destLng,
        label: String(leg.stopIndex),
        tooltip: `${leg.destinationCity}, ${leg.destinationCountry}`,
        isOrigin: false,
        isReturn: leg.isReturn,
      });
    }

    prevLat = destLat;
    prevLng = destLng;
  }

  return { pins, lines };
}
