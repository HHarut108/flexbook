import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/* ─────────────────────────────────────────────────────────────
   Home-page marketing fan — uses the same Leaflet basemap as
   the in-app FlightFanMap (CartoCDN Voyager tiles) so the home
   visual is visually consistent with what users see after they
   pick an origin.

   Destinations + prices mirror the cheapest mock options we
   currently ship from MockFlightProvider (Lisbon, Madrid, Paris,
   Amsterdam, Rome, Vienna, Prague, Athens, Copenhagen). Origin
   is Budapest so the fan radiates outward in all directions.
   ───────────────────────────────────────────────────────────── */

interface Place {
  iata: string;
  city: string;
  lat: number;
  lng: number;
  /** Cheapest current direct fare from Budapest, in USD. */
  price?: number;
}

const ORIGIN: Place = { iata: 'BUD', city: 'Budapest', lat: 47.4979, lng: 19.0402 };

// Cheapest direct fares from BUD — list sorted by price ascending, so
// the first entry (Yerevan) gets the orange highlight at render time.
// Yerevan replaces the original Vienna entry because VIE sits too close
// to BUD geographically (~220 km) and visually overlapped the origin pin.
const DESTINATIONS: Place[] = [
  { iata: 'EVN', city: 'Yerevan',    lat: 40.1792, lng: 44.4991, price: 29  }, // cheapest
  { iata: 'PRG', city: 'Prague',     lat: 50.0755, lng: 14.4378, price: 35  },
  { iata: 'FCO', city: 'Rome',       lat: 41.9028, lng: 12.4964, price: 49  },
  { iata: 'CPH', city: 'Copenhagen', lat: 55.6761, lng: 12.5683, price: 58  },
  { iata: 'ATH', city: 'Athens',     lat: 37.9838, lng: 23.7275, price: 62  },
  { iata: 'AMS', city: 'Amsterdam',  lat: 52.3676, lng: 4.9041,  price: 71  },
  { iata: 'CDG', city: 'Paris',      lat: 48.8566, lng: 2.3522,  price: 78  },
  { iata: 'MAD', city: 'Madrid',     lat: 40.4168, lng: -3.7038, price: 95  },
  { iata: 'LIS', city: 'Lisbon',     lat: 38.7223, lng: -9.1393, price: 109 },
];

/* ─────────────────────────────────────────────────────────────
   Custom Leaflet markers — same divIcon HTML as FlightFanMap so
   the existing .trip-map-pin and .flight-fan-pin CSS apply.
   ───────────────────────────────────────────────────────────── */

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

function createPricePin(price: string, highlighted: boolean, animationDelayMs: number) {
  const classes = ['flight-fan-pin', 'home-fan-pin-anim', highlighted ? 'flight-fan-pin--hot' : '']
    .filter(Boolean)
    .join(' ');
  return L.divIcon({
    html: `<div class="${classes}" style="animation-delay:${animationDelayMs}ms"><span>${price}</span></div>`,
    className: '',
    iconSize: [54, 26],
    iconAnchor: [27, 13],
  });
}

function createCityLabel(name: string) {
  return L.divIcon({
    html: `<div class="trip-map-label trip-map-label--origin">${name}</div>`,
    className: '',
    iconSize: [0, 0],
    iconAnchor: [-22, 12],
  });
}

/* Quadratic bezier in lat/lng space — same shape FlightFanMap uses. */
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

/* Combined size + fit: Leaflet calculates the wrong viewport on mount
 * if the container hasn't settled yet, so we invalidateSize FIRST,
 * then fitBounds. Re-runs on every container resize so the banner
 * stays correctly framed across breakpoints. */
function AutoFitOnSize({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    const fit = () => {
      map.invalidateSize({ animate: false });
      map.fitBounds(bounds, {
        // Generous vertical padding so the chip pills (anchored at
        // their pin's center) don't clip against the banner's
        // rounded top/bottom edges. Tighter on the sides.
        padding: [30, 24],
        maxZoom: 5,
        animate: false,
      });
    };
    const initial = setTimeout(fit, 60);
    const ro = new ResizeObserver(fit);
    ro.observe(map.getContainer());
    return () => {
      clearTimeout(initial);
      ro.disconnect();
    };
  }, [map, bounds]);
  return null;
}

/* ─────────────────────────────────────────────────────────────
   Main component
   ───────────────────────────────────────────────────────────── */

export function HomeFlightFan({ className = '', bare = false }: { className?: string; bare?: boolean }) {
  const cheapestIata = DESTINATIONS[0].iata; // list is sorted by price asc

  const arcs = useMemo(
    () =>
      DESTINATIONS.map((d) => ({
        iata: d.iata,
        path: computeArc([ORIGIN.lat, ORIGIN.lng], [d.lat, d.lng]),
        isCheapest: d.iata === cheapestIata,
      })),
    [cheapestIata],
  );

  const bounds = useMemo<L.LatLngBoundsExpression>(() => {
    const points: [number, number][] = [[ORIGIN.lat, ORIGIN.lng]];
    for (const d of DESTINATIONS) points.push([d.lat, d.lng]);
    return L.latLngBounds(points);
  }, []);

  return (
    <div className={`relative ${className}`} aria-hidden role="presentation">
      {/* Banner-shaped container — fills the parent column width
          with a 5:2 cinema aspect (2.5:1), but never thinner than
          180px tall so the chip pills always have vertical room.
          At md (~360px wide) → 180px (min); at lg (~480px) → 192px;
          at xl (~520px) → 208px. */}
      <div
        className={bare
          ? 'w-full aspect-[5/2] min-h-[180px]'
          : 'rounded-3xl border border-border/60 overflow-hidden shadow-[0_18px_50px_-20px_rgba(15,23,42,0.18)] w-full aspect-[5/2] min-h-[180px]'
        }
      >
        <MapContainer
          center={[ORIGIN.lat, ORIGIN.lng]}
          zoom={4}
          minZoom={3}
          maxZoom={6}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          dragging={false}
          touchZoom={false}
          keyboard={false}
          worldCopyJump={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap &copy; CARTO'
          />
          <AutoFitOnSize bounds={bounds} />

          {/* Glow underlay for each arc */}
          {arcs.map((arc) => (
            <Polyline
              key={`glow-${arc.iata}`}
              positions={arc.path}
              pathOptions={{
                color: arc.isCheapest ? '#F97316' : '#4F46E5',
                weight: arc.isCheapest ? 10 : 8,
                opacity: arc.isCheapest ? 0.18 : 0.1,
                lineCap: 'round',
              }}
            />
          ))}
          {/* Solid arc on top */}
          {arcs.map((arc) => (
            <Polyline
              key={`arc-${arc.iata}`}
              positions={arc.path}
              pathOptions={{
                color: arc.isCheapest ? '#F97316' : '#3730A3',
                weight: arc.isCheapest ? 3 : 2,
                opacity: arc.isCheapest ? 0.9 : 0.65,
                lineCap: 'round',
              }}
            />
          ))}

          {/* Origin star + city label */}
          <Marker
            position={[ORIGIN.lat, ORIGIN.lng]}
            icon={createOriginIcon()}
            interactive={false}
          />
          <Marker
            position={[ORIGIN.lat, ORIGIN.lng]}
            icon={createCityLabel(ORIGIN.city)}
            interactive={false}
          />

          {/* Price pins — staggered fade-in via animation-delay */}
          {DESTINATIONS.map((d, i) => (
            <Marker
              key={d.iata}
              position={[d.lat, d.lng]}
              icon={createPricePin(`$${d.price}`, d.iata === cheapestIata, 250 + i * 90)}
              interactive={false}
            />
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
