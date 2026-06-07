import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import {
  BedDouble,
  Building2,
  Compass,
  ExternalLink,
  Leaf,
  Mountain,
  Music,
  Navigation,
  UtensilsCrossed,
  Sparkles,
} from 'lucide-react';

interface Hotel {
  name: string;
  neighborhood: string;
  priceLevel: string | null;
  why: string;
  bookingUrl?: string;
  rating: number | null;
  reviewCount: number | null;
}

interface Restaurant {
  name: string;
  mealType: string;
  description: string;
  rating?: number;
  priceLevel?: string;
}

interface PlaceItem {
  name: string;
  type: string;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

interface DoCategories {
  culture: PlaceItem[];
  natureOutdoors: PlaceItem[];
  cuisineRestaurants: PlaceItem[];
  nightlife: PlaceItem[];
  wellness: PlaceItem[];
  budgetLodging: PlaceItem[];
}

interface DestinationGuide {
  hotels: Hotel[];
  restaurants: Restaurant[];
  doCategories?: DoCategories;
}

const DO_CATEGORIES: {
  key: keyof DoCategories;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
}[] = [
  { key: 'culture',            label: 'Culture',            icon: Building2 },
  { key: 'natureOutdoors',     label: 'Nature & Outdoors',  icon: Mountain },
  { key: 'cuisineRestaurants', label: 'Cuisine & Dining',   icon: UtensilsCrossed },
  { key: 'nightlife',          label: 'Nightlife',          icon: Music },
  { key: 'wellness',           label: 'Wellness',           icon: Leaf },
  { key: 'budgetLodging',      label: 'Budget Lodging',     icon: BedDouble },
];

const MEAL_COLORS: Record<string, string> = {
  Breakfast: 'pill-sky',
  Lunch: 'pill-brand',
  Dinner: 'pill-warning',
  Snack: 'pill-default',
  Coffee: 'pill-default',
};

interface Props {
  city: string;
  country: string;
  nights: number;
  checkin?: string;
  checkout?: string;
  passengers: number;
  onOpenFullGuide?: () => void;
}

export function DestinationGuideCard({
  city,
  country,
  nights,
  checkin,
  checkout,
  passengers,
  onOpenFullGuide,
}: Props) {
  const [data, setData] = useState<DestinationGuide | null>(null);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<0 | 1 | 2>(0);
  const [liveRestaurants, setLiveRestaurants] = useState<Restaurant[] | null>(null);
  const [restaurantsLoading, setRestaurantsLoading] = useState(false);

  useEffect(() => {
    if (!city) return;
    let cancelled = false;
    apiClient
      .get<DestinationGuide>('/city-guide', {
        params: {
          city,
          country,
          ...(checkin && { checkin }),
          ...(checkout && { checkout }),
          passengers,
          nights,
        },
      })
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [city, country, checkin, checkout, passengers, nights]);

  useEffect(() => {
    if (activeTab !== 2 || liveRestaurants !== null || restaurantsLoading) return;
    setRestaurantsLoading(true);
    apiClient
      .get<Restaurant[]>('/restaurants', { params: { city, country } })
      .then((res) => setLiveRestaurants(res.data))
      .catch(() => setLiveRestaurants(null))
      .finally(() => setRestaurantsLoading(false));
  }, [activeTab, city, country, liveRestaurants, restaurantsLoading]);

  if (!data && !error) {
    return (
      <div className="section-shell p-4 space-y-3 animate-pulse">
        <div className="rounded-xl bg-surface-2 h-10" />
        <div className="rounded-xl bg-surface-2 h-20" />
        <div className="rounded-xl bg-surface-2 h-20" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="section-shell px-4 py-5">
        <p className="text-sm text-text-muted">
          We don&apos;t have a curated guide for {city} yet. Try the full planner.
        </p>
      </div>
    );
  }

  return (
    <div className="section-shell overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-text-muted">
            {nights} {nights === 1 ? 'night' : 'nights'} in {city}
          </p>
          <p className="text-sm font-semibold text-text-primary mt-0.5">
            Where to stay, what to do, where to eat
          </p>
        </div>
        {onOpenFullGuide && (
          <button
            onClick={onOpenFullGuide}
            className="hidden lg:inline-flex items-center gap-1.5 rounded-xl bg-indigo-soft border border-indigo-border px-3 py-1.5 text-xs font-semibold text-indigo hover:bg-indigo hover:text-white hover:border-indigo transition-all active:scale-[0.97]"
          >
            <Sparkles size={12} /> Open full guide
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border/60" role="tablist">
        {([
          { label: 'Stay', icon: <BedDouble size={13} /> },
          { label: 'Do', icon: <Compass size={13} /> },
          { label: 'Eat', icon: <UtensilsCrossed size={13} /> },
        ] as const).map(({ label, icon }, i) => (
          <button
            key={label}
            role="tab"
            aria-selected={activeTab === i}
            onClick={() => setActiveTab(i as 0 | 1 | 2)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === i
                ? 'text-indigo border-b-2 border-indigo bg-indigo-soft/40'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Tab content — capped height, scrollable, so the page stays compact */}
      <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto" key={activeTab}>
        {activeTab === 0 && data.hotels.slice(0, 4).map((hotel) => (
          <div key={hotel.name} className="rounded-2xl border border-border bg-surface px-4 py-3"
            style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.04)' }}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <h4 className="text-sm font-bold text-text-primary leading-tight flex-1 min-w-0">
                {hotel.name}
              </h4>
              {hotel.priceLevel && (
                <span className="text-sm font-semibold text-indigo shrink-0">{hotel.priceLevel}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="pill-default text-[10px]">{hotel.neighborhood}</span>
              {hotel.rating != null && (
                <span className="text-[11px] text-text-muted">
                  ⭐ {hotel.rating.toFixed(1)}
                  {hotel.reviewCount != null && (
                    <span className="text-text-xmuted"> ({hotel.reviewCount.toLocaleString()})</span>
                  )}
                </span>
              )}
            </div>
            <p className="text-xs text-text-secondary leading-relaxed mb-3">{hotel.why}</p>
            {hotel.bookingUrl && (
              <a
                href={hotel.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-border bg-indigo-soft px-3 py-1.5 text-xs font-semibold text-indigo hover:bg-indigo hover:text-white hover:border-indigo transition-all"
              >
                Check availability <ExternalLink size={11} />
              </a>
            )}
          </div>
        ))}

        {activeTab === 1 && (
          <div className="space-y-4">
            {DO_CATEGORIES.map(({ key, label, icon: Icon }) => {
              const places = data.doCategories?.[key] ?? [];
              if (places.length === 0) return null;
              return (
                <div key={key}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <div className="w-5 h-5 rounded-md bg-indigo-soft border border-indigo-border flex items-center justify-center shrink-0">
                      <Icon size={11} className="text-indigo" />
                    </div>
                    <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-text-muted">
                      {label}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {places.slice(0, 3).map((place) => (
                      <div
                        key={place.name}
                        className="rounded-xl border border-border bg-surface px-3 py-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h5 className="text-[13px] font-semibold text-text-primary leading-tight">
                              {place.name}
                            </h5>
                            {place.type && (
                              <p className="text-[11px] text-text-muted mt-0.5">{place.type}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {place.priceLevel && (
                              <span className="text-xs font-semibold text-indigo">{place.priceLevel}</span>
                            )}
                            {place.lat != null && place.lng != null && (
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 rounded-md bg-indigo-soft border border-indigo-border px-1.5 py-0.5 text-[10px] font-semibold text-indigo hover:bg-indigo hover:text-white hover:border-indigo transition-all"
                              >
                                <Navigation size={10} /> Go
                              </a>
                            )}
                          </div>
                        </div>
                        {place.rating != null && (
                          <p className="text-[11px] text-text-muted mt-1">
                            ⭐ {place.rating.toFixed(1)}
                            {place.reviewCount != null && (
                              <span className="text-text-xmuted">
                                {' '}({place.reviewCount.toLocaleString()})
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 2 && (
          restaurantsLoading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl bg-surface-2 h-16" />
              ))}
            </div>
          ) : (liveRestaurants ?? data.restaurants).slice(0, 6).map((r) => (
            <div key={r.name} className="rounded-xl border border-border bg-surface px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`${MEAL_COLORS[r.mealType] ?? 'pill-default'} text-[10px] shrink-0`}>
                    {r.mealType}
                  </span>
                  <h5 className="text-sm font-semibold text-text-primary truncate">{r.name}</h5>
                </div>
                {(r.rating || r.priceLevel) && (
                  <div className="flex items-center gap-1.5 shrink-0 text-[11px] text-text-muted">
                    {r.rating && <span>⭐ {r.rating.toFixed(1)}</span>}
                    {r.priceLevel && <span className="text-text-xmuted">{r.priceLevel}</span>}
                  </div>
                )}
              </div>
              {r.description && !r.description.startsWith('Rated') && r.description !== 'Local favourite' && (
                <p className="text-[11px] text-text-muted leading-relaxed">{r.description}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
