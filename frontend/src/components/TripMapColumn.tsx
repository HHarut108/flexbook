import { lazy, Suspense, useEffect, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { LocationSelection, selectionCoords, selectionName } from '@fast-travel/shared';
import type { MapLeg } from './RoutePreviewMap';
import { resolveUserCoords, readCachedCoords, type Coords } from '../utils/geolocation.utils';

const RoutePreviewMap = lazy(() =>
  import('./RoutePreviewMap').then((m) => ({ default: m.RoutePreviewMap })),
);

interface Props {
  origin?: LocationSelection | null;
  destination?: LocationSelection | null;
  /** Optional extra stops (Trip Builder) — drawn as via-points. */
  stops?: LocationSelection[];
  /** Multi-leg route (Quick Search multi-city). Takes precedence over
   *  origin/destination — every leg gets its own dashed line + markers. */
  legs?: MapLeg[];
  /** Hint shown in the top-left pill when only user-location is rendered. */
  emptyHint?: string;
  className?: string;
}

export type { MapLeg };

/**
 * Shared map column for V2 tool pages. Always renders the map — even before
 * the user picks anything — by detecting their nearest coordinates and
 * dropping a "You are here" marker. Falls back to a Europe-wide view if
 * geolocation fails.
 */
export function TripMapColumn({
  origin = null,
  destination = null,
  stops = [],
  legs,
  emptyHint = 'Your location',
  className = '',
}: Props) {
  const [userCoords, setUserCoords] = useState<Coords | null>(readCachedCoords());

  const hasLegs = Array.isArray(legs) && legs.length > 0;
  const hasMarkers = hasLegs || !!origin || !!destination || stops.length > 0;

  // Resolve user coords once on mount when nothing else is on the map. Cached
  // coords land synchronously above; only fire the async resolver if we have
  // no marker AND no cache. Avoids a wasted geo lookup on screens that
  // already know where the user is going.
  useEffect(() => {
    if (hasMarkers) return;
    if (userCoords) return;
    let cancelled = false;
    resolveUserCoords()
      .then((c) => {
        if (!cancelled) setUserCoords(c);
      })
      .catch(() => {
        // both browser and IP geo failed — RoutePreviewMap will show its
        // default Europe-centred view.
      });
    return () => {
      cancelled = true;
    };
  }, [hasMarkers, userCoords]);

  return (
    <div className={`lg:sticky lg:top-24 ${className}`}>
      <div
        className="relative rounded-[24px] overflow-hidden border border-border/40 bg-surface-2"
        style={{ height: 420, boxShadow: '0 24px 60px -28px rgba(15,23,42,0.32)' }}
      >
        <Suspense fallback={<MapLoading />}>
          <RoutePreviewMap
            origin={origin}
            destination={destination}
            stops={stops}
            legs={legs}
            userCoords={userCoords}
          />
        </Suspense>

        {hasLegs && legs!.length > 0 && (
          <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm border border-border text-[11px] font-bold text-text-primary shadow-sm">
            <MapPin size={11} className="text-indigo" />
            {legs!.length} {legs!.length === 1 ? 'flight' : 'flights'}
          </div>
        )}

        {!hasLegs && origin && (
          <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm border border-border text-[11px] font-bold text-text-primary shadow-sm">
            <MapPin size={11} className="text-indigo" />
            {selectionName(origin)}
            {destination && <> → {selectionName(destination)}</>}
          </div>
        )}

        {!hasMarkers && userCoords && (
          <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm border border-border text-[11px] font-bold text-text-secondary shadow-sm">
            <MapPin size={11} className="text-indigo" />
            {emptyHint}
          </div>
        )}
      </div>
    </div>
  );
}

function MapLoading() {
  return (
    <div className="w-full h-full flex items-center justify-center text-text-muted bg-surface-2">
      <Loader2 size={20} className="animate-spin" />
    </div>
  );
}

// Re-export so screens can do `import { selectionCoords } from '...'` if needed
export { selectionCoords };
