import { useState, lazy, Suspense } from 'react';
import { useTripStore } from '../store/trip.store';
import { useSessionStore } from '../store/session.store';
import { useSavedTripsStore } from '../store/saved-trips.store';
import { formatDate, formatTime, durationLabel } from '../utils/date.utils';
import { formatPrice, totalPrice } from '../utils/price.utils';
import { buildSlugShareUrl } from '../utils/url.utils';
import { createTripShare } from '../api/trips.api';
import { ArrowLeft, Plane, Map, List, Share2, ExternalLink, Check, CreditCard, Bookmark, Loader2 } from 'lucide-react';
import { MapErrorBoundary } from '../components/MapErrorBoundary';

const TripMap = lazy(() => import('../components/TripMap').then((m) => ({ default: m.TripMap })));

export function ItineraryScreen() {
  const origin = useTripStore((s) => s.origin);
  const legs = useTripStore((s) => s.legs);
  const itinerary = useTripStore((s) => s.toItinerary());
  const reset = useTripStore((s) => s.reset);
  const resetSession = useSessionStore((s) => s.reset);
  const setScreen = useSessionStore((s) => s.setScreen);
  const showToast = useSessionStore((s) => s.showToast);
  const showShareModal = useSessionStore((s) => s.showShareModal);
  const saveTrip = useSavedTripsStore((s) => s.saveTrip);
  const [tab, setTab] = useState<'timeline' | 'map'>('timeline');
  const [sharing, setSharing] = useState(false);
  const [saved, setSaved] = useState(false);

  const total = totalPrice(legs);

  async function handleShare() {
    if (!itinerary || sharing) return;
    setSharing(true);
    try {
      const id = await createTripShare(itinerary);
      showShareModal(buildSlugShareUrl(id));
    } catch {
      showToast('Could not generate share link. Please try again.');
    } finally {
      setSharing(false);
    }
  }

  function handleNewTrip() {
    reset();
    resetSession();
    setScreen('home');
  }

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="px-4 pt-4 pb-4">
        <div className="hero-panel">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <button
              onClick={() => setScreen('return-flights')}
              className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white border border-border hover:bg-indigo-soft hover:border-indigo-border transition-all text-text-muted shrink-0 mt-0.5"
              aria-label="Back to return flights"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-indigo-mid font-mono mb-1">
                Your route is ready
              </p>
              <h2 className="text-2xl font-bold text-text-primary">Your trip</h2>
              <p className="text-text-muted text-sm">{legs.length} flight{legs.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-orange font-mono font-bold text-3xl">{formatPrice(total)}</div>
            <div className="text-text-muted text-xs">estimated total</div>
          </div>
        </div>
        <p className="text-text-muted text-xs mt-1">
          Prices are estimates. Confirm at booking.
        </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface border-b border-border">
        <button
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${tab === 'timeline' ? 'text-indigo border-b-2 border-indigo bg-indigo-soft/40' : 'text-text-muted'}`}
          onClick={() => setTab('timeline')}
        >
          <List size={16} /> Timeline
        </button>
        <button
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${tab === 'map' ? 'text-indigo border-b-2 border-indigo bg-indigo-soft/40' : 'text-text-muted'}`}
          onClick={() => setTab('map')}
        >
          <Map size={16} /> Map
        </button>
      </div>

      {/* Timeline */}
      {tab === 'timeline' && (
        <div className="px-4 pt-4 space-y-4">
          {legs.map((leg) => (
            <div key={`${leg.stopIndex}-${leg.isReturn}`} className="card">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${leg.isReturn ? 'bg-indigo-soft text-indigo border border-indigo-border' : 'bg-orange text-white shadow-[0_8px_20px_rgba(249,115,22,0.25)]'}`}>
                  {leg.isReturn ? '↩' : leg.stopIndex}
                </div>
                <span className="text-text-muted text-xs">
                  {leg.isReturn ? 'Return flight' : `Stop ${leg.stopIndex}`}
                </span>
              </div>

              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 text-text-primary font-semibold">
                    <span className="font-mono text-sm text-text-muted">{leg.originIata}</span>
                    <Plane size={14} className="rotate-90 text-text-muted" />
                    <span>{leg.destinationCity}</span>
                    <span className="font-mono text-sm text-text-muted">{leg.destinationIata}</span>
                  </div>
                  <div className="text-sm text-text-muted mt-1 font-mono">
                    {formatTime(leg.departureDatetime)} → {formatTime(leg.arrivalDatetime)} · {leg.airlineName} · {durationLabel(leg.durationMinutes)}
                    {leg.stops === 0 ? ' · Direct' : ` · ${leg.stops} stop${leg.stops > 1 ? 's' : ''}`}
                  </div>
                  <div className="text-xs text-text-muted mt-1">
                    {formatDate(leg.departureDatetime)}
                  </div>
                  {!leg.isReturn && leg.stayDurationDays > 0 && (
                    <div className="text-xs text-text-muted mt-1">
                      📍 {leg.stayDurationDays} {leg.stayDurationDays === 1 ? 'day' : 'days'} in {leg.destinationCity}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className="text-orange font-mono font-bold">{formatPrice(leg.priceUsd)}</div>
                  <a
                    href={leg.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pill-warning hover:bg-orange/20 transition-colors mt-2 inline-flex items-center gap-1"
                  >
                    Book <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Map */}
      {tab === 'map' && origin && (
        <div className="mx-3 mt-3" style={{ height: 'calc(100vh - 250px)', minHeight: '320px' }}>
          <MapErrorBoundary>
            <Suspense fallback={<div className="h-full bg-surface rounded-[20px] animate-pulse" />}>
              <TripMap origin={origin} legs={legs} />
            </Suspense>
          </MapErrorBoundary>
        </div>
      )}

      {/* Actions — hidden in map tab */}
      {tab === 'timeline' && <div className="px-4 mt-6 space-y-3">
        <button
          className="btn-primary flex items-center justify-center gap-2"
          onClick={() => setScreen('booking-review')}
        >
          <CreditCard size={16} /> Proceed to booking options
        </button>
        <div className="flex gap-3">
          <button
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
            onClick={() => {
              if (!itinerary || saved) return;
              saveTrip(itinerary);
              setSaved(true);
              showToast('Trip saved! Find it in the menu.');
            }}
            disabled={saved}
          >
            {saved ? <><Check size={16} /> Saved</> : <><Bookmark size={16} /> Save trip</>}
          </button>
          <button className="btn-secondary flex-1 flex items-center justify-center gap-2" onClick={handleShare} disabled={sharing}>
            {sharing ? <><Loader2 size={16} className="animate-spin" /> Generating…</> : <><Share2 size={16} /> Share trip</>}
          </button>
        </div>
        <button className="btn-outline" onClick={handleNewTrip}>
          Plan another trip
        </button>
      </div>}
    </div>
  );
}
