import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocationSelection, selectionCoords, selectionName, selectionId } from '@fast-travel/shared';

// CARTO Voyager — colourful travel-appropriate tiles. Dark mode renders the
// same tiles with an invert+desaturate filter (see `.map-dark` in index.css)
// rather than swapping to Dark Matter, which let us tune contrast precisely.
const TILE_URL_LIGHT = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '&copy; OpenStreetMap contributors &copy; CARTO';

/**
 * Subscribes to the `data-theme` attribute on <html> so the map can swap
 * tile providers when the user toggles dark mode without remounting Leaflet.
 */
function useTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  });
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    });
    observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

/**
 * Quadratic-bezier arc between two map coords. Same curvature math as
 * TripMap.tsx:69-99 so the preview map renders flight paths with the
 * same gentle curve V1 production uses. `flipCurve` is used for return
 * legs so both arcs of a round trip remain visible.
 */
function computeArc(
  from: [number, number],
  to: [number, number],
  flipCurve = false,
  segments = 40,
): [number, number][] {
  const [lat1, lng1] = from;
  const [lat2, lng2] = to;
  const midLat = (lat1 + lat2) / 2;
  const midLng = (lng1 + lng2) / 2;
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);
  if (dist === 0) return [from, to];
  const curvature = flipCurve ? Math.min(dist * 0.35, 12) : Math.min(dist * 0.15, 8);
  const sign = flipCurve ? -1 : 1;
  const perpLat = sign * (-dLng / dist) * curvature;
  const perpLng = sign * (dLat / dist) * curvature;
  const ctrlLat = midLat + perpLat;
  const ctrlLng = midLng + perpLng;
  const points: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    const lat = u * u * lat1 + 2 * u * t * ctrlLat + t * t * lat2;
    const lng = u * u * lng1 + 2 * u * t * ctrlLng + t * t * lng2;
    points.push([lat, lng]);
  }
  return points;
}

function pin(color: string, label: string) {
  return L.divIcon({
    html: `
      <div style="
        width: 32px; height: 32px; border-radius: 50%;
        background: ${color}; color: white; font-weight: 800; font-size: 12px;
        display: flex; align-items: center; justify-content: center;
        border: 3px solid white; box-shadow: 0 6px 16px rgba(15,23,42,0.25);
      ">${label}</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

export interface MapLeg {
  from: LocationSelection;
  to: LocationSelection;
}

interface Props {
  /** Single-route preview (used by Quick Search one-way/return + others). */
  origin?: LocationSelection | null;
  destination?: LocationSelection | null;
  stops?: LocationSelection[];
  /** Multi-leg preview (Quick Search multi-city). When provided, takes
   *  precedence: every leg gets its own dashed polyline + markers. */
  legs?: MapLeg[];
  /** Fallback coords used when nothing else is on the map — drops a small
   *  "You are here" marker so the canvas isn't empty before the user picks
   *  anything. */
  userCoords?: { lat: number; lng: number } | null;
}

export function RoutePreviewMap({ origin, destination, stops = [], legs, userCoords }: Props) {
  const theme = useTheme();
  // Use the same colourful Voyager tiles in both modes — dark mode applies a
  // CSS filter (see .map-dark in index.css) that inverts + desaturates them
  // for a deep monochrome dark map that blends with the surrounding cards.
  const tileUrl = TILE_URL_LIGHT;
  // Loading-state canvas matches the final tile tone so there's no flash
  // before tiles paint. Tuned to sit just below the card's surface-2 bg.
  const tileBg = theme === 'dark' ? '#0F1626' : '#E8EDF7';
  // Polyline + user-location colour tweaks slightly for dark mode contrast.
  const arcColor = theme === 'dark' ? '#A5B4FC' : '#4F46E5';
  const useLegs = Array.isArray(legs) && legs.length > 0;

  // Build the point list — for legs, walk the sequence and dedup consecutive
  // identical airports so a chained A→B,B→C trip doesn't double-mark B.
  const points = useMemo(() => {
    if (useLegs) {
      const seen = new Set<string>();
      const arr: { sel: LocationSelection; label: string; color: string }[] = [];
      let idx = 0;
      const palette = ['#4F46E5', '#F97316', '#10B981', '#0EA5E9', '#A855F7', '#F59E0B'];
      legs!.forEach((leg) => {
        for (const sel of [leg.from, leg.to]) {
          const id = selectionId(sel);
          if (seen.has(id)) continue;
          seen.add(id);
          arr.push({
            sel,
            label: String(idx + 1),
            color: palette[idx % palette.length],
          });
          idx += 1;
        }
      });
      return arr;
    }

    const arr: { sel: LocationSelection; label: string; color: string }[] = [];
    if (origin) arr.push({ sel: origin, label: '1', color: '#4F46E5' });
    stops.forEach((s, i) =>
      arr.push({ sel: s, label: String(i + 2), color: '#F97316' }),
    );
    if (destination) {
      arr.push({
        sel: destination,
        label: String(stops.length + 2),
        color: '#10B981',
      });
    }
    return arr;
  }, [useLegs, legs, origin, destination, stops]);

  const coordsList = points.map((p) => selectionCoords(p.sel));
  const hasMarkers = points.length > 0;
  // Centre order: actual markers → user's resolved coords → Europe fallback.
  const initialCenter =
    coordsList[0] ?? (userCoords ? { lat: userCoords.lat, lng: userCoords.lng } : { lat: 50.0, lng: 10.0 });
  const initialZoom = hasMarkers ? 4 : userCoords ? 6 : 4;

  // Build curved arcs (great-circle-style quadratic beziers) instead of
  // straight dashed lines — matches the V1 production map.
  const polylines = useMemo<[number, number][][]>(() => {
    if (useLegs) {
      return legs!.map((leg) => {
        const a = selectionCoords(leg.from);
        const b = selectionCoords(leg.to);
        return computeArc([a.lat, a.lng], [b.lat, b.lng]);
      });
    }
    if (coordsList.length >= 2) {
      // Single-route mode: draw one arc per consecutive pair.
      const arcs: [number, number][][] = [];
      for (let i = 0; i < coordsList.length - 1; i++) {
        arcs.push(
          computeArc(
            [coordsList[i].lat, coordsList[i].lng],
            [coordsList[i + 1].lat, coordsList[i + 1].lng],
          ),
        );
      }
      return arcs;
    }
    return [];
  }, [useLegs, legs, coordsList]);

  return (
    <MapContainer
      center={[initialCenter.lat, initialCenter.lng]}
      zoom={initialZoom}
      scrollWheelZoom={false}
      zoomControl={false}
      className={theme === 'dark' ? 'map-dark' : ''}
      style={{ width: '100%', height: '100%', background: tileBg }}
    >
      <TileLayer key={tileUrl} url={tileUrl} attribution={TILE_ATTR} />
      <FitBounds coords={coordsList} />

      {points.map((p) => {
        const c = selectionCoords(p.sel);
        return (
          <Marker
            key={`${p.label}-${selectionName(p.sel)}`}
            position={[c.lat, c.lng]}
            icon={pin(p.color, p.label)}
          />
        );
      })}

      {polylines.map((line, i) => (
        <Polyline
          key={i}
          positions={line}
          pathOptions={{ color: arcColor, weight: 2.5, opacity: 0.9 }}
        />
      ))}

      {/* "You are here" — small subtle dot when no other markers and we have
          the user's coordinates. Designed to read as ambient context rather
          than a route marker. */}
      {!hasMarkers && userCoords && (
        <Marker position={[userCoords.lat, userCoords.lng]} icon={userLocationPin(arcColor)} />
      )}
    </MapContainer>
  );
}

function userLocationPin(color: string) {
  // The pin reads as ambient context: small filled dot with a white inner
  // ring and a soft tinted halo so it stays visible against both the
  // colourful Voyager tiles and the dark Carto tiles.
  return L.divIcon({
    html: `
      <div style="
        width: 18px; height: 18px; border-radius: 50%;
        background: ${color}; border: 3px solid white;
        box-shadow: 0 0 0 4px ${color}33, 0 6px 14px rgba(15,23,42,0.25);
      "></div>`,
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function FitBounds({ coords }: { coords: { lat: number; lng: number }[] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length === 0) return;
    if (coords.length === 1) {
      map.setView([coords[0].lat, coords[0].lng], 5, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(coords.map((c) => [c.lat, c.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6, animate: true });
  }, [coords, map]);
  return null;
}
