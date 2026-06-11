import { useEffect, useState } from 'react';
import { useViewTransitionNavigate } from '../hooks/useViewTransitionNavigate';
import { useSavedTripsStore, SavedTrip } from '../store/saved-trips.store';
import { useTripStore } from '../store/trip.store';
import { useSessionStore } from '../store/session.store';
import { useAuthStore } from '../store/auth.store';
import { authApi } from '../api/auth.api';
import { buildSlugShareUrl } from '../utils/url.utils';
import { createTripShare } from '../api/trips.api';
import { formatPrice } from '../utils/price.utils';
import { useThemeStore } from '../store/theme.store';
import { X, MapPin, Share2, Trash2, Plane, BookmarkCheck, Loader2, Sun, Moon, User, LogOut, ChevronRight, ChevronDown } from 'lucide-react';
import { GoHomeLogo } from './GoHomeLogo';
import { TOOLS_V2 } from '../screens/ToolsScreen';
import { intentPrefetch } from '../lib/routePrefetch';

interface Props {
  open: boolean;
  onClose: () => void;
}

function SavedTripCard({
  trip,
  onLoad,
  onShare,
  onDelete,
  sharing,
}: {
  trip: SavedTrip;
  onLoad: () => void;
  onShare: () => void;
  onDelete: () => void;
  sharing: boolean;
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
          disabled={sharing}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-border text-text-muted hover:text-indigo hover:border-indigo-border transition-all active:scale-95 disabled:opacity-50"
          title="Share trip"
        >
          {sharing ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
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
  const navigate = useViewTransitionNavigate();
  const { trips, deleteTrip } = useSavedTripsStore();
  const loadFromItinerary = useTripStore((s) => s.loadFromItinerary);
  const showToast = useSessionStore((s) => s.showToast);
  const showShareModal = useSessionStore((s) => s.showShareModal);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const { user, logout } = useAuthStore();
  const [sharingTripId, setSharingTripId] = useState<string | null>(null);
  const [savedTripsOpen, setSavedTripsOpen] = useState(true);

  async function handleLogout() {
    try { await authApi.logout(); } catch { /* ignore */ }
    logout();
    onClose();
  }

  function goTo(path: string) {
    navigate(path);
    onClose();
  }

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
      navigate('/itinerary');
    } else if (trip.itinerary.legs.length > 0) {
      navigate('/review');
    } else {
      navigate('/flights');
    }
    onClose();
  }

  async function handleShare(trip: SavedTrip) {
    if (sharingTripId) return;
    setSharingTripId(trip.id);
    try {
      const id = await createTripShare(trip.itinerary);
      showShareModal(buildSlugShareUrl(id));
    } catch {
      showToast('Could not generate share link. Please try again.');
    } finally {
      setSharingTripId(null);
    }
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

      {/* Drawer panel
          Mobile: slides down from the top edge (full width, capped at 448).
          md+: slides in from the right as a side drawer (420px wide).        */}
      <div
        className={`fixed z-[201] transition-transform duration-300 ease-out
          top-0 left-0 right-0 max-w-[448px] mx-auto ${open ? 'translate-y-0' : '-translate-y-full'}
          md:left-auto md:right-0 md:mx-0 md:w-[420px] md:max-w-none md:h-screen md:translate-y-0
          ${open ? 'md:translate-x-0' : 'md:translate-x-full'}`}
      >
        <div
          className="bg-white overflow-hidden h-[100dvh] flex flex-col"
          style={{
            boxShadow: '0 24px 48px rgba(15,23,42,0.15)',
          }}
        >
          {/* Header — matches the bright app nav (MarketingShellV2) */}
          <div className="px-5 pt-5 pb-4 flex items-center justify-between shrink-0 border-b border-border/50 bg-bg/80 backdrop-blur-sm">
            <GoHomeLogo size="sm" variant="light" onNavigate={onClose} />
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-2xl bg-surface border border-border flex items-center justify-center text-indigo-mid hover:bg-indigo-soft hover:border-indigo-border transition-all active:scale-95"
              style={{ boxShadow: '0 4px 10px rgba(15,23,42,0.06)' }}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content — scrollable */}
          <div className="flex-1 min-h-0 overflow-y-auto">

            {/* Account section */}
            <div className="px-5 pt-5 pb-4 border-b border-border">
              {user ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo/15 border border-indigo-border flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-indigo leading-none">
                        {user.firstName[0]}{user.lastName[0]}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-text-muted truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => goTo('/account')}
                      {...intentPrefetch('/account')}
                      className="flex-1 flex items-center justify-between px-3 py-2.5 rounded-xl bg-indigo-soft border border-indigo-border text-xs font-semibold text-indigo hover:bg-indigo/10 transition-all"
                    >
                      <span>Account settings</span>
                      <ChevronRight size={13} />
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-10 h-10 rounded-xl border border-border flex items-center justify-center text-text-muted hover:text-red-500 hover:border-red-200 transition-all"
                      title="Log out"
                    >
                      <LogOut size={15} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-indigo/10 flex items-center justify-center">
                      <User size={15} className="text-indigo" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Your account</p>
                      <p className="text-xs text-text-muted">Save trips across devices</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => goTo('/login')}
                      {...intentPrefetch('/login')}
                      className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-text-primary hover:bg-surface-2 transition-all"
                    >
                      Log in
                    </button>
                    <button
                      onClick={() => goTo('/signup')}
                      {...intentPrefetch('/signup')}
                      className="flex-1 py-3 rounded-xl bg-indigo text-white text-sm font-semibold hover:bg-indigo/90 transition-all"
                      style={{ boxShadow: '0 4px 12px rgba(55,48,163,0.2)' }}
                    >
                      Sign up
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Saved Trips — collapsible */}
            <div className="px-5 pt-5 pb-4">
              <button
                type="button"
                onClick={() => setSavedTripsOpen((v) => !v)}
                aria-expanded={savedTripsOpen}
                className="w-full flex items-center justify-between gap-2 mb-4 group"
              >
                <div className="flex items-center gap-2">
                  <BookmarkCheck size={16} className="text-indigo" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted group-hover:text-text-primary transition-colors">Saved Trips</h3>
                  {trips.length > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-indigo-soft border border-indigo-border text-[10px] font-bold text-indigo">
                      {trips.length}
                    </span>
                  )}
                </div>
                <ChevronDown
                  size={16}
                  className={`text-text-muted transition-transform duration-200 ${savedTripsOpen ? 'rotate-0' : '-rotate-90'}`}
                />
              </button>

              {savedTripsOpen && (
                trips.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-soft border border-indigo-border flex items-center justify-center mx-auto mb-3">
                      <MapPin size={20} className="text-indigo" />
                    </div>
                    <p className="text-sm text-text-muted mb-1">No saved trips yet</p>
                    <p className="text-xs text-text-xmuted mb-4">Plan a trip and save it for later.</p>
                    <button
                      onClick={() => { navigate('/'); onClose(); }}
                      className="inline-flex items-center gap-2 rounded-2xl bg-indigo text-white text-sm font-semibold px-5 py-2.5 hover:bg-indigo/90 transition-all active:scale-95"
                      style={{ boxShadow: '0 8px 20px rgba(55,48,163,0.25)' }}
                    >
                      Plan a new trip
                    </button>
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
                        sharing={sharingTripId === trip.id}
                      />
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Tools — all 4 from TOOLS_V2 */}
            <div className="px-5 pb-5 pt-2 border-t border-border">
              <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-3 mt-3">Tools</h3>
              <div className="space-y-2">
                {TOOLS_V2.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => goTo(tool.path)}
                      {...intentPrefetch(tool.path)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-surface-2 border border-border hover:border-indigo-border hover:bg-indigo-soft transition-all active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: tool.gradient }}
                        >
                          <Icon size={16} className="text-white" />
                        </div>
                        <div className="text-left min-w-0">
                          <p className="text-sm font-semibold text-text-primary truncate">{tool.name}</p>
                          <p className="text-xs text-text-muted truncate">{tool.tagline}</p>
                        </div>
                      </div>
                      <ChevronRight size={15} className="text-text-muted shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Settings — pinned to bottom */}
          <div className="px-5 py-4 border-t border-border bg-white shrink-0">
            <div className="flex items-center justify-between bg-surface-2 rounded-2xl px-4 py-3">
              <div>
                <p className="text-sm font-medium text-text-primary">Appearance</p>
                <p className="text-xs text-text-muted">Switch between light and dark</p>
              </div>
              <div
                role="group"
                aria-label="Theme"
                className="inline-flex items-center rounded-full bg-white border border-border p-0.5"
              >
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  aria-pressed={theme === 'light'}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    theme === 'light' ? 'bg-indigo text-white' : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <Sun size={13} /> Light
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  aria-pressed={theme === 'dark'}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    theme === 'dark' ? 'bg-indigo text-white' : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <Moon size={13} /> Dark
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
