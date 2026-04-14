import { useEffect } from 'react';
import { useSavedTripsStore, SavedTrip } from '../store/saved-trips.store';
import { useTripStore } from '../store/trip.store';
import { useSessionStore } from '../store/session.store';
import { buildShareUrl } from '../utils/url.utils';
import { formatPrice } from '../utils/price.utils';
import { ApiModeSwitcher } from './ApiModeSwitcher';
import { X, MapPin, Share2, Trash2, Plane, BookmarkCheck } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

function SavedTripCard({
  trip,
  onLoad,
  onShare,
  onDelete,
}: {
  trip: SavedTrip;
  onLoad: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const legs = trip.itinerary.legs;
  const total = legs.reduce((s, l) => s + l.priceUsd, 0);
  const stops = legs.filter((l) => !l.isReturn).length;
  const savedDate = new Date(trip.savedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="bg-white rounded-2xl border border-border p-4 transition-all hover:border-indigo-border"
      style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.06)' }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <button onClick={onLoad} className="min-w-0 flex-1 text-left group">
          <p className="text-sm font-semibold text-text-primary group-hover:text-indigo transition-colors truncate">
            {trip.name}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
            <span>{stops} stop{stops !== 1 ? 's' : ''}</span>
            <span className="text-text-xmuted">·</span>
            <span className="font-mono font-bold text-orange">{formatPrice(total)}</span>
            <span className="text-text-xmuted">·</span>
            <span>{savedDate}</span>
          </div>
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onLoad}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-indigo bg-indigo-soft border border-indigo-border hover:bg-indigo/10 transition-all active:scale-95"
        >
          <Plane size={12} /> View trip
        </button>
        <button
          onClick={onShare}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-border text-text-muted hover:text-indigo hover:border-indigo-border transition-all active:scale-95"
          title="Copy share link"
        >
          <Share2 size={14} />
        </button>
        <button
          onClick={onDelete}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-border text-text-muted hover:text-red-500 hover:border-red-200 transition-all active:scale-95"
          title="Delete trip"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export function AppDrawer({ open, onClose }: Props) {
  const { trips, deleteTrip } = useSavedTripsStore();
  const loadFromItinerary = useTripStore((s) => s.loadFromItinerary);
  const setScreen = useSessionStore((s) => s.setScreen);
  const showToast = useSessionStore((s) => s.showToast);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  function handleLoad(trip: SavedTrip) {
    loadFromItinerary(trip.itinerary);
    if (trip.itinerary.status === 'complete') {
      setScreen('itinerary');
    } else if (trip.itinerary.legs.length > 0) {
      setScreen('decision');
    } else {
      setScreen('flight-results');
    }
    onClose();
  }

  function handleShare(trip: SavedTrip) {
    const url = buildShareUrl(trip.itinerary);
    navigator.clipboard.writeText(url);
    showToast('Trip link copied!');
  }

  function handleDelete(id: string) {
    deleteTrip(id);
    showToast('Trip removed.');
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[200] bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-0 left-0 right-0 z-[201] max-w-[448px] mx-auto transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div
          className="bg-white rounded-b-3xl overflow-hidden"
          style={{
            maxHeight: '85vh',
            boxShadow: '0 24px 48px rgba(15,23,42,0.15)',
          }}
        >
          {/* Header */}
          <div
            className="px-5 pt-5 pb-4 flex items-center justify-between"
            style={{
              background: 'linear-gradient(135deg, rgba(55,48,163,0.97) 0%, rgba(79,70,229,0.97) 100%)',
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight text-white">flex<span className="text-orange">/</span>book</span>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center text-white hover:bg-white/25 transition-all active:scale-95"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content — scrollable */}
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 72px)' }}>
            {/* Saved Trips */}
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-center gap-2 mb-4">
                <BookmarkCheck size={16} className="text-indigo" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted">Saved Trips</h3>
              </div>

              {trips.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-soft border border-indigo-border flex items-center justify-center mx-auto mb-3">
                    <MapPin size={20} className="text-indigo" />
                  </div>
                  <p className="text-sm text-text-muted mb-1">No saved trips yet</p>
                  <p className="text-xs text-text-xmuted">Plan a trip and save it for later.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {trips.map((trip) => (
                    <SavedTripCard
                      key={trip.id}
                      trip={trip}
                      onLoad={() => handleLoad(trip)}
                      onShare={() => handleShare(trip)}
                      onDelete={() => handleDelete(trip.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Settings section */}
            <div className="px-5 pb-5 pt-2 border-t border-border">
              <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-3 mt-3">Settings</h3>
              <div className="flex items-center justify-between bg-surface-2 rounded-2xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">Data source</p>
                  <p className="text-xs text-text-muted">Switch between mock and live API</p>
                </div>
                <ApiModeSwitcher />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
