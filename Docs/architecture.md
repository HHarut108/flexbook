# Technical Architecture — Trip Planner MVP

---

## 0. MVP Alignment Status

For the current MVP, the product source of truth is [\_docs_product-definition.md](/Users/harut/Desktop/Fast-Travel-Assistant/Docs/_docs_product-definition.md) plus [prd-alignment-decisions.md](/Users/harut/Desktop/Fast-Travel-Assistant/Docs/prd-alignment-decisions.md).

This means:

- Trip state lives in the browser URL for MVP
- Shared trips should open from the URL alone and should not depend on an expiring server-side trip record
- Required backend capability for MVP is flight search, airport search, nearby airports, weather, and airline logo lookup for booking review
- Server-stored itinerary sessions are a possible future enhancement, not a required MVP foundation

---

## 1. Frontend Stack

**React 18 + TypeScript + Vite**

| Layer | Choice |
|---|---|
| Framework | React 18 |
| Language | TypeScript 5 |
| Build tool | Vite |
| Styling | Tailwind CSS v3 |
| State management | Zustand |
| Routing | React Router v6 |
| Map | Leaflet + react-leaflet |
| HTTP client | Axios |
| Date handling | date-fns |
| URL state encoding | lz-string |
| Form/input | React Hook Form |
| Icons | Lucide React |

---

## 2. Backend Stack

**Node.js + TypeScript + Fastify**

| Layer | Choice |
|---|---|
| Runtime | Node.js 20 LTS |
| Language | TypeScript 5 |
| Framework | Fastify v4 |
| Validation | Zod |
| HTTP client | axios |
| Caching | node-cache (in-memory, MVP) |
| Environment config | dotenv |
| Logging | Fastify built-in pino |
| Testing | Vitest |

---

## 3. Why This Stack

**Frontend: React + Vite + Zustand**

React is the lowest-risk choice for a planning flow with multiple sequential screens. Vite makes local dev instant. Zustand replaces Redux with 1/10th the boilerplate — perfect for a linear trip chain that needs to be read from many components without prop drilling. Tailwind gives a backpacker aesthetic fast: utility-first, no design system overhead. Leaflet is the only serious open-source map library that requires no API key for base tiles.

**Backend: Fastify over Express**

Fastify is Express with TypeScript and validation built in. It's 2x faster, has a native plugin system that maps cleanly to provider abstractions, and ships with Zod-compatible schema validation. Pino logging is structured out of the box. For an MVP API proxy, this is the minimum viable backend with maximum maintainability.

**TypeScript on both sides**

Shared types between FE and BE eliminate an entire class of bugs — the contract between client and server is enforced at compile time, not discovered at runtime.

**No database for MVP**

Trip state lives in the URL (lz-string compressed). Zero infrastructure cost. Zero GDPR surface. This is the right call for MVP: if persistence becomes a requirement, it's an additive change, not a rewrite.

---

## 4. Overall System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                            │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              React SPA (Vite)                           │   │
│   │                                                         │   │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐             │   │
│   │  │  Search  │  │Planning  │  │Itinerary │             │   │
│   │  │  Screen  │  │  Flow    │  │  Screen  │             │   │
│   │  └──────────┘  └──────────┘  └──────────┘             │   │
│   │                                                         │   │
│   │  ┌───────────────────────────────────────┐             │   │
│   │  │         Zustand Trip Store             │             │   │
│   │  └───────────────────────────────────────┘             │   │
│   │                                                         │   │
│   │  ┌───────────────────────────────────────┐             │   │
│   │  │    URL State (lz-string encoded)       │             │   │
│   │  └───────────────────────────────────────┘             │   │
│   └─────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS / REST
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                    BACKEND (Fastify)                             │
│                                                                 │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│
│   │ /airports   │  │ /flights    │  │ /weather    │  │ /airlines   ││
│   │ router      │  │ router      │  │ router      │  │ router      ││
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘│
│          │                │                 │                 │       │
│   ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐│
│   │  Airport    │  │   Flight    │  │   Weather   │  │ AirlineLogo ││
│   │  Service    │  │   Service    │  │   Service   │  │   Service   ││
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘│
│          │                │                 │                 │       │
│   ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐          │       │
│   │  Airport    │  │   Flight    │  │   Weather   │          │       │
│   │  Provider   │  │  Provider   │  │  Provider   │          │       │
│   │(static JSON)│  │(SerpAPI →   │  │(OWM adapter)│          │       │
│   └─────────────┘  │ Kiwi → mock)│  └─────────────┘          │       │
│                    └──────┬──────┘                             │       │
│                           │                    ┌───────────────▼──────┐│
│              ┌────────────▼────────────────────▼──────────────┐        │
│              │              node-cache (in-memory)            │        │
│              └────────────────────────────────────────────────┘        │
└────────────────────────┬──────────────┬──────────────────┬─────────────┘
                         │              │                  │
              ┌──────────▼───┐  ┌───────▼────────┐  ┌──────▼────────┐  ┌──────────────┐
              │  SerpAPI     │  │ OpenWeatherMap  │  │    Airhex     │  │  Kiwi.com    │
              │  (Google     │  │    API          │  │  Logos API    │  │  (fallback)  │
              │  Flights)    │  └────────────────┘  └───────────────┘  └──────────────┘
              └──────────────┘
```

**Deployment (free tier):**
- Frontend: Vercel (free, Vite SPA, global CDN)
- Backend: Railway or Render (free tier, Node.js, always-on)
- No database. No Redis. No message queue.

---

## 5. Flight Provider Abstraction

The provider interface is the most important architectural decision. It allows swapping providers by writing a new adapter — zero changes to business logic.

**Provider selection (priority order):**
- `SERPAPI_API_KEY` set → `SerpApiFlightProvider` (Google Flights via SerpAPI) — **primary**
- `KIWI_API_KEY` set → `KiwiFlightProvider` (Kiwi/Tequila) — **fallback**
- neither set → `MockFlightProvider` — **development / testing fallback**

**Interface definition (shared types):**

```typescript
// packages/shared/types/flight.ts

export interface FlightSearchParams {
  originIata: string;
  date: string;           // YYYY-MM-DD
  destinationIata?: string;
  adults: number;
  currency: string;
}

export interface FlightResult {
  flightId: string;
  originIata: string;
  destinationIata: string;
  destinationCity: string;
  destinationCountry: string;
  destinationLat: number;
  destinationLng: number;
  departureDatetime: string;    // ISO 8601
  arrivalDatetime: string;      // ISO 8601
  durationMinutes: number;
  airlineName: string;
  airlineCode?: string;
  stops: number;
  priceUsd: number;
  bookingUrl: string;
}

export interface FlightProvider {
  searchFlights(params: FlightSearchParams): Promise<FlightResult[]>;
}
```

**Kiwi adapter (fallback):**

```typescript
// backend/src/providers/flights/kiwi.adapter.ts

import got from 'got';
import type { FlightProvider, FlightSearchParams, FlightResult } from '@shared/types/flight';

export class KiwiFlightProvider implements FlightProvider {
  private readonly baseUrl = 'https://api.tequila.kiwi.com/v2';
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchFlights(params: FlightSearchParams): Promise<FlightResult[]> {
    const raw = await got.get(`${this.baseUrl}/search`, {
      headers: { apikey: this.apiKey },
      searchParams: {
        fly_from: params.originIata,
        fly_to: params.destinationIata ?? 'anywhere',
        date_from: params.date,
        date_to: params.date,
        adults: params.adults,
        curr: params.currency,
        limit: 20,
        sort: 'price',
        one_for_city: 1,
      },
      timeout: { request: 8000 },
    }).json<KiwiApiResponse>();

    return raw.data
      .map(this.normalise)
      .filter(Boolean)
      .slice(0, 10) as FlightResult[];
  }

  private normalise(raw: KiwiItinerary): FlightResult | null {
    if (!raw.price || !raw.flyFrom || !raw.flyTo) return null;
    return {
      flightId: raw.id,
      originIata: raw.flyFrom,
      destinationIata: raw.flyTo,
      destinationCity: raw.cityTo,
      destinationCountry: raw.countryTo?.name ?? '',
      destinationLat: raw.latitudeTo,
      destinationLng: raw.longitudeTo,
      departureDatetime: new Date(raw.dTime * 1000).toISOString(),
      arrivalDatetime: new Date(raw.aTime * 1000).toISOString(),
      durationMinutes: Math.round(raw.duration.total / 60),
      airlineName: raw.airlines?.[0] ?? 'Unknown',
      airlineCode: raw.airlines?.[0],
      stops: raw.route.length - 1,
      priceUsd: raw.price,
      bookingUrl: raw.deep_link,
    };
  }
}
```

**Flight service (provider-agnostic):**

```typescript
// backend/src/services/flight.service.ts

import type { FlightProvider, FlightSearchParams, FlightResult } from '@shared/types/flight';
import NodeCache from 'node-cache';

export class FlightService {
  private cache = new NodeCache({ stdTTL: 300 }); // 5 min

  constructor(private readonly provider: FlightProvider) {}

  async getCheapestFlights(params: FlightSearchParams): Promise<FlightResult[]> {
    const cacheKey = `${params.originIata}:${params.date}:${params.destinationIata ?? 'any'}`;
    const cached = this.cache.get<FlightResult[]>(cacheKey);
    if (cached) return cached;

    const results = await this.provider.searchFlights(params);
    const sorted = results.sort((a, b) => a.priceUsd - b.priceUsd);
    this.cache.set(cacheKey, sorted);
    return sorted;
  }
}
```

**Provider selection (runtime):**

```typescript
// backend/src/app.ts

// Priority: SerpAPI → Kiwi → Mock
const flightProvider = config.SERPAPI_API_KEY
  ? new SerpApiFlightProvider(config.SERPAPI_API_KEY)
  : config.KIWI_API_KEY
    ? new KiwiFlightProvider(config.KIWI_API_KEY)
    : new MockFlightProvider();

const flightService = new FlightService(flightProvider);
```

---

## 6. Weather Provider Abstraction

Same pattern as flights. Swap OpenWeatherMap for WeatherAPI or Open-Meteo with no changes upstream.

```typescript
// packages/shared/types/weather.ts

export type WeatherCondition =
  | 'clear' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'unknown';

export interface WeatherResult {
  temperatureC: number;
  condition: WeatherCondition;
  isForecast: boolean;   // true = live forecast, false = climate average
}

export interface WeatherProvider {
  getWeather(lat: number, lng: number, date: string): Promise<WeatherResult>;
}
```

```typescript
// backend/src/providers/weather/openweathermap.adapter.ts

import got from 'got';
import type { WeatherProvider, WeatherResult, WeatherCondition } from '@shared/types/weather';

const FORECAST_WINDOW_DAYS = 10;

export class OpenWeatherMapProvider implements WeatherProvider {
  constructor(private readonly apiKey: string) {}

  async getWeather(lat: number, lng: number, date: string): Promise<WeatherResult> {
    const daysAhead = this.daysFromToday(date);

    if (daysAhead <= FORECAST_WINDOW_DAYS) {
      return this.getForecast(lat, lng, date);
    }
    return this.getClimateAverage(lat, lng, date);
  }

  private async getForecast(lat: number, lng: number, date: string): Promise<WeatherResult> {
    const raw = await got.get('https://api.openweathermap.org/data/2.5/forecast', {
      searchParams: { lat, lon: lng, appid: this.apiKey, units: 'metric' },
      timeout: { request: 5000 },
    }).json<OWMForecastResponse>();

    const match = raw.list.find(entry => entry.dt_txt.startsWith(date));
    if (!match) return this.fallback();

    return {
      temperatureC: Math.round(match.main.temp),
      condition: this.mapCondition(match.weather[0]?.main),
      isForecast: true,
    };
  }

  private getClimateAverage(lat: number, lng: number, date: string): WeatherResult {
    // MVP: return unknown for climate averages
    return { temperatureC: 0, condition: 'unknown', isForecast: false };
  }

  private mapCondition(owmMain: string): WeatherCondition {
    const map: Record<string, WeatherCondition> = {
      Clear: 'clear', Clouds: 'cloudy', Rain: 'rain',
      Drizzle: 'rain', Snow: 'snow', Thunderstorm: 'storm',
    };
    return map[owmMain] ?? 'unknown';
  }

  private fallback(): WeatherResult {
    return { temperatureC: 0, condition: 'unknown', isForecast: false };
  }

  private daysFromToday(date: string): number {
    return Math.ceil(
      (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
  }
}
```

---

## 7. Frontend–Backend Data Flow

Three REST endpoints. All stateless. All JSON.

```
GET /api/airports/search?q={query}
GET /api/flights/search?origin={iata}&date={date}&destination={iata?}
GET /api/weather/batch   (POST body: [{ lat, lng, date }])
```

**Complete flow for one planning step:**

```
FE                                    BE                          EXT APIs
│                                     │                              │
│── GET /airports/search?q=bar ──────►│                              │
│◄── [{ iata, city, country }] ───────│ (static in-memory lookup)    │
│                                     │                              │
│── GET /flights/search               │                              │
│    ?origin=BCN&date=2025-05-10 ────►│                              │
│                                     │── GET serpapi.com/search ───►│
│                                     │   (engine=google_flights)    │
│                                     │◄── raw itineraries ──────────│
│                                     │  normalise → sort → cache    │
│◄── [FlightResult x10] ─────────────│                              │
│                                     │                              │
│── POST /weather/batch               │                              │
│    [{ lat, lng, date } x10] ───────►│                              │
│                                     │── GET owm forecast (batch) ─►│
│                                     │◄── weather data ─────────────│
│                                     │  map condition → cache       │
│◄── [WeatherResult x10] ────────────│                              │
│                                     │                              │
│  [user selects flight]              │                              │
│  [user sets stay duration]          │                              │
│  → update Zustand store             │                              │
│  → encode to URL                    │                              │
│                                     │                              │
│  [repeat for each stop]             │                              │
│                                     │                              │
│  [user heads home]                  │                              │
│── GET /flights/search               │                              │
│    ?origin=LIS&date=2025-05-14      │                              │
│    &destination=BCN ───────────────►│                              │
│◄── [FlightResult x10] ─────────────│                              │
```

**API response envelope (consistent across all endpoints):**

```typescript
// Success
{
  "success": true,
  "data": { ... }
}

// Error
{
  "success": false,
  "error": {
    "code": "FLIGHT_API_UNAVAILABLE",
    "message": "Flight search is temporarily unavailable.",
    "retryable": true
  }
}
```

---

## 8. Itinerary State Management

**Two layers: Zustand (runtime) + URL (persistence)**

```typescript
// frontend/src/store/trip.store.ts

import { create } from 'zustand';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

export interface TripStop {
  stopIndex: number;
  originIata: string;
  destinationIata: string;
  destinationCity: string;
  destinationCountry: string;
  destinationLat: number;
  destinationLng: number;
  departureDatetime: string;
  arrivalDatetime: string;
  durationMinutes: number;
  airlineName: string;
  stops: number;
  priceUsd: number;
  bookingUrl: string;
  stayDurationDays: number;
  nextDepartureDate: string;
  isReturn: boolean;
}

export interface TripOrigin {
  iata: string;
  city: string;
  lat: number;
  lng: number;
}

interface TripState {
  origin: TripOrigin | null;
  stops: TripStop[];
  status: 'idle' | 'planning' | 'complete';

  // Actions
  setOrigin: (origin: TripOrigin) => void;
  addStop: (stop: TripStop) => void;
  setStatus: (status: TripState['status']) => void;
  reset: () => void;
  hydrateFromUrl: () => void;
  syncToUrl: () => void;

  // Derived
  currentStopIndex: () => number;
  currentDepartureDate: () => string;
  currentOriginIata: () => string;
  totalPriceUsd: () => number;
  canContinue: () => boolean;
}

const TRIP_PARAM = 'trip';
const MAX_DESTINATIONS = 15;
const MAX_LEGS = MAX_DESTINATIONS + 1; // 15 destinations + 1 return leg

export const useTripStore = create<TripState>((set, get) => ({
  origin: null,
  stops: [],
  status: 'idle',

  setOrigin: (origin) => {
    set({ origin, stops: [], status: 'planning' });
    get().syncToUrl();
  },

  addStop: (stop) => {
    set((s) => ({ stops: [...s.stops, stop] }));
    get().syncToUrl();
  },

  setStatus: (status) => {
    set({ status });
    get().syncToUrl();
  },

  reset: () => {
    set({ origin: null, stops: [], status: 'idle' });
    window.history.replaceState({}, '', window.location.pathname);
  },

  syncToUrl: () => {
    const { origin, stops, status } = get();
    const payload = JSON.stringify({ origin, stops, status });
    const compressed = compressToEncodedURIComponent(payload);
    const url = new URL(window.location.href);
    url.searchParams.set(TRIP_PARAM, compressed);
    window.history.replaceState({}, '', url.toString());
  },

  hydrateFromUrl: () => {
    const params = new URLSearchParams(window.location.search);
    const compressed = params.get(TRIP_PARAM);
    if (!compressed) return;

    try {
      const raw = decompressFromEncodedURIComponent(compressed);
      const parsed = JSON.parse(raw);
      if (parsed?.origin && Array.isArray(parsed?.stops)) {
        set({
          origin: parsed.origin,
          stops: parsed.stops.slice(0, MAX_LEGS),
          status: parsed.status ?? 'planning',
        });
      }
    } catch {
      console.warn('Failed to restore trip state from URL');
    }
  },

  currentStopIndex: () => get().stops.filter(s => !s.isReturn).length + 1,
  currentOriginIata: () => {
    const { stops, origin } = get();
    return stops.length > 0
      ? stops[stops.length - 1].destinationIata
      : origin?.iata ?? '';
  },
  currentDepartureDate: () => {
    const stops = get().stops;
    return stops.length > 0
      ? stops[stops.length - 1].nextDepartureDate
      : '';
  },
  totalPriceUsd: () =>
    get().stops.reduce((sum, s) => sum + (s.priceUsd ?? 0), 0),
  canContinue: () => get().stops.filter(s => !s.isReturn).length < MAX_DESTINATIONS,
}));
```

---

## 9. Project Folder Structure

```
trip-planner/
│
├── packages/
│   └── shared/                         # Shared TypeScript types (no logic)
│       ├── types/
│       │   ├── flight.ts
│       │   ├── weather.ts
│       │   ├── airport.ts
│       │   └── itinerary.ts
│       └── package.json
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/                        # API client functions (Axios wrappers)
│   │   │   ├── airports.api.ts
│   │   │   ├── flights.api.ts
│   │   │   └── weather.api.ts
│   │   │
│   │   ├── components/                 # Reusable UI components
│   │   │   ├── FlightCard.tsx          # Destination discovery card (S2)
│   │   │   ├── ReturnFlightCard.tsx    # Ticket-style route card (S5) — BCN→BUD→EVN
│   │   │   ├── TripTimeline.tsx        # Horizontal scrollable leg strip shown on S2–S5
│   │   │   ├── DatePickerOverlay.tsx   # Calendar bottom-sheet (replaces standalone date screen)
│   │   │   ├── ProgressBar.tsx         # Stop count breadcrumb (global header)
│   │   │   └── TripMap.tsx             # Leaflet map with numbered pins + polylines (S6)
│   │   │
│   │   ├── screens/                    # One file per screen (7 screens total)
│   │   │   ├── HomeScreen.tsx          # S1 — origin search + geolocation nearby pills
│   │   │   ├── FlightResultsScreen.tsx # S2 — date arrows, 10 cards, trip strip, head-home CTA
│   │   │   ├── StayDurationScreen.tsx  # S3 — stay stepper, departure preview, trip strip
│   │   │   ├── DecisionScreen.tsx      # S4 — always-visible TripTimeline + keep going / head home
│   │   │   ├── ReturnFlightsScreen.tsx # S5 — ReturnFlightCards back to origin city
│   │   │   ├── ItineraryScreen.tsx     # S6 — timeline + map tabs + share
│   │   │   └── BookingReviewScreen.tsx # S7 — final booking review + airline logos + bulk/per-ticket booking
│   │   │
│   │   ├── store/
│   │   │   ├── trip.store.ts           # origin, legs, addLeg, canContinue, reset, finalize
│   │   │   └── session.store.ts        # current screen, pending flights, selected flight, weather map
│   │   │
│   │   ├── hooks/                      # Custom React hooks
│   │   │   ├── useFlightSearch.ts      # Wraps searchFlights API call + store updates
│   │   │   ├── useWeatherBatch.ts      # Async weather injection for flight cards
│   │   │   ├── useAirportSearch.ts     # Debounced airport autocomplete
│   │   │   └── useUrlSync.ts           # Bidirectional ?t= URL state persistence
│   │   │
│   │   ├── utils/
│   │   │   ├── date.utils.ts
│   │   │   ├── price.utils.ts
│   │   │   └── url.utils.ts
│   │   │
│   │   ├── constants/
│   │   │   └── stayRecommendations.ts  # Static city → days lookup
│   │   │
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── router.tsx               # BrowserRouter wrapper; screen flow is Zustand-driven
│   │
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
├── backend/
│   ├── src/
│   │   ├── routes/                     # Fastify route handlers (thin)
│   │   │   ├── airports.ts             # /search, /nearby, /nearby-coords
│   │   │   ├── flights.ts              # /search?originIata&date&destination&deduplicate&limit
│   │   │   └── weather.ts              # POST /batch
│   │   │
│   │   ├── services/                   # Business logic lives here
│   │   │   ├── AirportService.ts       # fuzzy search, Haversine nearby, nearbyByCoords
│   │   │   ├── FlightService.ts        # cache, dedupe, sort, limit param
│   │   │   └── WeatherService.ts       # batch fetch, silent fail, 1h cache
│   │   │
│   │   ├── providers/                  # External API adapters
│   │   │   ├── flights/
│   │   │   │   ├── flight.provider.ts       # Interface definition
│   │   │   │   ├── SerpApiFlightProvider.ts # Primary: SerpAPI Google Flights
│   │   │   │   └── kiwi.adapter.ts          # Fallback: Kiwi/Tequila
│   │   │   └── weather/
│   │   │       ├── weather.provider.ts # Interface definition
│   │   │       └── openweathermap.adapter.ts
│   │   │
│   │   ├── data/
│   │   │   └── airports.json           # Static airport dataset (~7k airports)
│   │   │
│   │   ├── schemas/                    # Zod schemas for request validation
│   │   │   ├── flights.schema.ts
│   │   │   └── weather.schema.ts
│   │   │
│   │   ├── utils/
│   │   │   ├── cache.ts
│   │   │   └── haversine.ts            # Distance calculation for nearby airports
│   │   │
│   │   ├── config.ts                   # Env var loading + validation
│   │   └── app.ts                      # Fastify app bootstrap + DI
│   │
│   ├── tests/
│   │   ├── services/
│   │   └── providers/
│   │
│   └── tsconfig.json
│
├── package.json                        # Monorepo root (npm workspaces)
└── .env.example
```

---

## 10. Where Business Logic Lives

**Hard rule: business logic lives in services, never in routes or components.**

| Layer | Responsibility | Must NOT contain |
|---|---|---|
| `routes/` | Parse request, call service, return response | Any logic beyond input/output |
| `services/` | All business rules, caching, orchestration | HTTP framework code, raw API calls |
| `providers/` | API-specific translation only | Business rules, caching |
| `screens/` (FE) | UI state, user interaction | API calls, business calculations |
| `hooks/` (FE) | Data fetching, derived state | Direct store mutations, UI rendering |
| `store/` (FE) | Trip chain state, URL sync | Data fetching, formatting |
| `api/` (FE) | HTTP calls to BE only | Any logic, state management |
| `utils/` | Pure functions only | Side effects, state |

**Concrete examples:**

- "Return only cheapest flight per destination" → `flight.service.ts`
- "Max 15 stops enforcement" → `trip.store.ts` (canContinue) + `flights.route.ts` (validate stop index)
- "next_departure_date = arrival + stay_days" → `date.utils.ts`, called from store action
- "SerpAPI/Kiwi API response → FlightResult" → respective adapter only (`SerpApiFlightProvider.ts` / `kiwi.adapter.ts`)
- "Sort by price, tiebreak by duration" → `flight.service.ts`
- "Temperature + icon display" → `WeatherWidget` component (display only; data from hook)
- "lz-string encode/decode" → `trip.store.ts` (syncToUrl / hydrateFromUrl)

---

## 11. Future Scalability Without Overengineering

Every decision below is zero cost at MVP and unlocks the next phase cleanly.

**Provider swapping (already solved)**
The `FlightProvider` and `WeatherProvider` interfaces mean adding Amadeus, Skyscanner, or Google Flights is a new adapter file + one line change in `app.ts`. No service changes required.

**Adding a database when needed**
When user accounts or saved trips are required: add Postgres via Prisma. The store's `syncToUrl` becomes `syncToUrl + syncToDb` in one place. No component changes.

**Caching upgrade path**
`node-cache` → Redis: change one line in `cache.ts`. The service layer doesn't know what's caching it.

**Multi-passenger support**
`FlightSearchParams` already has an `adults` field hardcoded to 1. Unlocking it is a UI change + removing the hardcode.

**Currency support**
`currency: "USD"` is already a parameter in `FlightSearchParams`. Adding a currency selector is a store field + passing it through the existing API contract.

**Search filters (stops, airline, time)**
`FlightSearchParams` is extended with optional filter fields. Each provider adapter maps them to its own API params. No other layer changes.

**Analytics / observability**
Pino (already in Fastify) outputs structured JSON logs. Plugging in Datadog, Logtail, or Sentry is a transport config change.

**Moving to a monorepo with CI/CD**
The folder structure is already monorepo-shaped (`packages/shared`, `frontend/`, `backend/`). Adding Turborepo or Nx is a config addition, not a restructure.

**Rate limiting upgrade**
MVP uses IP-based rate limiting in Fastify middleware. Upgrading to user-based limits post-auth is a middleware swap.

**What to explicitly NOT build yet:**
- No message queues (no async jobs needed)
- No microservices (one backend service is correct for this scale)
- No GraphQL (REST is simpler, sufficient, and easier to cache)
- No SSR (SPA is fine; SEO is not a priority for a planning tool)
- No Docker for MVP dev (node + npm scripts is faster to onboard)
