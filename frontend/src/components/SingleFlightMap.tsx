import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * SingleFlightMap — compact preview for one itinerary on the When To Go
 * result card. Renders origin → optional via-stops → destination with curved
 * arcs and lightweight pins. Borrows the visual primitives from TripMap
 * (CSS classes, arc maths) but doesn't depend on the trip-store data shape.
 */

interface ViaStop {
  iata: string;
  lat: number;
  lng: number;
}

interface Endpoint {
  iata: string;
  city: string;
  lat: number;
  lng: number;
}

interface Props {
  origin: Endpoint;
  destination: Endpoint;
  via?: ViaStop[];
  /** Height in CSS units. Defaults to a card-sized 280px. */
  height?: string;
}

function originIcon() {
  return L.divIcon({
    html: `<div class="trip-map-pin trip-map-pin--origin">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg></div>`,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function destinationIcon(iata: string) {
  return L.divIcon({
    html: `<div class="trip-map-pin trip-map-pin--stop" style="--pin-bg:#3730A3;--pin-ring:rgba(55,48,163,0.2)"><span>${iata}</span></div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function viaIcon(iata: string) {
  return L.divIcon({
    html: `<div class="trip-map-pin trip-map-pin--via"><span>${iata}</span></div>`,
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

/* Curved-arc helper. Same recipe as TripMap.computeArc, simplified. */
function arc(from: [number, number], to: [number, number], segments = 40): [number, number][] {
  const [lat1, lng1] = from;
  const [lat2, lng2] = to;
  const midLat = (lat1 + lat2) / 2;
  const midLng = (lng1 + lng2) / 2;
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);
  if (dist === 0) return [from, to];
  const curveHeight = dist * 0.15;
  // Perpendicular offset.
  const ctrlLat = midLat + (-dLng / dist) * curveHeight;
  const ctrlLng = midLng + (dLat / dist) * curveHeight;

  const points: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * ctrlLat + t * t * lat2;
    const lng = (1 - t) * (1 - t) * lng1 + 2 * (1 - t) * t * ctrlLng + t * t * lng2;
    points.push([lat, lng]);
  }
  return points;
}

function AutoFit({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
  }, [points, map]);
  return null;
}

export function SingleFlightMap({ origin, destination, via = [], height = '280px' }: Props) {
  const waypoints: [number, number][] = useMemo(
    () => [
      [origin.lat, origin.lng],
      ...via.map((v) => [v.lat, v.lng] as [number, number]),
      [destination.lat, destination.lng],
    ],
    [origin, destination, via],
  );

  const arcs = useMemo(() => {
    const out: [number, number][][] = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      out.push(arc(waypoints[i], waypoints[i + 1]));
    }
    return out;
  }, [waypoints]);

  // Guard against bad coords (Kiwi occasionally returns 0,0 — we'd rather
  // tell the user the map is unavailable than render a dot in the Atlantic).
  const hasCoords =
    Number.isFinite(origin.lat) && Number.isFinite(origin.lng) &&
    Number.isFinite(destination.lat) && Number.isFinite(destination.lng) &&
    !(origin.lat === 0 && origin.lng === 0) &&
    !(destination.lat === 0 && destination.lng === 0);

  if (!hasCoords) {
    return (
      <div
        className="rounded-2xl border border-border bg-surface-2 flex items-center justify-center text-xs text-text-muted"
        style={{ height }}
      >
        Map unavailable — coordinates missing.
      </div>
    );
  }

  return (
    <div className="trip-map-wrapper rounded-2xl overflow-hidden border border-border" style={{ height }}>
      <MapContainer
        center={[(origin.lat + destination.lat) / 2, (origin.lng + destination.lng) / 2]}
        zoom={3}
        minZoom={2}
        maxZoom={8}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={false}
        worldCopyJump={false}
        maxBounds={[[-85, -180], [85, 180]]}
        maxBoundsViscosity={1}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; OSM &copy; CARTO'
        />
        <AutoFit points={waypoints} />
        <ZoomControl position="bottomright" />

        {arcs.map((points, i) => (
          <Polyline
            key={i}
            positions={points}
            pathOptions={{ color: '#3730A3', weight: 2.5, opacity: 0.85 }}
          />
        ))}

        <Marker position={[origin.lat, origin.lng]} icon={originIcon()} />
        {via.map((v) => (
          <Marker key={v.iata} position={[v.lat, v.lng]} icon={viaIcon(v.iata)} />
        ))}
        <Marker
          position={[destination.lat, destination.lng]}
          icon={destinationIcon(destination.iata)}
        />
      </MapContainer>
    </div>
  );
}
