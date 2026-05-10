import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTripStore } from '../store/trip.store';
import { apiClient } from '../api/client';
import { StickyReturnBar } from '../components/StickyReturnBar';
import { formatShortDate } from '../utils/date.utils';
import {
  ArrowLeft,
  BedDouble,
  Building2,
  ChevronDown,
  Compass,
  ExternalLink,
  Info,
  Leaf,
  Mountain,
  Music,
  Navigation,
  UtensilsCrossed,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Hotel {
  name: string;
  neighborhood: string;
  priceLevel: string | null;
  why: string;
  bookingUrl?: string;
  rating: number | null;
  reviewCount: number | null;
}

interface Activity {
  name: string;
  duration: string;
  cost: 'free' | '€' | '€€' | '€€€';
  note?: string;
  rating?: number | null;
  reviewCount?: number | null;
  address?: string | null;
  dontSkip: boolean;
  icon: string;
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

interface DaySlot {
  time: string;
  activity: string;
}

interface Day {
  title: string;
  slots: DaySlot[];
}

interface Practical {
  currency: string;
  sim: string;
  transport: string;
}

interface DestinationGuide {
  hotels: Hotel[];
  activities: Activity[];
  restaurants: Restaurant[];
  days: Day[];
  practical: Practical;
  doCategories?: DoCategories;
}

// ── Do-tab category definitions ────────────────────────────────────────────────

const DO_CATEGORIES: {
  key: keyof DoCategories;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
}[] = [
  { key: 'culture',           label: 'Culture',                 icon: Building2       },
  { key: 'natureOutdoors',    label: 'Nature & Outdoors',       icon: Mountain        },
  { key: 'cuisineRestaurants',label: 'Cuisine & Dining',        icon: UtensilsCrossed },
  { key: 'nightlife',         label: 'Nightlife',               icon: Music           },
  { key: 'wellness',          label: 'Wellness',                icon: Leaf            },
  { key: 'budgetLodging',     label: 'Budget Lodging',          icon: BedDouble       },
];

// ── Meal type pill ─────────────────────────────────────────────────────────────

const MEAL_COLORS: Record<string, string> = {
  Breakfast: 'pill-sky',
  Lunch: 'pill-brand',
  Dinner: 'pill-warning',
  Snack: 'pill-default',
  Coffee: 'pill-default',
};

// ── RestCountries types ────────────────────────────────────────────────────────

interface CountryInfo {
  flag: string;         // emoji flag e.g. 🇨🇾
  flagUrl: string;      // PNG URL
  currencyCode: string; // e.g. EUR
  currencyName: string; // e.g. Euro
  currencySymbol: string; // e.g. €
  capital: string;
  region: string;
}

async function fetchCountryInfo(countryName: string): Promise<CountryInfo | null> {
  try {
    const res = await fetch(
      `https://restcountries.com/v3.1/name/${encodeURIComponent(countryName)}?fullText=true&fields=flag,flags,currencies,capital,region`,
    );
    if (!res.ok) throw new Error('not found');
    const [c] = await res.json();
    const [currencyCode, currencyData] = Object.entries(c.currencies)[0] as [string, { name: string; symbol: string }];
    return {
      flag: c.flag,
      flagUrl: c.flags?.png ?? '',
      currencyCode,
      currencyName: currencyData.name,
      currencySymbol: currencyData.symbol,
      capital: c.capital?.[0] ?? '',
      region: c.region ?? '',
    };
  } catch {
    return null;
  }
}

// ── Main screen ────────────────────────────────────────────────────────────────

export function PlanStayScreen() {
  const navigate = useNavigate();
  const legs = useTripStore((s) => s.legs);
  const origin = useTripStore((s) => s.origin);
  const passengers = useTripStore((s) => s.passengers);

  const nonReturnLegs = legs.filter((l) => !l.isReturn);
  const lastLeg = nonReturnLegs.at(-1)!;
  const { destinationIata, destinationCity, destinationCountry, arrivalDatetime, nextDepartureDate, stayDurationDays } =
    lastLeg;

  const crumbs = [origin?.iata ?? '?', ...nonReturnLegs.map((l) => l.destinationIata)];
  const nights = stayDurationDays ?? 1;

  const [data, setData] = useState<DestinationGuide | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [countryInfo, setCountryInfo] = useState<CountryInfo | null>(null);
  const [activeContentTab, setActiveContentTab] = useState(0);
  const [activeDay, setActiveDay] = useState(0);
  const [practicalOpen, setPracticalOpen] = useState(false);
  const [liveRestaurants, setLiveRestaurants] = useState<Restaurant[] | null>(null);
  const [restaurantsLoading, setRestaurantsLoading] = useState(false);
  const handleBack = () => navigate('/review');

  const checkin = arrivalDatetime ? arrivalDatetime.slice(0, 10) : undefined;
  const checkout = nextDepartureDate ?? undefined;

  useEffect(() => {
    if (!destinationCity) return;
    apiClient
      .get<DestinationGuide>('/city-guide', {
        params: {
          city: destinationCity,
          country: destinationCountry,
          ...(checkin && { checkin }),
          ...(checkout && { checkout }),
          passengers,
          nights,
        },
      })
      .then((res) => setData(res.data))
      .catch(() => setFetchError(true));
  }, [destinationCity, destinationCountry, checkin, checkout, passengers]);

  useEffect(() => {
    if (destinationCountry) {
      fetchCountryInfo(destinationCountry).then(setCountryInfo);
    }
  }, [destinationCountry]);

  useEffect(() => {
    if (activeContentTab !== 2 || liveRestaurants !== null || restaurantsLoading) return;
    setRestaurantsLoading(true);
    apiClient
      .get<Restaurant[]>('/restaurants', {
        params: { city: destinationCity, country: destinationCountry },
      })
      .then((res) => setLiveRestaurants(res.data))
      .catch(() => setLiveRestaurants(null))
      .finally(() => setRestaurantsLoading(false));
  }, [activeContentTab, destinationCity, destinationCountry, liveRestaurants, restaurantsLoading]);

  // Loading skeleton
  if (!data && !fetchError) {
    return (
      <div className="px-4 pb-32 pt-4 min-h-screen">
        <StickyReturnBar onBack={handleBack} crumbs={crumbs} currentCity={destinationIata} />
        <div className="animate-pulse space-y-4">
          <div className="rounded-[28px] bg-surface-2 h-36" />
          <div className="rounded-[20px] bg-surface-2 h-24" />
          <div className="rounded-[20px] bg-surface-2 h-24" />
        </div>
      </div>
    );
  }

  const content = data;

  // Fallback for unknown destinations or network errors
  if (!content) {
    return (
      <div className="px-4 pb-32 pt-4">
        <StickyReturnBar onBack={handleBack} crumbs={crumbs} currentCity={destinationIata} />
        <div className="hero-panel mb-5">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={handleBack}
              className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white border border-border hover:bg-indigo-soft hover:border-indigo-border transition-all text-text-muted shrink-0"
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <span className="pill-brand">Planning</span>
          </div>
          <h2 className="text-2xl font-bold text-text-primary mb-1">{destinationCity}</h2>
          <p className="text-sm text-text-muted">
            {fetchError
              ? 'Could not load guide — check your connection.'
              : `We don't have a curated guide for ${destinationCity} yet.`}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface px-5 py-6 text-center space-y-3">
          <Info size={28} className="text-text-muted mx-auto" />
          <p className="text-text-primary font-semibold">Guide coming soon</p>
          <p className="text-sm text-text-muted">
            Search "{destinationCity} things to do" or check Google Maps for highlights near your
            hotel.
          </p>
        </div>
      </div>
    );
  }

  const dayCount = Math.min(nights, content.days.length);

  return (
    <div className="animate-fade-in md:flex md:items-start md:gap-0 md:max-w-6xl md:mx-auto xl:max-w-7xl">
      {/* ── Left panel ── */}
      <div className="px-4 pb-32 pt-4 md:flex-1 md:min-w-0 md:pb-12">
      <StickyReturnBar onBack={handleBack} crumbs={crumbs} currentCity={destinationIata} />

      {/* ── Header ── */}
      <div className="hero-panel mb-6">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={handleBack}
            className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white border border-border hover:bg-indigo-soft hover:border-indigo-border transition-all text-text-muted shrink-0"
            aria-label="Back to your trip"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="pill-brand">Planning</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-[2rem] font-black text-text-primary leading-tight tracking-tight">
            {destinationCity}
          </h2>
          {countryInfo?.flag && (
            <span className="text-[2rem] leading-tight">{countryInfo.flag}</span>
          )}
        </div>
        <p className="text-sm text-text-muted mb-3">
          You're here {formatShortDate(arrivalDatetime)} – {formatShortDate(nextDepartureDate)} ·{' '}
          {nights} night{nights !== 1 ? 's' : ''}
          {countryInfo?.region && (
            <span className="text-text-xmuted"> · {countryInfo.region}</span>
          )}
        </p>
        <div className="rounded-2xl bg-indigo-soft border border-indigo-border px-4 py-3">
          <p className="text-sm text-indigo font-medium leading-relaxed">
            The good stuff, no guesswork.
          </p>
        </div>
      </div>

      {/* ── Stay / Do / Eat tabs ── */}
      <div className="mb-6">
        <div className="section-shell overflow-hidden">
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
                aria-selected={activeContentTab === i}
                onClick={() => setActiveContentTab(i)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-colors ${
                  activeContentTab === i
                    ? 'text-indigo border-b-2 border-indigo bg-indigo-soft/40'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div key={activeContentTab} className="p-4 space-y-3 animate-fade-in">

            {/* Stay */}
            {activeContentTab === 0 && content.hotels.map((hotel) => (
              <div key={hotel.name} className="card">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="text-[15px] font-bold text-text-primary leading-tight flex-1 min-w-0">
                    {hotel.name}
                  </h3>
                  {hotel.priceLevel && (
                    <div className="relative group shrink-0">
                      <span className="text-sm font-semibold text-indigo cursor-default select-none">
                        {hotel.priceLevel}
                      </span>
                      <div className="pointer-events-none absolute right-0 top-6 z-10 w-44 rounded-xl bg-gray-900 px-3 py-2 text-[11px] text-white leading-snug opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-lg">
                        Relative price level based on Google Places — not an actual quote.
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-3">
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
                <p className="text-sm text-text-secondary leading-relaxed mb-4">{hotel.why}</p>
                {hotel.bookingUrl && (
                  <a
                    href={hotel.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-border bg-indigo-soft px-4 py-2 text-sm font-semibold text-indigo hover:bg-indigo hover:text-white hover:border-indigo transition-all duration-150 active:scale-[0.98]"
                    style={{ minHeight: '36px' }}
                    aria-label={`Check availability for ${hotel.name}`}
                  >
                    Check availability <ExternalLink size={13} />
                  </a>
                )}
              </div>
            ))}

            {/* Do — categorised view */}
            {activeContentTab === 1 && (
              <div className="space-y-5">
                {DO_CATEGORIES.map(({ key, label, icon: Icon }) => {
                  const places = content.doCategories?.[key] ?? [];
                  if (places.length === 0) return null;
                  return (
                    <div key={key}>
                      {/* Category header */}
                      <div className="flex items-center gap-2 mb-2.5 px-1">
                        <div className="w-6 h-6 rounded-lg bg-indigo-soft border border-indigo-border flex items-center justify-center shrink-0">
                          <Icon size={12} className="text-indigo" />
                        </div>
                        <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-text-muted">
                          {label}
                        </span>
                      </div>

                      {/* Places under this category */}
                      <div className="space-y-2">
                        {places.map((place) => (
                          <div
                            key={place.name}
                            className="rounded-[18px] border border-border bg-surface px-4 py-3"
                            style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.04)' }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h4 className="text-[14px] font-semibold text-text-primary leading-tight">
                                  {place.name}
                                </h4>
                                {place.type && (
                                  <p className="text-[11px] text-text-muted mt-0.5">{place.type}</p>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0 mt-0.5">
                                {place.priceLevel && (
                                  <span className="text-sm font-semibold text-indigo">
                                    {place.priceLevel}
                                  </span>
                                )}
                                {place.lat != null && place.lng != null && (
                                  <a
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 rounded-lg bg-indigo-soft border border-indigo-border px-2 py-1 text-[11px] font-semibold text-indigo hover:bg-indigo hover:text-white hover:border-indigo transition-all duration-150 active:scale-[0.97]"
                                    aria-label={`Get directions to ${place.name}`}
                                  >
                                    <Navigation size={11} />
                                    Go
                                  </a>
                                )}
                              </div>
                            </div>

                            {(place.rating != null || place.address) && (
                              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-text-muted">
                                {place.rating != null && (
                                  <span>
                                    ⭐ {place.rating.toFixed(1)}
                                    {place.reviewCount != null && (
                                      <span className="text-text-xmuted">
                                        {' '}({place.reviewCount.toLocaleString()})
                                      </span>
                                    )}
                                  </span>
                                )}
                                {place.address && (
                                  <span className="truncate text-text-xmuted">
                                    {place.address.split(',')[0]}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Eat */}
            {activeContentTab === 2 && (
              restaurantsLoading ? (
                <div className="space-y-3 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-[20px] bg-surface-2 h-20" />
                  ))}
                </div>
              ) : (liveRestaurants ?? content.restaurants).map((r) => (
                <div
                  key={r.name}
                  className="rounded-[20px] border border-border bg-surface px-4 py-3.5"
                  style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.04)' }}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`${MEAL_COLORS[r.mealType] ?? 'pill-default'} text-[10px] shrink-0`}>
                        {r.mealType}
                      </span>
                      <h4 className="text-sm font-semibold text-text-primary truncate">{r.name}</h4>
                    </div>
                    {(r.rating || r.priceLevel) && (
                      <div className="flex items-center gap-1.5 shrink-0 text-[11px] text-text-muted">
                        {r.rating && <span>⭐ {r.rating.toFixed(1)}</span>}
                        {r.priceLevel && <span className="text-text-xmuted">{r.priceLevel}</span>}
                      </div>
                    )}
                  </div>
                  {r.description && !r.description.startsWith('Rated') && r.description !== 'Local favourite' && (
                    <p className="text-xs text-text-muted leading-relaxed">{r.description}</p>
                  )}
                </div>
              ))
            )}

          </div>
        </div>
      </div>
      </div>{/* end left panel */}

      {/* ── Right panel: day planner + practical ── */}
      <div className="px-4 pb-12 pt-4 md:w-[320px] lg:w-[360px] xl:w-[400px] md:flex-shrink-0 md:border-l md:border-border/50 md:sticky md:top-0 md:max-h-screen md:overflow-y-auto">

      {/* ── Day-by-day sketch ── */}
      {dayCount > 0 && (
        <div className="mb-6">
          <div className="section-shell overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60">
              <div className="flex items-center gap-2">
                <span className="text-indigo">
                  <Info size={14} />
                </span>
                <p className="text-[0.7rem] font-bold tracking-[0.22em] uppercase text-text-muted">
                  Your {dayCount} {dayCount === 1 ? 'day' : 'days'} in{' '}
                  <span className="text-indigo normal-case">{destinationCity}</span>
                  , sketched out
                </p>
              </div>
            </div>

            {/* Day accordion */}
            <div className="divide-y divide-border/60">
              {Array.from({ length: dayCount }).map((_, i) => {
                const isOpen = activeDay === i;
                const dayData = content.days[i];
                return (
                  <div key={i}>
                    <button
                      onClick={() => setActiveDay(isOpen ? -1 : i)}
                      className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-surface-2/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`text-sm font-semibold shrink-0 ${isOpen ? 'text-indigo' : 'text-text-secondary'}`}>
                          Day {i + 1}
                        </span>
                        {dayData?.title && (
                          <span className="text-xs text-text-muted truncate">{dayData.title}</span>
                        )}
                      </div>
                      <ChevronDown
                        size={16}
                        className={`shrink-0 ml-2 text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo' : ''}`}
                      />
                    </button>
                    {isOpen && (
                      <div key={i} className="px-5 pb-4 pt-1 space-y-3 animate-fade-in">
                        {dayData?.slots.map((slot, j) => (
                          <div key={j} className="flex items-start gap-3">
                            <span className="text-[10px] font-semibold text-text-xmuted uppercase tracking-wide w-16 shrink-0 pt-0.5">
                              {slot.time}
                            </span>
                            <p className="text-sm text-text-secondary flex-1">{slot.activity}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Practical info (collapsed) ── */}
      <div className="mb-6">
        <div className="section-shell overflow-hidden">
          <button
            className="w-full px-5 py-4 flex items-center justify-between text-left transition-colors hover:bg-surface-2/50"
            onClick={() => setPracticalOpen((v) => !v)}
            aria-expanded={practicalOpen}
            aria-controls="practical-content"
            style={{ minHeight: '44px' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-indigo">
                <Info size={14} />
              </span>
              <p className="text-[0.7rem] font-bold tracking-[0.22em] uppercase text-text-muted">
                Practical info
              </p>
            </div>
            <div
              className={`transition-transform duration-200 ${practicalOpen ? 'rotate-180' : 'rotate-0'}`}
            >
              <ChevronDown size={16} className="text-text-muted" />
            </div>
          </button>

          <div
            id="practical-content"
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              practicalOpen ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'
            }`}
            aria-hidden={!practicalOpen}
          >
            <div className="px-5 pb-5 border-t border-border/60">
              <div className="grid grid-cols-2 gap-2 mt-4 mb-3">
                {/* Currency — live from RestCountries, fallback to static */}
                <div className="rounded-xl bg-[#F8FAFF] border border-border/60 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-text-muted mb-1">
                    Currency
                  </p>
                  {countryInfo ? (
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        {countryInfo.currencySymbol} {countryInfo.currencyCode}
                      </p>
                      <p className="text-[11px] text-text-muted">{countryInfo.currencyName}</p>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-text-primary">
                      {content.practical.currency}
                    </p>
                  )}
                </div>
                <div className="rounded-xl bg-[#F8FAFF] border border-border/60 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-text-muted mb-1">
                    SIM / Data
                  </p>
                  <p className="text-sm font-semibold text-text-primary">{content.practical.sim}</p>
                </div>
              </div>
              <div className="rounded-xl bg-[#F8FAFF] border border-border/60 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wide text-text-muted mb-1">
                  Getting around
                </p>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {content.practical.transport}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>{/* end right panel */}
    </div>
  );
}
