import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Airport, FlightOption } from '@fast-travel/shared';
import { formatPrice } from '../utils/price.utils';
import { countryDisplayName } from '../utils/country.utils';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export interface DirectDestination {
  iata: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  minPriceUsd: number;
  flightCount: number;
}

export function buildDirectDestinations(flights: FlightOption[]): DirectDestination[] {
  const byIata = new Map<string, DirectDestination>();
  for (const f of flights) {
    if (f.stops !== 0) continue;
    if (!Number.isFinite(f.destinationLat) || !Number.isFinite(f.destinationLng)) continue;
    if (f.destinationLat === 0 && f.destinationLng === 0) continue;
    const prev = byIata.get(f.destinationIata);
    if (!prev) {
      byIata.set(f.destinationIata, {
        iata: f.destinationIata,
        city: f.destinationCity,
        country: countryDisplayName(f.destinationCountry) || 'Other',
        lat: f.destinationLat,
        lng: f.destinationLng,
        minPriceUsd: f.priceUsd,
        flightCount: 1,
      });
    } else {
      prev.flightCount += 1;
      if (f.priceUsd < prev.minPriceUsd) prev.minPriceUsd = f.priceUsd;
    }
  }
  return [...byIata.values()];
}

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

function createPricePin(price: string, highlighted: boolean) {
  return L.divIcon({
    html: `
      <div class="flight-fan-pin ${highlighted ? 'flight-fan-pin--hot' : ''}">
        <span>${price}</span>
      </div>
    `,
    className: '',
    iconSize: [52, 26],
    iconAnchor: [26, 13],
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

function computeArc(
  from: [number, number],
  to: [number, number],
  segments = 40,
): [number, number][] {
  const points: [number, number][] = [];
  const [lat1, lng1] = from;
  const [lat2, lng2] = to;
  const midLat = (lat1 + lat2) / 2;
  const midLng = (lng1 + lng2) / 2;
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);
  if (dist === 0) return [from, to];
  const curvature = Math.min(dist * 0.18, 8);
  const perpLat = (-dLng / dist) * curvature;
  const perpLng = (dLat / dist) * curvature;
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

function AutoFit({ coordsKey, bounds }: { coordsKey: string; bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 5 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, coordsKey]);
  return null;
}

function SizeWatcher() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const initial = setTimeout(() => map.invalidateSize({ animate: false }), 50);
    const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    ro.observe(container);
    const onResize = () => map.invalidateSize({ animate: false });
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      clearTimeout(initial);
      ro.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [map]);
  return null;
}

interface Props {
  origin: Airport;
  destinations: DirectDestination[];
  onSelectDestination?: (dest: DirectDestination) => void;
  onConfirmDestination?: (dest: DirectDestination) => void;
}

export function FlightFanMap({ origin, destinations, onSelectDestination, onConfirmDestination }: Props) {
  const cheapest = useMemo(() => {
    if (destinations.length === 0) return null;
    return destinations.reduce((a, b) => (a.minPriceUsd <= b.minPriceUsd ? a : b));
  }, [destinations]);

  const arcs = useMemo(
    () =>
      destinations.map((d) => ({
        path: computeArc([origin.city.lat, origin.city.lng], [d.lat, d.lng]),
        isCheapest: cheapest != null && d.iata === cheapest.iata,
      })),
    [destinations, origin.city.lat, origin.city.lng, cheapest],
  );

  const bounds = useMemo<L.LatLngBoundsExpression | null>(() => {
    if (destinations.length === 0) return null;
    const points: [number, number][] = [[origin.city.lat, origin.city.lng]];
    for (const d of destinations) points.push([d.lat, d.lng]);
    return L.latLngBounds(points);
  }, [origin.city.lat, origin.city.lng, destinations]);

  const coordsKey = useMemo(
    () =>
      `${origin.iata}|` +
      destinations.map((d) => `${d.iata}:${d.lat.toFixed(2)},${d.lng.toFixed(2)}`).join('|'),
    [origin.iata, destinations],
  );

  if (
    origin.city.lat == null ||
    origin.city.lng == null ||
    Number.isNaN(origin.city.lat) ||
    Number.isNaN(origin.city.lng)
  ) {
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
        zoomControl={true}
        attributionControl={false}
        scrollWheelZoom={true}
        doubleClickZoom={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <SizeWatcher />
        <AutoFit coordsKey={coordsKey} bounds={bounds} />

        {arcs.map((arc, i) => (
          <Polyline
            key={`glow-${i}`}
            positions={arc.path}
            pathOptions={{
              color: arc.isCheapest ? '#F97316' : '#4F46E5',
              weight: arc.isCheapest ? 10 : 8,
              opacity: arc.isCheapest ? 0.18 : 0.1,
              lineCap: 'round',
            }}
          />
        ))}
        {arcs.map((arc, i) => (
          <Polyline
            key={`arc-${i}`}
            positions={arc.path}
            pathOptions={{
              color: arc.isCheapest ? '#F97316' : '#3730A3',
              weight: arc.isCheapest ? 3 : 2,
              opacity: arc.isCheapest ? 0.9 : 0.65,
              lineCap: 'round',
            }}
          />
        ))}

        <Marker
          position={[origin.city.lat, origin.city.lng]}
          icon={createOriginIcon()}
          interactive={false}
        />
        <Marker
          position={[origin.city.lat, origin.city.lng]}
          icon={createCityLabel(origin.city.name, true)}
          interactive={false}
        />

        {destinations.map((d) => (
          <Marker
            key={`pin-${d.iata}`}
            position={[d.lat, d.lng]}
            icon={createPricePin(formatPrice(d.minPriceUsd), cheapest?.iata === d.iata)}
            eventHandlers={{
              click: () => onSelectDestination?.(d),
              dblclick: () => onConfirmDestination?.(d),
            }}
          />
        ))}
      </MapContainer>

      <div className="trip-map-attribution">&copy; OpenStreetMap &copy; CARTO</div>

      <div className="trip-map-legend">
        <span className="text-[10px] font-semibold text-indigo">
          Direct routes
          <span className="text-text-muted font-normal"> · {destinations.length} {destinations.length === 1 ? 'destination' : 'destinations'}</span>
        </span>
      </div>
    </div>
  );
}
