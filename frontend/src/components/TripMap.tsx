import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Airport, TripLeg } from '@fast-travel/shared';
import { buildMapData, MapPin } from '../utils/map.utils';
import { formatPrice } from '../utils/price.utils';
import { Plane } from 'lucide-react';

// Fix default leaflet icon
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

/* ── Custom pin icons that match the brand ── */

function createOriginIcon() {
  return L.divIcon({
    html: `
      <div class="trip-map-pin trip-map-pin--origin">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      </div>
    `,
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

function createStopIcon(label: string, isReturn: boolean) {
  const bg = isReturn ? '#F97316' : '#3730A3';
  const ring = isReturn ? 'rgba(249,115,22,0.25)' : 'rgba(55,48,163,0.2)';
  return L.divIcon({
    html: `
      <div class="trip-map-pin trip-map-pin--stop" style="--pin-bg:${bg};--pin-ring:${ring}">
        <span>${isReturn ? '↩' : label}</span>
      </div>
    `,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function createCityLabel(name: string, isOrigin: boolean) {
  return L.divIcon({
    html: `<div class="trip-map-label ${isOrigin ? 'trip-map-label--origin' : ''}">${name}</div>`,
    className: '',
    iconSize: [0, 0],
    iconAnchor: [-22, 12],
  });
}

/* ── Curved arc between two points ── */

function computeArc(from: [number, number], to: [number, number], flipCurve = false, segments = 40): [number, number][] {
  const points: [number, number][] = [];
  const [lat1, lng1] = from;
  const [lat2, lng2] = to;

  const midLat = (lat1 + lat2) / 2;
  const midLng = (lng1 + lng2) / 2;

  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);
  // Return arcs curve more aggressively so they're clearly separate
  const curvature = flipCurve ? Math.min(dist * 0.35, 12) : Math.min(dist * 0.15, 8);

  // Flip the curve direction for return flights so both arcs are visible
  const sign = flipCurve ? -1 : 1;
  const perpLat = sign * (-dLng / dist) * curvature;
  const perpLng = sign * (dLat / dist) * curvature;

  const ctrlLat = midLat + perpLat;
  const ctrlLng = midLng + perpLng;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    const lat = u * u * lat1 + 2 * u * t * ctrlLat + t * t * lat2;
    const lng = u * u * lng1 + 2 * u * t * ctrlLng + t * t * lng2;
    points.push([lat, lng]);
  }
  return points;
}

/* ── Auto-fit bounds ── */

function AutoFit({ pins }: { pins: MapPin[] }) {
  const map = useMap();
  useEffect(() => {
    if (pins.length === 0) return;
    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 6 });
  }, [map, pins]);
  return null;
}

/* ── Route legend overlay ── */

function RouteLegend({ legs }: { origin: Airport; legs: TripLeg[] }) {
  const totalPrice = legs.reduce((sum, l) => sum + l.priceUsd, 0);
  const hasReturn = legs.some((l) => l.isReturn);

  return (
    <div className="trip-map-legend">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-[2.5px] rounded-full" style={{ background: '#3730A3' }} />
          <span className="text-[10px] text-text-muted">outbound</span>
        </span>
        {hasReturn && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-0 border-t-[2.5px] border-dashed rounded-full" style={{ borderColor: '#F97316' }} />
            <span className="text-[10px] text-text-muted">return</span>
          </span>
        )}
        <span className="text-[10px] font-bold text-orange ml-1">{formatPrice(totalPrice)}</span>
      </div>
    </div>
  );
}

/* ── Main map component ── */

interface Props {
  origin: Airport;
  legs: TripLeg[];
}

export function TripMap({ origin, legs }: Props) {
  const { pins, lines } = buildMapData(origin, legs);

  // Pre-compute arcs for all lines (must be before early return — hooks rule)
  const arcs = useMemo(
    () => lines.map((line) => computeArc(line.from, line.to, line.dashed)),
    [lines]
  );

  // Guard: leaflet crashes with undefined/NaN coordinates
  if (origin.city.lat == null || origin.city.lng == null || Number.isNaN(origin.city.lat) || Number.isNaN(origin.city.lng)) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted text-sm">
        Map unavailable — location data missing for {origin.city.name}.
      </div>
    );
  }

  return (
    <div className="trip-map-wrapper">
      <MapContainer
        center={[origin.city.lat, origin.city.lng]}
        zoom={4}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        {/* CartoDB Voyager — clean, travel-appropriate tiles */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <AutoFit pins={pins} />

        {/* Glow underline for arcs (rendered first, behind) */}
        {arcs.map((arc, i) => (
          <Polyline
            key={`glow-${i}`}
            positions={arc}
            pathOptions={{
              color: lines[i].dashed ? '#F97316' : '#4F46E5',
              weight: lines[i].dashed ? 10 : 8,
              opacity: lines[i].dashed ? 0.15 : 0.1,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        ))}

        {/* Curved flight arcs */}
        {arcs.map((arc, i) => (
          <Polyline
            key={`arc-${i}`}
            positions={arc}
            pathOptions={{
              color: lines[i].dashed ? '#F97316' : '#3730A3',
              weight: lines[i].dashed ? 3 : 2.5,
              opacity: lines[i].dashed ? 0.85 : 0.7,
              dashArray: lines[i].dashed ? '10 6' : undefined,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        ))}

        {/* Pin markers */}
        {pins.map((pin, i) => (
          <Marker
            key={`pin-${i}`}
            position={[pin.lat, pin.lng]}
            icon={pin.isOrigin ? createOriginIcon() : createStopIcon(pin.label, pin.isReturn)}
          />
        ))}

        {/* City name labels */}
        {pins.map((pin, i) => (
          <Marker
            key={`label-${i}`}
            position={[pin.lat, pin.lng]}
            icon={createCityLabel(pin.tooltip.split(',')[0], pin.isOrigin)}
            interactive={false}
          />
        ))}
      </MapContainer>

      {/* Attribution — minimal, bottom-right inside map */}
      <div className="trip-map-attribution">
        &copy; OpenStreetMap &copy; CARTO
      </div>

      {/* Route legend overlay */}
      <RouteLegend origin={origin} legs={legs} />
    </div>
  );
}
