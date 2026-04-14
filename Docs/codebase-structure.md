# Codebase Scaffold Plan — Trip Planner MVP

---

## 0. MVP Alignment Status

For the current MVP, use [\_docs_product-definition.md](/Users/harut/Desktop/Fast-Travel-Assistant/Docs/_docs_product-definition.md) and [prd-alignment-decisions.md](/Users/harut/Desktop/Fast-Travel-Assistant/Docs/prd-alignment-decisions.md) as the source of truth.

Current alignment:

- URL-encoded trip state is the MVP source of truth
- Shared trips should restore from the URL itself
- Expiring server-side itinerary sessions are not required for the first implementation pass
- Final itinerary should keep per-leg booking only

---

## 1. Full Folder Structure — Frontend

```
frontend/
├── public/
│   ├── favicon.ico
│   └── manifest.json
│
├── src/
│   ├── api/                          # HTTP layer — one file per domain
│   │   ├── client.ts                 # Axios instance, base URL, interceptors
│   │   ├── airports.api.ts
│   │   ├── flights.api.ts
│   │   ├── weather.api.ts
│   │   └── itineraries.api.ts
│   │
│   ├── components/                   # Reusable UI components
│   │   ├── ui/                       # Primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Spinner.tsx
│   │   │   ├── Toast.tsx
│   │   │   └── Skeleton.tsx
│   │   │
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx         # Progress bar slot + scroll area + CTA slot
│   │   │   ├── ScreenHeader.tsx      # Back arrow + title
│   │   │   └── StickyFooter.tsx      # Sticky bottom CTA wrapper
│   │   │
│   │   ├── airports/
│   │   │   ├── AirportSearch.tsx     # Search input + suggestion list combined
│   │   │   ├── AirportSuggestionList.tsx
│   │   │   └── NearbyAirportPills.tsx
│   │   │
│   │   ├── flights/
│   │   │   ├── FlightCard.tsx
│   │   │   ├── FlightCardList.tsx
│   │   │   ├── SkeletonCard.tsx
│   │   │   ├── DateSwitcher.tsx
│   │   │   └── WeatherWidget.tsx
│   │   │
│   │   ├── trip/
│   │   │   ├── TripProgressBar.tsx
│   │   │   ├── TripChainCollapsible.tsx
│   │   │   ├── ConfirmedFlightBanner.tsx
│   │   │   ├── StayDurationStepper.tsx
│   │   │   ├── DepartureDatePreview.tsx
│   │   │   └── RecommendationText.tsx
│   │   │
│   │   └── itinerary/
│   │       ├── ItineraryHeader.tsx
│   │       ├── TabToggle.tsx
│   │       ├── TimelineView.tsx
│   │       ├── TimelineFlightRow.tsx
│   │       ├── TimelineStayRow.tsx
│   │       ├── TotalPriceRow.tsx
│   │       ├── BookButton.tsx
│   │       ├── MapView.tsx
│   │       └── MapPinTooltip.tsx
│   │
│   ├── screens/                      # One folder per screen
│   │   ├── HomeScreen/
│   │   │   └── index.tsx
│   │   ├── FlightResultsScreen/
│   │   │   ├── index.tsx
│   │   │   └── FlightResultsScreen.hooks.ts
│   │   ├── StayDurationScreen/
│   │   │   └── index.tsx
│   │   ├── DecisionScreen/
│   │   │   └── index.tsx
│   │   ├── ReturnFlightsScreen/
│   │   │   └── index.tsx
│   │   └── ItineraryScreen/
│   │       ├── index.tsx
│   │       └── ItineraryScreen.hooks.ts
│   │
│   ├── hooks/                        # Custom React hooks
│   │   ├── useAirportSearch.ts
│   │   ├── useFlightSearch.ts
│   │   ├── useWeatherBatch.ts
│   │   ├── useDateSwitcher.ts
│   │   ├── useItinerary.ts
│   │   └── useToast.ts
│   │
│   ├── store/                        # Zustand stores
│   │   ├── trip.store.ts             # Core trip chain state + URL sync
│   │   └── session.store.ts          # Ephemeral UI state (loading, results, etc.)
│   │
│   ├── utils/                        # Pure functions, no side effects
│   │   ├── date.utils.ts             # addDays, formatDate, dateOnly, etc.
│   │   ├── price.utils.ts            # calculateTotalPrice, formatPrice
│   │   ├── itinerary.utils.ts        # buildItinerarySummary
│   │   ├── timeline.utils.ts         # buildTimelineItems
│   │   ├── map.utils.ts              # buildMapData, computeBounds
│   │   └── url.utils.ts              # encodeTrip, decodeTrip (lz-string wrappers)
│   │
│   ├── constants/
│   │   ├── stayRecommendations.ts    # { [iata]: { days, text } }
│   │   └── config.ts                 # VITE_ env vars with type safety
│   │
│   ├── types/                        # FE-only types (not shared)
│   │   ├── search-session.ts         # AppScreen, SearchSession
│   │   ├── itinerary-summary.ts      # ItinerarySummary, MapPin
│   │   └── date-switcher.ts          # DateSwitcher
│   │
│   ├── App.tsx                       # Screen-state app shell + providers + hydration
│   ├── main.tsx                      # React DOM render entry
│   └── router.tsx                    # BrowserRouter wrapper only; flow is screen-state driven
│
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
├── tsconfig.node.json
├── .env.example
├── .env.local                        # gitignored
└── package.json
```

---

## 2. Full Folder Structure — Backend

```
backend/
├── src/
│   ├── routes/                       # Thin Fastify route handlers
│   │   ├── airports.route.ts
│   │   ├── flights.route.ts
│   │   ├── weather.route.ts
│   │   ├── itineraries.route.ts
│   │   └── health.route.ts
│   │
│   ├── services/                     # Business logic — provider-agnostic
│   │   ├── airport.service.ts
│   │   ├── flight.service.ts
│   │   ├── weather.service.ts
│   │   └── itinerary.service.ts
│   │
│   ├── providers/                    # External API adapters
│   │   ├── flights/
│   │   │   ├── flight.provider.ts    # FlightProvider interface
│   │   │   ├── SerpApiFlightProvider.ts # Primary: SerpAPI Google Flights
│   │   │   ├── kiwi.adapter.ts          # Fallback: Kiwi/Tequila
│   │   │   ├── kiwi.types.ts            # Raw Kiwi API response types
│   │   │   └── mock.adapter.ts          # Last-resort fallback: returns static data
│   │   │
│   │   └── weather/
│   │       ├── weather.provider.ts   # WeatherProvider interface
│   │       ├── openweathermap.adapter.ts
│   │       ├── owm.types.ts          # Raw OWM API response types
│   │       └── mock.adapter.ts       # Mock: returns static weather
│   │
│   ├── schemas/                      # Zod validation schemas
│   │   ├── airports.schema.ts
│   │   ├── flights.schema.ts
│   │   ├── weather.schema.ts
│   │   └── itineraries.schema.ts
│   │
│   ├── data/
│   │   ├── airports.json             # Static airport dataset (~7k entries)
│   │   └── stayRecommendations.json  # { [iata]: { days: number, text: string } }
│   │
│   ├── utils/
│   │   ├── haversine.ts              # Distance between two lat/lng points
│   │   ├── cache.ts                  # node-cache wrapper with typed get/set
│   │   ├── date.utils.ts             # addDays, dateOnly (server-side)
│   │   └── response.ts               # buildSuccess(), buildError() envelope helpers
│   │
│   ├── types/                        # BE-only internal types
│   │   └── itinerary-store.ts        # In-memory itinerary store type
│   │
│   ├── config.ts                     # Zod-validated env config (single source of truth)
│   ├── app.ts                        # Fastify app factory — registers plugins + routes
│   └── server.ts                     # Entry point — calls app.listen()
│
├── tests/
│   ├── services/
│   │   ├── flight.service.test.ts
│   │   ├── weather.service.test.ts
│   │   └── itinerary.service.test.ts
│   ├── providers/
│   │   └── SerpApiFlightProvider.test.ts
│   └── routes/
│       └── flights.route.test.ts
│
├── tsconfig.json
├── .env.example
├── .env.local                        # gitignored
└── package.json
```

---

## 3. Shared Types Folder

```
packages/
└── shared/
    ├── types/
    │   ├── index.ts                  # Re-exports everything
    │   ├── city.ts
    │   ├── airport.ts
    │   ├── flight.ts                 # FlightOption, FlightSearchParams, FlightProvider
    │   ├── weather.ts                # WeatherSummary, WeatherRequest, WeatherProvider
    │   ├── trip-leg.ts               # TripLeg, TripLegInput
    │   └── itinerary.ts              # Itinerary, ItineraryStatus
    │
    └── package.json
```

```json
// packages/shared/package.json
{
  "name": "@trip-planner/shared",
  "version": "1.0.0",
  "main": "./types/index.ts",
  "types": "./types/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```

```json
// root package.json
{
  "name": "trip-planner",
  "private": true,
  "workspaces": ["packages/shared", "frontend", "backend"],
  "scripts": {
    "dev": "concurrently \"npm run dev -w backend\" \"npm run dev -w frontend\"",
    "typecheck": "npm run typecheck -w packages/shared && npm run typecheck -w backend && npm run typecheck -w frontend",
    "lint": "npm run lint -w backend && npm run lint -w frontend"
  }
}
```

---

## 4. Key Modules

### Backend — `app.ts`

```typescript
// backend/src/app.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { healthRoute } from './routes/health.route';
import { airportsRoute } from './routes/airports.route';
import { flightsRoute } from './routes/flights.route';
import { weatherRoute } from './routes/weather.route';
import { itinerariesRoute } from './routes/itineraries.route';
import { AirportService } from './services/airport.service';
import { FlightService } from './services/flight.service';
import { WeatherService } from './services/weather.service';
import { ItineraryService } from './services/itinerary.service';
import { SerpApiFlightProvider } from './providers/flights/SerpApiFlightProvider';
import { KiwiFlightProvider } from './providers/flights/kiwi.adapter';
import { MockFlightProvider } from './providers/flights/mock.adapter';
import { OpenWeatherMapProvider } from './providers/weather/openweathermap.adapter';
import { MockWeatherProvider } from './providers/weather/mock.adapter';

export async function buildApp() {
  const app = Fastify({ logger: true });

  // Plugins
  await app.register(cors, { origin: config.FRONTEND_URL });
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

  // Provider selection: SerpAPI (primary) → Kiwi (fallback) → Mock (dev)
  const flightProvider = config.SERPAPI_API_KEY
    ? new SerpApiFlightProvider(config.SERPAPI_API_KEY)
    : config.KIWI_API_KEY
      ? new KiwiFlightProvider(config.KIWI_API_KEY)
      : new MockFlightProvider();

  const weatherProvider = config.USE_MOCK_WEATHER
    ? new MockWeatherProvider()
    : new OpenWeatherMapProvider(config.OWM_API_KEY);

  // Services (dependency injection)
  const airportService = new AirportService();
  const flightService = new FlightService(flightProvider);
  const weatherService = new WeatherService(weatherProvider);
  const itineraryService = new ItineraryService(flightService);

  // Routes
  await app.register(healthRoute);
  await app.register(airportsRoute, { airportService });
  await app.register(flightsRoute, { flightService });
  await app.register(weatherRoute, { weatherService });
  await app.register(itinerariesRoute, { itineraryService, flightService });

  return app;
}
```

### Backend — `config.ts`

```typescript
// backend/src/config.ts
import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();

const envSchema = z.object({
  NODE_ENV:         z.enum(['development', 'production', 'test']).default('development'),
  PORT:             z.string().default('3001'),
  FRONTEND_URL:     z.string().url(),
  SERPAPI_API_KEY:  z.string().default(''),   // Primary flight provider
  KIWI_API_KEY:     z.string().default(''),   // Fallback flight provider
  OWM_API_KEY:      z.string().default(''),
  AIRHEX_API_KEY:   z.string().default(''),
  USE_MOCK_WEATHER: z.string().transform(v => v === 'true').default('false'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
```

### Backend — `cache.ts`

```typescript
// backend/src/utils/cache.ts
import NodeCache from 'node-cache';

const cache = new NodeCache();

export function cacheGet<T>(key: string): T | undefined {
  return cache.get<T>(key);
}

export function cacheSet<T>(key: string, value: T, ttlSeconds: number): void {
  cache.set(key, value, ttlSeconds);
}

export function cacheDelete(key: string): void {
  cache.del(key);
}
```

### Backend — `response.ts`

```typescript
// backend/src/utils/response.ts
export function buildSuccess<T>(data: T) {
  return { success: true, data };
}

export function buildError(code: string, message: string, retryable = false) {
  return { success: false, error: { code, message, retryable } };
}
```

### Frontend — `api/client.ts`

```typescript
// frontend/src/api/client.ts
import axios from 'axios';
import { config } from '../constants/config';

export const apiClient = axios.create({
  baseURL: config.API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Unwrap the success envelope automatically
apiClient.interceptors.response.use(
  (response) => {
    if (response.data?.success === true) {
      return { ...response, data: response.data.data };
    }
    return response;
  },
  (error) => {
    const message = error.response?.data?.error?.message ?? 'Something went wrong';
    const code = error.response?.data?.error?.code ?? 'UNKNOWN_ERROR';
    const retryable = error.response?.data?.error?.retryable ?? false;
    return Promise.reject({ message, code, retryable, status: error.response?.status });
  }
);
```

### Frontend — `constants/config.ts`

```typescript
// frontend/src/constants/config.ts
export const config = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL as string,
  APP_ENV:      import.meta.env.VITE_APP_ENV as string ?? 'development',
} as const;
```

---

## 5. Key Services

### `FlightService` (backend)

```typescript
// backend/src/services/flight.service.ts
import type { FlightProvider, FlightOption, FlightSearchParams } from '@trip-planner/shared';
import { cacheGet, cacheSet } from '../utils/cache';

const CACHE_TTL = 300; // 5 minutes

export class FlightService {
  constructor(private readonly provider: FlightProvider) {}

  async getCheapestFlights(params: FlightSearchParams): Promise<FlightOption[]> {
    const key = this.buildCacheKey(params);
    const cached = cacheGet<FlightOption[]>(key);
    if (cached) return cached;

    const raw = await this.provider.searchFlights(params);
    const deduplicated = this.deduplicateByDestination(raw);
    const sorted = this.sortByPriceThenDuration(deduplicated);
    const results = sorted.slice(0, 10);

    cacheSet(key, results, CACHE_TTL);
    return results;
  }

  private deduplicateByDestination(flights: FlightOption[]): FlightOption[] {
    const map = new Map<string, FlightOption>();
    for (const flight of flights) {
      const existing = map.get(flight.destinationIata);
      if (!existing || flight.priceUsd < existing.priceUsd) {
        map.set(flight.destinationIata, flight);
      }
    }
    return Array.from(map.values());
  }

  private sortByPriceThenDuration(flights: FlightOption[]): FlightOption[] {
    return [...flights].sort((a, b) => {
      if (a.priceUsd !== b.priceUsd) return a.priceUsd - b.priceUsd;
      return a.durationMinutes - b.durationMinutes;
    });
  }

  private buildCacheKey(params: FlightSearchParams): string {
    return `flights:${params.originIata}:${params.date}:${params.destinationIata ?? 'any'}`;
  }
}
```

### `ItineraryService` (backend)

```typescript
// backend/src/services/itinerary.service.ts
import { randomUUID } from 'crypto';
import type { Itinerary, TripLeg } from '@trip-planner/shared';
import { FlightService } from './flight.service';
import { cacheGet, cacheSet } from '../utils/cache';
import { addDays, dateOnly } from '../utils/date.utils';

const PLANNING_TTL = 60 * 60 * 24;       // 24 hours
const COMPLETE_TTL = 60 * 60 * 24 * 30;  // 30 days
const MAX_STOPS = 15;

export class ItineraryService {
  constructor(private readonly flightService: FlightService) {}

  create(origin: Itinerary['origin'], departureDate: string): Itinerary & { id: string } {
    const id = randomUUID();
    const itinerary = {
      id,
      origin,
      legs: [],
      status: 'planning' as const,
      createdAt: new Date().toISOString(),
    };
    cacheSet(`itinerary:${id}`, itinerary, PLANNING_TTL);
    return itinerary;
  }

  get(id: string): (Itinerary & { id: string }) | null {
    return cacheGet(`itinerary:${id}`) ?? null;
  }

  addLeg(id: string, leg: TripLeg): TripLeg {
    const itinerary = this.getOrThrow(id);
    this.validateLeg(itinerary, leg);
    itinerary.legs.push(leg);
    cacheSet(`itinerary:${id}`, itinerary, PLANNING_TTL);
    return leg;
  }

  setStay(id: string, stopIndex: number, stayDurationDays: number) {
    const itinerary = this.getOrThrow(id);
    const leg = itinerary.legs.find(l => l.stopIndex === stopIndex);
    if (!leg) throw new Error('LEG_NOT_FOUND');

    leg.stayDurationDays = stayDurationDays;
    leg.nextDepartureDate = addDays(dateOnly(leg.arrivalDatetime), stayDurationDays);

    cacheSet(`itinerary:${id}`, itinerary, PLANNING_TTL);
    return leg;
  }

  finalize(id: string) {
    const itinerary = this.getOrThrow(id);
    this.validateFinalize(itinerary);
    itinerary.status = 'complete';
    (itinerary as any).completedAt = new Date().toISOString();
    cacheSet(`itinerary:${id}`, itinerary, COMPLETE_TTL);
    return itinerary;
  }

  private getOrThrow(id: string) {
    const it = this.get(id);
    if (!it) throw new Error('ITINERARY_NOT_FOUND');
    return it;
  }

  private validateLeg(itinerary: Itinerary, leg: TripLeg) {
    const nonReturnLegs = itinerary.legs.filter(l => !l.isReturn);
    if (!leg.isReturn && nonReturnLegs.length >= MAX_STOPS) {
      throw new Error('MAX_DESTINATIONS_REACHED');
    }
    const expectedOrigin = itinerary.legs.length === 0
      ? itinerary.origin.iata
      : itinerary.legs[itinerary.legs.length - 1].destinationIata;
    if (leg.originIata !== expectedOrigin) {
      throw new Error('ORIGIN_CONTINUITY_ERROR');
    }
  }

  private validateFinalize(itinerary: Itinerary) {
    if (itinerary.legs.length < 2) throw new Error('INSUFFICIENT_LEGS');
    const lastLeg = itinerary.legs[itinerary.legs.length - 1];
    if (!lastLeg.isReturn) throw new Error('MISSING_RETURN_LEG');
  }
}
```

### `AirportService` (backend)

```typescript
// backend/src/services/airport.service.ts
import airportsData from '../data/airports.json';
import type { Airport } from '@trip-planner/shared';
import { haversine } from '../utils/haversine';

const airports: Airport[] = airportsData as Airport[];

export class AirportService {
  search(query: string, limit = 7): Airport[] {
    const q = query.trim().toUpperCase();
    if (q.length < 2) return [];

    const scored: Array<{ airport: Airport; score: number }> = [];
    const seen = new Set<string>();

    for (const airport of airports) {
      const iata = airport.iata.toUpperCase();
      const city = airport.city.name.toUpperCase();
      const name = airport.name.toUpperCase();

      let score = 0;
      if (iata === q) score = 100;
      else if (city.startsWith(q) || name.startsWith(q)) score = 80;
      else if (city.includes(q) || name.includes(q)) score = 60;

      if (score > 0 && !seen.has(airport.iata)) {
        scored.push({ airport, score });
        seen.add(airport.iata);
      }
    }

    return scored
      .sort((a, b) => b.score - a.score || a.airport.city.name.localeCompare(b.airport.city.name))
      .slice(0, limit)
      .map(s => s.airport);
  }

  findNearby(iata: string, radiusKm = 150, limit = 3): Airport[] {
    const origin = airports.find(a => a.iata === iata);
    if (!origin) return [];

    return airports
      .filter(a => a.iata !== iata)
      .map(a => ({
        airport: a,
        distanceKm: haversine(origin.city.lat, origin.city.lng, a.city.lat, a.city.lng),
      }))
      .filter(({ distanceKm }) => distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit)
      .map(({ airport, distanceKm }) => ({ ...airport, distanceKm }));
  }
}
```

---

## 6. Key Components

### `FlightCard` (frontend)

```tsx
// frontend/src/components/flights/FlightCard.tsx
import type { FlightOption } from '@trip-planner/shared';
import { WeatherWidget } from './WeatherWidget';
import { formatDuration, formatTime, formatStops } from '../../utils/date.utils';

interface FlightCardProps {
  flight: FlightOption;
  onSelect: (flight: FlightOption) => void;
  isSelected?: boolean;
}

export function FlightCard({ flight, onSelect, isSelected = false }: FlightCardProps) {
  return (
    <button
      onClick={() => onSelect(flight)}
      className={`
        w-full text-left p-4 rounded-lg border transition-all
        ${isSelected
          ? 'border-accent bg-accent/5 border-2'
          : 'border-border bg-surface hover:border-border-hover active:scale-[0.98]'
        }
      `}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-lg font-semibold text-primary truncate max-w-[180px]">
            {flight.destinationCity}
          </p>
          <p className="text-xs text-muted">{flight.destinationCountry}</p>
        </div>
        <p className="font-mono text-xl font-bold text-accent">${flight.priceUsd}</p>
      </div>

      <div className="h-px bg-border my-2" />

      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-sm text-primary">
            {formatTime(flight.departureDatetime)} → {formatTime(flight.arrivalDatetime)}
            <span className="text-muted ml-2">{formatDuration(flight.durationMinutes)}</span>
            <span className="text-muted ml-2">{formatStops(flight.stops)}</span>
          </p>
          <p className="text-xs text-muted mt-0.5">{flight.airlineName}</p>
        </div>
        {flight.weather && <WeatherWidget weather={flight.weather} />}
      </div>
    </button>
  );
}
```

### `TripProgressBar` (frontend)

```tsx
// frontend/src/components/trip/TripProgressBar.tsx
import { useTripStore } from '../../store/trip.store';

const MAX_STOPS = 15;

export function TripProgressBar() {
  const { origin, stops } = useTripStore();
  if (!origin) return null;

  const confirmedCount = stops.filter(s => !s.isReturn).length;

  return (
    <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border px-4 py-2">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          <span className="font-mono text-xs text-muted shrink-0">{origin.iata}</span>
          {stops.filter(s => !s.isReturn).map(stop => (
            <span key={stop.stopIndex} className="flex items-center gap-1 shrink-0">
              <span className="text-muted text-xs">→</span>
              <span className="font-mono text-xs text-accent">{stop.destinationIata}</span>
            </span>
          ))}
          {confirmedCount < MAX_STOPS && (
            <span className="flex items-center gap-1 shrink-0">
              <span className="text-muted text-xs">→</span>
              <span className="font-mono text-xs text-muted animate-pulse">?</span>
            </span>
          )}
        </div>
        <span className="text-xs text-muted shrink-0 ml-2">
          {confirmedCount}/{MAX_STOPS}
        </span>
      </div>

      {/* Dot progress */}
      <div className="flex gap-1">
        {Array.from({ length: MAX_STOPS }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < confirmedCount ? 'bg-accent' : 'bg-border'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
```

### `AppLayout` (frontend)

```tsx
// frontend/src/components/layout/AppLayout.tsx
import { TripProgressBar } from '../trip/TripProgressBar';

interface AppLayoutProps {
  children: React.ReactNode;
  showProgress?: boolean;
  footer?: React.ReactNode;
}

export function AppLayout({ children, showProgress = false, footer }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {showProgress && <TripProgressBar />}
      <main className="flex-1 overflow-y-auto px-4 pb-4">
        {children}
      </main>
      {footer && (
        <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border p-4 safe-area-bottom">
          {footer}
        </div>
      )}
    </div>
  );
}
```

---

## 7. Route / Page Structure

### Frontend Screen Flow

Current localhost behavior uses screen state in the app shell rather than a page-per-screen router.

```tsx
// frontend/src/App.tsx
{screen === 'home' && <HomeScreen />}
{screen === 'flight-results' && <FlightResultsScreen />}
{screen === 'stay-duration' && <StayDurationScreen />}
{screen === 'decision' && <DecisionScreen />}
{screen === 'return-flights' && <ReturnFlightsScreen />}
{screen === 'itinerary' && <ItineraryScreen />}
{screen === 'booking-review' && <BookingReviewScreen />}
```

### Backend Routes

```typescript
// backend/src/routes/flights.route.ts
import type { FastifyPluginAsync } from 'fastify';
import { FlightSearchSchema } from '../schemas/flights.schema';
import type { FlightService } from '../services/flight.service';
import { buildSuccess, buildError } from '../utils/response';

interface FlightsRouteOptions {
  flightService: FlightService;
}

export const flightsRoute: FastifyPluginAsync<FlightsRouteOptions> = async (app, opts) => {
  app.get('/flights/search', { schema: { querystring: FlightSearchSchema } }, async (req, reply) => {
    const { originIata, date, destinationIata, currency = 'USD' } = req.query as any;

    try {
      const flights = await opts.flightService.getCheapestFlights({
        originIata, date, destinationIata, adults: 1, currency,
      });
      return buildSuccess({ flights, searchMeta: { originIata, date, resultCount: flights.length } });
    } catch (err: any) {
      if (err.code === 'FLIGHT_API_TIMEOUT') {
        return reply.status(504).send(buildError('FLIGHT_API_TIMEOUT', 'Flight search timed out.', true));
      }
      return reply.status(502).send(buildError('FLIGHT_API_ERROR', 'Flight search unavailable.', true));
    }
  });
};
```

---

## 8. Provider Interface Files

```typescript
// packages/shared/types/flight.ts
export interface FlightProvider {
  searchFlights(params: FlightSearchParams): Promise<FlightOption[]>;
}

export interface FlightSearchParams {
  originIata: string;
  date: string;
  destinationIata?: string;
  adults: number;
  currency: string;
}
```

```typescript
// packages/shared/types/weather.ts
export interface WeatherProvider {
  getWeather(lat: number, lng: number, date: string): Promise<WeatherSummary>;
}
```

```typescript
// backend/src/providers/flights/flight.provider.ts
// Re-export from shared for clean internal imports
export type { FlightProvider, FlightSearchParams } from '@trip-planner/shared';
```

---

## 9. Mock Provider Files

```typescript
// backend/src/providers/flights/mock.adapter.ts
import type { FlightProvider, FlightSearchParams, FlightOption } from '@trip-planner/shared';

const MOCK_FLIGHTS: FlightOption[] = [
  {
    flightId: 'mock_001',
    originIata: 'BCN', originCity: 'Barcelona',
    destinationIata: 'LIS', destinationCity: 'Lisbon',
    destinationCountry: 'Portugal',
    destinationLat: 38.7749, destinationLng: -9.1342,
    departureDatetime: '2025-05-10T06:00:00Z',
    arrivalDatetime: '2025-05-10T07:45:00Z',
    durationMinutes: 105,
    airlineName: 'Ryanair', stops: 0,
    priceUsd: 34,
    bookingUrl: 'https://www.google.com/flights',
  },
  {
    flightId: 'mock_002',
    originIata: 'BCN', originCity: 'Barcelona',
    destinationIata: 'MAD', destinationCity: 'Madrid',
    destinationCountry: 'Spain',
    destinationLat: 40.4168, destinationLng: -3.7038,
    departureDatetime: '2025-05-10T08:30:00Z',
    arrivalDatetime: '2025-05-10T09:35:00Z',
    durationMinutes: 65,
    airlineName: 'Vueling', stops: 0,
    priceUsd: 41,
    bookingUrl: 'https://www.google.com/flights',
  },
  {
    flightId: 'mock_003',
    originIata: 'BCN', originCity: 'Barcelona',
    destinationIata: 'FCO', destinationCity: 'Rome',
    destinationCountry: 'Italy',
    destinationLat: 41.9028, destinationLng: 12.4964,
    departureDatetime: '2025-05-10T07:15:00Z',
    arrivalDatetime: '2025-05-10T09:30:00Z',
    durationMinutes: 135,
    airlineName: 'Volotea', stops: 0,
    priceUsd: 57,
    bookingUrl: 'https://www.google.com/flights',
  },
  {
    flightId: 'mock_004',
    originIata: 'BCN', originCity: 'Barcelona',
    destinationIata: 'PRG', destinationCity: 'Prague',
    destinationCountry: 'Czech Republic',
    destinationLat: 50.0755, destinationLng: 14.4378,
    departureDatetime: '2025-05-10T09:45:00Z',
    arrivalDatetime: '2025-05-10T12:30:00Z',
    durationMinutes: 165,
    airlineName: 'Wizz Air', stops: 0,
    priceUsd: 62,
    bookingUrl: 'https://www.google.com/flights',
  },
  {
    flightId: 'mock_005',
    originIata: 'BCN', originCity: 'Barcelona',
    destinationIata: 'BUD', destinationCity: 'Budapest',
    destinationCountry: 'Hungary',
    destinationLat: 47.4979, destinationLng: 19.0402,
    departureDatetime: '2025-05-10T11:00:00Z',
    arrivalDatetime: '2025-05-10T13:55:00Z',
    durationMinutes: 175,
    airlineName: 'Ryanair', stops: 0,
    priceUsd: 68,
    bookingUrl: 'https://www.google.com/flights',
  },
  {
    flightId: 'mock_006',
    originIata: 'BCN', originCity: 'Barcelona',
    destinationIata: 'ATH', destinationCity: 'Athens',
    destinationCountry: 'Greece',
    destinationLat: 37.9838, destinationLng: 23.7275,
    departureDatetime: '2025-05-10T06:30:00Z',
    arrivalDatetime: '2025-05-10T10:15:00Z',
    durationMinutes: 225,
    airlineName: 'Aegean', stops: 0,
    priceUsd: 74,
    bookingUrl: 'https://www.google.com/flights',
  },
  {
    flightId: 'mock_007',
    originIata: 'BCN', originCity: 'Barcelona',
    destinationIata: 'WAW', destinationCity: 'Warsaw',
    destinationCountry: 'Poland',
    destinationLat: 52.2297, destinationLng: 21.0122,
    departureDatetime: '2025-05-10T13:20:00Z',
    arrivalDatetime: '2025-05-10T16:45:00Z',
    durationMinutes: 205,
    airlineName: 'LOT', stops: 0,
    priceUsd: 79,
    bookingUrl: 'https://www.google.com/flights',
  },
  {
    flightId: 'mock_008',
    originIata: 'BCN', originCity: 'Barcelona',
    destinationIata: 'OPO', destinationCity: 'Porto',
    destinationCountry: 'Portugal',
    destinationLat: 41.1579, destinationLng: -8.6291,
    departureDatetime: '2025-05-10T15:10:00Z',
    arrivalDatetime: '2025-05-10T16:50:00Z',
    durationMinutes: 100,
    airlineName: 'TAP Air Portugal', stops: 0,
    priceUsd: 83,
    bookingUrl: 'https://www.google.com/flights',
  },
  {
    flightId: 'mock_009',
    originIata: 'BCN', originCity: 'Barcelona',
    destinationIata: 'VIE', destinationCity: 'Vienna',
    destinationCountry: 'Austria',
    destinationLat: 48.2082, destinationLng: 16.3738,
    departureDatetime: '2025-05-10T07:55:00Z',
    arrivalDatetime: '2025-05-10T10:20:00Z',
    durationMinutes: 145,
    airlineName: 'Austrian', stops: 0,
    priceUsd: 91,
    bookingUrl: 'https://www.google.com/flights',
  },
  {
    flightId: 'mock_010',
    originIata: 'BCN', originCity: 'Barcelona',
    destinationIata: 'DUB', destinationCity: 'Dublin',
    destinationCountry: 'Ireland',
    destinationLat: 53.3498, destinationLng: -6.2603,
    departureDatetime: '2025-05-10T10:30:00Z',
    arrivalDatetime: '2025-05-10T12:55:00Z',
    durationMinutes: 145,
    airlineName: 'Ryanair', stops: 0,
    priceUsd: 97,
    bookingUrl: 'https://www.google.com/flights',
  },
];

export class MockFlightProvider implements FlightProvider {
  async searchFlights(_params: FlightSearchParams): Promise<FlightOption[]> {
    // Simulate network delay in development
    await new Promise(r => setTimeout(r, 800));
    return MOCK_FLIGHTS;
  }
}
```

```typescript
// backend/src/providers/weather/mock.adapter.ts
import type { WeatherProvider, WeatherSummary } from '@trip-planner/shared';

const CONDITIONS = ['clear', 'cloudy', 'rain', 'clear', 'clear'] as const;

export class MockWeatherProvider implements WeatherProvider {
  async getWeather(_lat: number, _lng: number, date: string): Promise<WeatherSummary> {
    await new Promise(r => setTimeout(r, 200));
    return {
      temperatureC: Math.floor(Math.random() * 20) + 10,
      condition: CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)],
      isForecast: true,
      date,
    };
  }
}
```

---

## 10. Sample State Structure

### Zustand Trip Store

```typescript
// frontend/src/store/trip.store.ts
import { create } from 'zustand';
import type { Airport, TripLeg, ItineraryStatus } from '@trip-planner/shared';
import { encodeTrip, decodeTrip } from '../utils/url.utils';

const MAX_DESTINATIONS = 15;
const MAX_LEGS = MAX_DESTINATIONS + 1;
const TRIP_PARAM = 'trip';

interface TripState {
  // Persisted state (URL-encoded)
  origin: Airport | null;
  stops: TripLeg[];
  status: ItineraryStatus | 'idle';

  // Actions
  setOrigin: (origin: Airport) => void;
  addStop: (stop: TripLeg) => void;
  updateStopStay: (stopIndex: number, stayDays: number, nextDepartureDate: string) => void;
  setStatus: (status: TripState['status']) => void;
  reset: () => void;
  syncToUrl: () => void;
  hydrateFromUrl: () => boolean;

  // Derived (computed)
  currentOriginIata: () => string;
  currentDepartureDate: () => string;
  nextStopIndex: () => number;
  totalPriceUsd: () => number;
  canContinue: () => boolean;
  nonReturnLegs: () => TripLeg[];
}

const INITIAL_STATE = {
  origin: null,
  stops: [],
  status: 'idle' as const,
};

export const useTripStore = create<TripState>((set, get) => ({
  ...INITIAL_STATE,

  setOrigin: (origin) => {
    set({ origin, stops: [], status: 'planning' });
    get().syncToUrl();
  },

  addStop: (stop) => {
    const state = get();
    const nonReturn = state.stops.filter(s => !s.isReturn).length;
    if (!stop.isReturn && nonReturn >= MAX_DESTINATIONS) return;
    set(s => ({ stops: [...s.stops, stop] }));
    get().syncToUrl();
  },

  updateStopStay: (stopIndex, stayDays, nextDepartureDate) => {
    set(s => ({
      stops: s.stops.map(stop =>
        stop.stopIndex === stopIndex
          ? { ...stop, stayDurationDays: stayDays, nextDepartureDate }
          : stop
      ),
    }));
    get().syncToUrl();
  },

  setStatus: (status) => {
    set({ status });
    get().syncToUrl();
  },

  reset: () => {
    set(INITIAL_STATE);
    const url = new URL(window.location.href);
    url.searchParams.delete(TRIP_PARAM);
    window.history.replaceState({}, '', url.toString());
  },

  syncToUrl: () => {
    const { origin, stops, status } = get();
    const encoded = encodeTrip({ origin, stops, status });
    const url = new URL(window.location.href);
    url.searchParams.set(TRIP_PARAM, encoded);
    window.history.replaceState({}, '', url.toString());
  },

  hydrateFromUrl: () => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get(TRIP_PARAM);
    if (!encoded) return false;
    const decoded = decodeTrip(encoded);
    if (!decoded) return false;
    set({
      origin: decoded.origin,
      stops: decoded.stops.slice(0, MAX_LEGS),
      status: decoded.status,
    });
    return true;
  },

  // Derived
  currentOriginIata: () => {
    const { stops, origin } = get();
    const nonReturn = stops.filter(s => !s.isReturn);
    return nonReturn.length > 0
      ? nonReturn[nonReturn.length - 1].destinationIata
      : origin?.iata ?? '';
  },
  currentDepartureDate: () => {
    const nonReturn = get().stops.filter(s => !s.isReturn);
    return nonReturn.length > 0 ? nonReturn[nonReturn.length - 1].nextDepartureDate : '';
  },
  nextStopIndex: () => get().stops.filter(s => !s.isReturn).length + 1,
  totalPriceUsd: () => get().stops.reduce((sum, s) => sum + (s.priceUsd ?? 0), 0),
  canContinue: () => get().stops.filter(s => !s.isReturn).length < MAX_DESTINATIONS,
  nonReturnLegs: () => get().stops.filter(s => !s.isReturn),
}));
```

### Zustand Session Store

```typescript
// frontend/src/store/session.store.ts
import { create } from 'zustand';
import type { FlightOption } from '@trip-planner/shared';
import type { AppScreen } from '../types/search-session';
import type { WeatherBatchResponse } from '@trip-planner/shared';

interface SessionState {
  currentScreen: AppScreen;
  flightResults: FlightOption[];
  flightResultsLoading: boolean;
  flightResultsError: string | null;
  selectedFlight: FlightOption | null;
  weatherMap: WeatherBatchResponse;
  weatherLoading: boolean;

  setScreen: (screen: AppScreen) => void;
  setFlightResults: (results: FlightOption[], loading: boolean, error?: string | null) => void;
  setSelectedFlight: (flight: FlightOption | null) => void;
  setWeatherMap: (map: WeatherBatchResponse) => void;
  setWeatherLoading: (loading: boolean) => void;
  clearResults: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  currentScreen: 'home',
  flightResults: [],
  flightResultsLoading: false,
  flightResultsError: null,
  selectedFlight: null,
  weatherMap: {},
  weatherLoading: false,

  setScreen: (screen) => set({ currentScreen: screen }),
  setFlightResults: (results, loading, error = null) =>
    set({ flightResults: results, flightResultsLoading: loading, flightResultsError: error }),
  setSelectedFlight: (flight) => set({ selectedFlight: flight }),
  setWeatherMap: (map) => set(s => ({ weatherMap: { ...s.weatherMap, ...map } })),
  setWeatherLoading: (loading) => set({ weatherLoading: loading }),
  clearResults: () => set({ flightResults: [], selectedFlight: null, weatherMap: {} }),
}));
```

---

## 11. Environment Variable List

### Backend `.env.example`

```bash
# ── Server ──────────────────────────────────────────────
NODE_ENV=development
PORT=3001

# ── CORS ────────────────────────────────────────────────
FRONTEND_URL=http://localhost:5173

# ── External APIs ───────────────────────────────────────
# Primary flight provider (SerpAPI Google Flights)
SERPAPI_API_KEY=your_serpapi_api_key_here
# Fallback flight provider (Kiwi/Tequila) — used if SERPAPI_API_KEY is absent
KIWI_API_KEY=your_kiwi_tequila_api_key_here
OWM_API_KEY=your_openweathermap_api_key_here
AIRHEX_API_KEY=your_airhex_api_key_here

# ── Development flags ───────────────────────────────────
# Set to "true" to bypass OWM and return random weather
USE_MOCK_WEATHER=false
# Note: mock flight provider is selected automatically when neither SERPAPI_API_KEY nor KIWI_API_KEY is set
```

### Frontend `.env.example`

```bash
# ── API ─────────────────────────────────────────────────
VITE_API_BASE_URL=http://localhost:3001/v1

# ── App ─────────────────────────────────────────────────
VITE_APP_ENV=development
```

### Production values (never commit)

```bash
# backend .env.production
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://tripplanner.app
SERPAPI_API_KEY=<real key>
KIWI_API_KEY=<real key, optional fallback>
OWM_API_KEY=<real key>
USE_MOCK_WEATHER=false

# frontend .env.production
VITE_API_BASE_URL=https://api.tripplanner.app/v1
VITE_APP_ENV=production
```

---

## 12. README Setup Sections

### Root `README.md`

```markdown
# Trip Planner

Budget-first multi-stop trip planner. Find the 10 cheapest flights at each step,
chain up to 15 destinations, and finish with a visual itinerary.

## Monorepo structure

- `packages/shared` — TypeScript types shared by frontend and backend
- `frontend/`       — React 18 + Vite SPA
- `backend/`        — Node.js + Fastify REST API

## Prerequisites

- Node.js 20 LTS
- npm 9+

## Getting started

\`\`\`bash
# 1. Install all dependencies
npm install

# 2. Set up environment variables
cp backend/.env.example backend/.env.local
cp frontend/.env.example frontend/.env.local
# Edit both .env.local files with your API keys

# 3. Start both servers
npm run dev
\`\`\`

Frontend: http://localhost:5173
Backend:  http://localhost:3001

## Environment variables

See backend/.env.example and frontend/.env.example for full lists.
Minimum required to run with real flights: `SERPAPI_API_KEY` (or `KIWI_API_KEY` as fallback), `OWM_API_KEY`, `FRONTEND_URL`.

To run without any external flight API (UI development only):
\`\`\`
# Leave both SERPAPI_API_KEY and KIWI_API_KEY unset — mock provider is used automatically
USE_MOCK_WEATHER=true
\`\`\`

## API keys

| Service | Purpose | Notes |
|---|---|---|
| SerpAPI | Flight search (primary) | Register at serpapi.com; `engine=google_flights` |
| Kiwi/Tequila | Flight search (fallback) | Register at tequila.kiwi.com; used if SerpAPI key absent |
| OpenWeatherMap | Weather data | Free tier at openweathermap.org/api |

## Useful commands

\`\`\`bash
npm run dev                # Start both FE + BE in watch mode
npm run typecheck          # TypeScript check across all packages
npm run lint               # ESLint across all packages
npm run test -w backend    # Run backend tests
\`\`\`

## Deployment

- Frontend: deploy the `frontend/` directory to Vercel
  - Set VITE_API_BASE_URL to your production backend URL
- Backend: deploy the `backend/` directory to Railway or Render
  - Set all production env vars in the platform dashboard
  - Do not commit .env files

## Docs

See the `/docs` folder for full specifications:
- `architecture.md`      — system design and stack decisions
- `data-models.md`       — TypeScript interfaces and data shapes
- `api-design.md`        — REST API reference
- `business-logic.md`    — algorithms and rules
- `ux.md`                — UX design and screen specs
- `engineering-plan.md`  — phased implementation plan
- `codebase-structure.md` — scaffold, modules, and conventions
```

### `backend/README.md`

```markdown
# Trip Planner — Backend

Fastify REST API. Proxies SerpAPI Google Flights (primary), Kiwi/Tequila (fallback), and OpenWeatherMap.
Manages in-memory itinerary state.

## Stack
- Node.js 20 LTS + TypeScript
- Fastify v4 + Zod validation
- node-cache for in-memory caching
- Pino structured logging

## Setup

\`\`\`bash
cp .env.example .env.local
# Add SERPAPI_API_KEY (primary) and/or KIWI_API_KEY (fallback) and OWM_API_KEY
npm run dev
\`\`\`

## Scripts
\`\`\`bash
npm run dev        # ts-node-dev watch
npm run build      # tsc compile to /dist
npm run start      # node dist/server.js
npm run test       # Vitest
npm run typecheck  # tsc --noEmit
\`\`\`

## Using mock providers

Set in .env.local:
\`\`\`
# Omit both SERPAPI_API_KEY and KIWI_API_KEY to use the mock flight provider automatically
USE_MOCK_WEATHER=true   # No OWM API calls
\`\`\`

## Endpoints

See /docs/api-design.md for full reference.

| Method | Route | Description |
|---|---|---|
| GET | /health | Health check |
| GET | /airports/search | Airport autocomplete |
| GET | /airports/nearby | Nearby airports |
| GET | /flights/search | 10 cheapest flights |
| POST | /weather/batch | Batch weather |
| POST | /itineraries | Create itinerary |
| POST | /itineraries/:id/legs | Add leg |
| PATCH | /itineraries/:id/legs/:n/stay | Set stay |
| GET | /itineraries/:id/next-flights | Continue trip |
| GET | /itineraries/:id/return-flights | Head home |
| POST | /itineraries/:id/finalize | Finalize |
| GET | /itineraries/:id | Get itinerary |
```

### `frontend/README.md`

```markdown
# Trip Planner — Frontend

React 18 SPA. Mobile-first backpacker trip planner UI.

## Stack
- React 18 + TypeScript + Vite
- Tailwind CSS v3
- Zustand (state)
- React Router v6
- Leaflet (map)
- lz-string (URL state compression)

## Setup

\`\`\`bash
cp .env.example .env.local
# Set VITE_API_BASE_URL=http://localhost:3001/v1
npm run dev
\`\`\`

## Scripts
\`\`\`bash
npm run dev        # Vite dev server
npm run build      # Production build to /dist
npm run preview    # Preview production build
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
\`\`\`

## Screens

| Flow Key | Screen | Description |
|---|---|---|
| S1 | HomeScreen | Origin airport search |
| S2 | FlightResultsScreen | 10 cheapest flights with inline date controls |
| S3 | StayDurationScreen | Set stay duration |
| S4 | DecisionScreen | Continue or fly home |
| S5 | ReturnFlightsScreen | 3 cheapest return-route options |
| S6 | ItineraryScreen | Timeline + map + share |
| S7 | BookingReviewScreen | Final ticket review + booking links |

## State architecture
- `trip.store.ts` — persisted to URL via lz-string
- `session.store.ts` — ephemeral UI state, never persisted

## Key utilities
- `url.utils.ts`       — encodeTrip / decodeTrip
- `timeline.utils.ts`  — buildTimelineItems
- `map.utils.ts`       — buildMapData
- `itinerary.utils.ts` — buildItinerarySummary
```
