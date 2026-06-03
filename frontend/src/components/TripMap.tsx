import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Airport, TripLeg } from '@fast-travel/shared';
import { buildMapData, MapPin } from '../utils/map.utils';
import { formatPrice } from '../utils/price.utils';

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

function createViaStopIcon(iata: string) {
  return L.divIcon({
    html: `<div class="trip-map-pin trip-map-pin--via"><span>${iata}</span></div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
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
  if (dist === 0) return [from, to];
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
  // Depend on a stringified key so we only refit when coords actually change.
  const coordsKey = pins.map((p) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`).join('|');
  useEffect(() => {
    if (pins.length === 0) return;
    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, coordsKey]);
  return null;
}

/* ── Pinless mode controller ──
 * When the map has no pins (empty state on the When To Go / Trip Planner
 * screens before a route is picked), drive the center imperatively so it
 * can react to async geolocation. MapContainer.center is honoured only on
 * first render, so we use map.setView() here.
 *
 * - centerCoords present → zoom onto the user's location, no pin.
 * - centerCoords null   → render the full world map (zoom 2, lat 20, lng 0).
 */
function PinlessCenter({
  centerCoords,
}: {
  centerCoords: { lat: number; lng: number } | null | undefined;
}) {
  const map = useMap();
  // Depend on the scalar lat/lng so consumers can pass new `{lat, lng}`
  // objects without forcing a re-pan when the actual coordinates didn't change.
  const lat = centerCoords?.lat;
  const lng = centerCoords?.lng;
  useEffect(() => {
    if (lat != null && lng != null) {
      map.setView([lat, lng], 5, { animate: false });
    } else {
      map.setView([20, 0], 2, { animate: false });
    }
  }, [map, lat, lng]);
  return null;
}

/* ── Keep Leaflet in sync with container size ──
 *
 * Without this, tiles render gray / misaligned whenever the wrapper resizes
 * after mount: window resize, sticky sidebar settling, fonts loading,
 * tab visibility flip, mobile rotation. invalidateSize() forces a re-layout. */

function SizeWatcher() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    // Initial nudge — covers the case where the map mounted while the parent
    // was still being sized (e.g. inside a Suspense boundary that just resolved
    // or a sticky sidebar that hasn't laid out yet).
    const initial = setTimeout(() => map.invalidateSize({ animate: false }), 50);

    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    ro.observe(container);

    const onWinResize = () => map.invalidateSize({ animate: false });
    window.addEventListener('resize', onWinResize);
    window.addEventListener('orientationchange', onWinResize);

    return () => {
      clearTimeout(initial);
      ro.disconnect();
      window.removeEventListener('resize', onWinResize);
      window.removeEventListener('orientationchange', onWinResize);
    };
  }, [map]);
  return null;
}

/* ── Route legend overlay (line-type swatches only) ── */

function RouteLegend({ legs }: { origin: Airport; legs: TripLeg[] }) {
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
      </div>
    </div>
  );
}

/* ── Trip-total pill (separate corner, clearly labelled) ── */

function TripTotalPill({ legs }: { legs: TripLeg[] }) {
  const totalPrice = legs.reduce((sum, l) => sum + l.priceUsd, 0);
  if (totalPrice <= 0) return null;
  return (
    <div className="trip-map-total">
      <span className="trip-map-total__label">Trip total</span>
      <span className="trip-map-total__amount">{formatPrice(totalPrice)}</span>
    </div>
  );
}

/* ── Main map component ── */

interface Props {
  /** Anchor airport. Renders the origin pin + label and is the source for
   *  AutoFit. Pass `null` for the empty-state map (no route picked yet) —
   *  the map will then use `centerCoords` for its initial view, or fall
   *  back to a full world map. */
  origin: Airport | null;
  legs: TripLeg[];
  /** Optional coordinates used when `origin` is null. Lets the screen show
   *  the user's resolved geolocation as the map center even before we've
   *  identified their nearest commercial airport. */
  centerCoords?: { lat: number; lng: number } | null;
}

export function TripMap({ origin, legs, centerCoords }: Props) {
  // Memoize so AutoFit / arc useMemo don't refire on every parent render.
  // When origin is null we build an empty payload — the PinlessCenter
  // controller below takes over to position the map.
  const { pins, lines } = useMemo(
    () => (origin ? buildMapData(origin, legs) : { pins: [], lines: [] }),
    [origin, legs],
  );

  // Pre-compute arcs for all lines (must be before early return — hooks rule)
  const arcs = useMemo(
    () => lines.map((line) => computeArc(line.from, line.to, line.dashed)),
    [lines]
  );

  // Guard: leaflet crashes with undefined/NaN coordinates when an origin is
  // passed in. Empty-state (origin null) always renders — the controller
  // either pans to centerCoords or to the full world.
  if (origin && (origin.city.lat == null || origin.city.lng == null || Number.isNaN(origin.city.lat) || Number.isNaN(origin.city.lng))) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted text-sm">
        Map unavailable — location data missing for {origin.city.name}.
      </div>
    );
  }

  // Initial center — meaningful only on first render. Subsequent updates
  // run through AutoFit (when pins exist) or PinlessCenter (when they don't).
  const initialCenter: [number, number] = origin
    ? [origin.city.lat, origin.city.lng]
    : centerCoords
      ? [centerCoords.lat, centerCoords.lng]
      : [20, 0];
  const initialZoom = origin ? 4 : centerCoords ? 5 : 2;

  return (
    <div className="trip-map-wrapper">
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        minZoom={2}
        maxZoom={8}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={true}
        worldCopyJump={false}
        maxBounds={[[-85, -180], [85, 180]]}
        maxBoundsViscosity={1}
      >
        {/* CartoDB Voyager — clean, travel-appropriate tiles */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <SizeWatcher />
        {pins.length > 0
          ? <AutoFit pins={pins} />
          : <PinlessCenter centerCoords={centerCoords} />}
        <ZoomControl position="topright" />

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
            icon={
              pin.isOrigin
                ? createOriginIcon()
                : pin.isViaStop
                  ? createViaStopIcon(pin.label)
                  : createStopIcon(pin.label, pin.isReturn)
            }
          />
        ))}

        {/* City name labels — skip via stop labels to avoid clutter */}
        {pins.filter((pin) => !pin.isViaStop).map((pin, i) => (
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

      {/* Route legend overlay (line-types only) — skip in empty-state map
          where there's no origin and no legs to legend. */}
      {origin && <RouteLegend origin={origin} legs={legs} />}

      {/* Trip total — separate corner so it doesn't read as "return = $X" */}
      <TripTotalPill legs={legs} />
    </div>
  );
}
