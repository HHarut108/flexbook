# Data Model — Trip Planner MVP

---

## Placement Convention

| Layer | What lives here |
|---|---|
| `packages/shared/types/` | Everything FE and BE both consume |
| `backend/src/types/` | BE-only: raw provider responses, internal cache keys |
| `frontend/src/types/` | FE-only: UI state, component props |

---

## 1. City

**Purpose:** Represents a human-readable city used in autocomplete display and itinerary labels. Not used for flight search directly — Airport is the canonical search unit.

**Layer:** Shared

### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `string` | ✅ | Unique city identifier (e.g. `"city:barcelona"`) |
| `name` | `string` | ✅ | Display name (e.g. `"Barcelona"`) |
| `countryCode` | `string` | ✅ | ISO 3166-1 alpha-2 (e.g. `"ES"`) |
| `countryName` | `string` | ✅ | Full country name (e.g. `"Spain"`) |
| `lat` | `number` | ✅ | Latitude |
| `lng` | `number` | ✅ | Longitude |

### Example JSON

```json
{
  "id": "city:barcelona",
  "name": "Barcelona",
  "countryCode": "ES",
  "countryName": "Spain",
  "lat": 41.3851,
  "lng": 2.1734
}
```

### TypeScript Interface

```typescript
// packages/shared/types/city.ts

export interface City {
  id: string;
  name: string;
  countryCode: string;
  countryName: string;
  lat: number;
  lng: number;
}
```

---

## 2. Airport

**Purpose:** The canonical unit for all flight searches and trip chain entries. Extends city-level data with IATA code and airport-specific metadata. Used in autocomplete, nearby airport suggestions, and as origin/destination identifiers throughout the session.

**Layer:** Shared

### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `iata` | `string` | ✅ | 3-letter IATA code (e.g. `"BCN"`) — primary identifier |
| `name` | `string` | ✅ | Airport full name (e.g. `"Barcelona–El Prat Airport"`) |
| `city` | `City` | ✅ | Embedded city object |
| `timezone` | `string` | ✅ | IANA timezone string (e.g. `"Europe/Madrid"`) |
| `distanceKm` | `number` | ❌ | Only populated in nearby airport results |

### Example JSON

```json
{
  "iata": "BCN",
  "name": "Barcelona–El Prat Airport",
  "city": {
    "id": "city:barcelona",
    "name": "Barcelona",
    "countryCode": "ES",
    "countryName": "Spain",
    "lat": 41.3851,
    "lng": 2.1734
  },
  "timezone": "Europe/Madrid",
  "distanceKm": null
}
```

### TypeScript Interface

```typescript
// packages/shared/types/airport.ts

import type { City } from './city';

export interface Airport {
  iata: string;
  name: string;
  city: City;
  timezone: string;
  distanceKm?: number;
}
```

---

## 3. FlightOption

**Purpose:** A single one-way flight result returned by the BE after normalization. This is what the FE renders as a flight card. Contains everything needed to display the option, confirm the leg, and link to booking.

**Layer:** Shared

### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `flightId` | `string` | ✅ | Stable ID from provider — used for booking URL construction |
| `originIata` | `string` | ✅ | Departure airport IATA |
| `originCity` | `string` | ✅ | Departure city name |
| `destinationIata` | `string` | ✅ | Arrival airport IATA |
| `destinationCity` | `string` | ✅ | Arrival city name |
| `destinationCountry` | `string` | ✅ | Arrival country name |
| `destinationLat` | `number` | ✅ | Used for weather batch request |
| `destinationLng` | `number` | ✅ | Used for weather batch request |
| `departureDatetime` | `string` | ✅ | ISO 8601 datetime |
| `arrivalDatetime` | `string` | ✅ | ISO 8601 datetime |
| `durationMinutes` | `number` | ✅ | Total trip duration in minutes |
| `airlineName` | `string` | ✅ | Primary operating airline |
| `stops` | `number` | ✅ | 0 = direct, 1+ = connecting |
| `viaIatas` | `string[]` | ❌ | Intermediate airport IATA codes. e.g. `["BUD"]` for BCN→BUD→EVN. Populated by Kiwi route segments and mock provider |
| `priceUsd` | `number` | ✅ | Price in USD |
| `bookingUrl` | `string` | ✅ | Deep link to provider booking page |
| `weather` | `WeatherSummary` | ❌ | Populated asynchronously after card render |

### Example JSON

```json
{
  "flightId": "kiwi_abc123",
  "originIata": "BCN",
  "originCity": "Barcelona",
  "destinationIata": "LIS",
  "destinationCity": "Lisbon",
  "destinationCountry": "Portugal",
  "destinationLat": 38.7749,
  "destinationLng": -9.1342,
  "departureDatetime": "2025-05-10T06:00:00Z",
  "arrivalDatetime": "2025-05-10T07:45:00Z",
  "durationMinutes": 105,
  "airlineName": "Ryanair",
  "stops": 0,
  "priceUsd": 34,
  "bookingUrl": "https://www.kiwi.com/deep?flightId=kiwi_abc123",
  "weather": null
}

// 1-stop example: BCN → BUD → EVN
{
  "flightId": "kiwi_xyz789",
  "originIata": "BCN",
  "originCity": "Barcelona",
  "destinationIata": "EVN",
  "destinationCity": "Yerevan",
  "destinationCountry": "Armenia",
  "destinationLat": 40.1473,
  "destinationLng": 44.3959,
  "departureDatetime": "2025-05-10T06:00:00Z",
  "arrivalDatetime": "2025-05-10T14:15:00Z",
  "durationMinutes": 495,
  "airlineName": "Wizz Air",
  "stops": 1,
  "viaIatas": ["BUD"],
  "priceUsd": 89,
  "bookingUrl": "https://www.kiwi.com/deep?flightId=kiwi_xyz789",
  "weather": null
}
```

### TypeScript Interface

```typescript
// packages/shared/types/flight.ts

import type { WeatherSummary } from './weather';

export interface FlightOption {
  flightId: string;
  originIata: string;
  originCity: string;
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
  viaIatas?: string[];       // intermediate airport codes, e.g. ['BUD'] for BCN→BUD→EVN
  priceUsd: number;
  bookingUrl: string;
  weather?: WeatherSummary;
}

export interface FlightSearchParams {
  originIata: string;
  date: string;               // YYYY-MM-DD
  destinationIata?: string;   // Only set for return-home search
  adults: number;             // Hardcoded 1 for MVP
  currency: string;           // Hardcoded "USD" for MVP
}

export interface FlightProvider {
  searchFlights(params: FlightSearchParams): Promise<FlightOption[]>;
}
```

---

## 4. WeatherSummary

**Purpose:** Minimal weather data shown per destination on flight cards and in the final itinerary. Non-blocking — the UI renders without it and fills it in when available.

**Layer:** Shared

### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `temperatureC` | `number` | ✅ | Integer degrees Celsius |
| `condition` | `WeatherCondition` | ✅ | One of 6 enum values |
| `isForecast` | `boolean` | ✅ | `true` = live forecast (≤10 days), `false` = climate average |
| `date` | `string` | ✅ | ISO date this weather applies to (`YYYY-MM-DD`) |

### WeatherCondition enum values

```
"clear" | "cloudy" | "rain" | "snow" | "storm" | "unknown"
```

### Example JSON

```json
{
  "temperatureC": 22,
  "condition": "clear",
  "isForecast": true,
  "date": "2025-05-10"
}
```

### Example batch request / response

```json
// Request body
[
  { "iata": "LIS", "lat": 38.7749, "lng": -9.1342, "date": "2025-05-10" },
  { "iata": "MAD", "lat": 40.4168, "lng": -3.7038, "date": "2025-05-10" }
]

// Response body (keyed by IATA)
{
  "LIS": { "temperatureC": 22, "condition": "clear", "isForecast": true, "date": "2025-05-10" },
  "MAD": { "temperatureC": 19, "condition": "cloudy", "isForecast": true, "date": "2025-05-10" }
}
```

### TypeScript Interface

```typescript
// packages/shared/types/weather.ts

export type WeatherCondition =
  | 'clear'
  | 'cloudy'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'unknown';

export interface WeatherSummary {
  temperatureC: number;
  condition: WeatherCondition;
  isForecast: boolean;
  date: string;
}

export interface WeatherRequest {
  iata: string;
  lat: number;
  lng: number;
  date: string;
}

export type WeatherBatchResponse = Record<string, WeatherSummary>;

export interface WeatherProvider {
  getWeather(lat: number, lng: number, date: string): Promise<WeatherSummary>;
}
```

---

## 5. TripLeg

**Purpose:** A confirmed, user-selected flight that has been added to the trip chain. Extends FlightOption with stay planning data. This is the core unit of the trip chain stored in Zustand and serialized to the URL.

**Layer:** Shared

### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `stopIndex` | `number` | ✅ | 1-based position in trip (1 = first flight) |
| `flightId` | `string` | ✅ | From FlightOption |
| `originIata` | `string` | ✅ | From FlightOption |
| `originCity` | `string` | ✅ | From FlightOption |
| `destinationIata` | `string` | ✅ | From FlightOption |
| `destinationCity` | `string` | ✅ | From FlightOption |
| `destinationCountry` | `string` | ✅ | From FlightOption |
| `destinationLat` | `number` | ✅ | From FlightOption |
| `destinationLng` | `number` | ✅ | From FlightOption |
| `departureDatetime` | `string` | ✅ | ISO 8601 |
| `arrivalDatetime` | `string` | ✅ | ISO 8601 |
| `durationMinutes` | `number` | ✅ | From FlightOption |
| `airlineName` | `string` | ✅ | From FlightOption |
| `stops` | `number` | ✅ | From FlightOption |
| `viaIatas` | `string[]` | ❌ | From FlightOption — intermediate stop IATAs |
| `priceUsd` | `number` | ✅ | From FlightOption |
| `bookingUrl` | `string` | ✅ | From FlightOption |
| `stayDurationDays` | `number` | ✅ | User-entered stay (1–90) |
| `nextDepartureDate` | `string` | ✅ | Calculated: arrival date + stayDurationDays |
| `isReturn` | `boolean` | ✅ | `true` only for the final leg home |
| `weather` | `WeatherSummary` | ❌ | Weather on arrival date at destination |

### Example JSON

```json
{
  "stopIndex": 1,
  "flightId": "kiwi_abc123",
  "originIata": "BCN",
  "originCity": "Barcelona",
  "destinationIata": "LIS",
  "destinationCity": "Lisbon",
  "destinationCountry": "Portugal",
  "destinationLat": 38.7749,
  "destinationLng": -9.1342,
  "departureDatetime": "2025-05-10T06:00:00Z",
  "arrivalDatetime": "2025-05-10T07:45:00Z",
  "durationMinutes": 105,
  "airlineName": "Ryanair",
  "stops": 0,
  "priceUsd": 34,
  "bookingUrl": "https://www.kiwi.com/deep?flightId=kiwi_abc123",
  "stayDurationDays": 4,
  "nextDepartureDate": "2025-05-14",
  "isReturn": false,
  "weather": {
    "temperatureC": 22,
    "condition": "clear",
    "isForecast": true,
    "date": "2025-05-10"
  }
}
```

### TypeScript Interface

```typescript
// packages/shared/types/trip-leg.ts

import type { WeatherSummary } from './weather';

export interface TripLeg {
  stopIndex: number;
  flightId: string;
  originIata: string;
  originCity: string;
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
  weather?: WeatherSummary;
}

export type TripLegInput = {
  stopIndex: number;
  flight: import('./flight').FlightOption;
  stayDurationDays: number;
  nextDepartureDate: string;
  isReturn: boolean;
};
```

---

## 6. Itinerary

**Purpose:** The complete, ordered trip chain including origin and all confirmed legs. Source of truth for the Zustand store and URL serialization. In the current MVP, shared trips are expected to restore from the URL itself rather than depend on a server-stored itinerary record.

**Layer:** Shared

### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `origin` | `Airport` | ✅ | User's departure airport |
| `legs` | `TripLeg[]` | ✅ | Ordered array, 1–16 entries (max 15 stops + 1 return) |
| `status` | `ItineraryStatus` | ✅ | `"planning"` or `"complete"` |
| `createdAt` | `string` | ✅ | ISO 8601 timestamp when trip planning started |
| `completedAt` | `string` | ❌ | ISO 8601 timestamp when return leg confirmed |

### Example JSON

```json
{
  "origin": {
    "iata": "BCN",
    "name": "Barcelona–El Prat Airport",
    "city": {
      "id": "city:barcelona",
      "name": "Barcelona",
      "countryCode": "ES",
      "countryName": "Spain",
      "lat": 41.3851,
      "lng": 2.1734
    },
    "timezone": "Europe/Madrid"
  },
  "legs": [
    {
      "stopIndex": 1,
      "flightId": "kiwi_abc123",
      "originIata": "BCN",
      "originCity": "Barcelona",
      "destinationIata": "LIS",
      "destinationCity": "Lisbon",
      "destinationCountry": "Portugal",
      "destinationLat": 38.7749,
      "destinationLng": -9.1342,
      "departureDatetime": "2025-05-10T06:00:00Z",
      "arrivalDatetime": "2025-05-10T07:45:00Z",
      "durationMinutes": 105,
      "airlineName": "Ryanair",
      "stops": 0,
      "priceUsd": 34,
      "bookingUrl": "https://www.kiwi.com/deep?flightId=kiwi_abc123",
      "stayDurationDays": 4,
      "nextDepartureDate": "2025-05-14",
      "isReturn": false,
      "weather": { "temperatureC": 22, "condition": "clear", "isForecast": true, "date": "2025-05-10" }
    }
  ],
  "status": "complete",
  "createdAt": "2025-04-01T10:00:00Z",
  "completedAt": "2025-04-01T10:08:00Z"
}
```

### TypeScript Interface

```typescript
// packages/shared/types/itinerary.ts

import type { Airport } from './airport';
import type { TripLeg } from './trip-leg';

export type ItineraryStatus = 'planning' | 'complete';

export interface Itinerary {
  origin: Airport;
  legs: TripLeg[];
  status: ItineraryStatus;
  createdAt: string;
  completedAt?: string;
}
```

---

## 7. ItinerarySummary

**Purpose:** A derived, read-only view model computed from a complete Itinerary. Used exclusively on the final itinerary screen to drive Timeline and Map rendering. Never stored — always computed on demand.

**Layer:** Frontend only (`frontend/src/types/`)

### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `totalPriceUsd` | `number` | ✅ | Sum of all leg `priceUsd` values |
| `totalLegs` | `number` | ✅ | Count of all legs including return |
| `totalDestinations` | `number` | ✅ | Count of non-return legs |
| `tripDurationDays` | `number` | ✅ | Days from first departure to return arrival |
| `legs` | `TripLeg[]` | ✅ | Ordered legs (from Itinerary) |
| `mapPins` | `MapPin[]` | ✅ | Derived pin data for map rendering |
| `hasMissingPrices` | `boolean` | ✅ | `true` if any leg has null/undefined price |
| `missingPriceCount` | `number` | ✅ | Count of legs with missing price |
| `generatedAt` | `string` | ✅ | ISO timestamp of summary generation |

### TypeScript Interface

```typescript
// frontend/src/types/itinerary-summary.ts

import type { TripLeg } from '@shared/types/trip-leg';

export interface MapPin {
  pinIndex: number;
  iata: string;
  city: string;
  lat: number;
  lng: number;
  arrivalDate?: string;
  stayDurationDays?: number;
  isOrigin: boolean;
  isReturn: boolean;
}

export interface ItinerarySummary {
  totalPriceUsd: number;
  totalLegs: number;
  totalDestinations: number;
  tripDurationDays: number;
  legs: TripLeg[];
  mapPins: MapPin[];
  hasMissingPrices: boolean;
  missingPriceCount: number;
  generatedAt: string;
}

export type BuildItinerarySummary = (
  itinerary: import('@shared/types/itinerary').Itinerary
) => ItinerarySummary;
```

---

## 8. SearchSession

**Purpose:** Captures the current planning state during the active flow. Ephemeral UI state that lives only in Zustand — never serialized to the URL.

**Layer:** Frontend only (`frontend/src/types/`)

### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `currentScreen` | `AppScreen` | ✅ | Which screen is active |
| `currentStopIndex` | `number` | ✅ | 1-based; increments on each leg confirmation |
| `pendingOriginIata` | `string` | ❌ | Origin IATA for the in-progress flight search |
| `pendingDate` | `string` | ❌ | Date string `YYYY-MM-DD` for in-progress search |
| `flightResults` | `FlightOption[]` | ❌ | Results from last flight search |
| `flightResultsLoading` | `boolean` | ✅ | True while flight search is in progress |
| `flightResultsError` | `string` | ❌ | Error message if flight search failed |
| `selectedFlight` | `FlightOption` | ❌ | Flight user tapped but not yet confirmed |
| `pendingStayDays` | `number` | ❌ | Stay duration in progress (not yet confirmed) |
| `weatherMap` | `WeatherBatchResponse` | ❌ | Keyed by IATA; fills asynchronously |
| `weatherLoading` | `boolean` | ✅ | True while weather batch is in progress |

### AppScreen enum values

```
"home" | "flight-results" | "stay-duration" | "decision" | "return-flights" | "itinerary"
```

> **Note:** `"date-picker"` was removed as a standalone screen. Date selection now happens via the `DatePickerOverlay` bottom-sheet modal, opened inline from the `"flight-results"` and `"return-flights"` screens.

### TypeScript Interface

```typescript
// frontend/src/types/search-session.ts

import type { FlightOption } from '@shared/types/flight';
import type { WeatherBatchResponse } from '@shared/types/weather';

export type AppScreen =
  | 'home'
  | 'flight-results'
  | 'stay-duration'
  | 'decision'
  | 'return-flights'
  | 'itinerary';

export interface SearchSession {
  currentScreen: AppScreen;
  currentStopIndex: number;
  pendingOriginIata?: string;
  pendingDate?: string;
  flightResults: FlightOption[];
  flightResultsLoading: boolean;
  flightResultsError?: string;
  selectedFlight?: FlightOption;
  pendingStayDays?: number;
  weatherMap: WeatherBatchResponse;
  weatherLoading: boolean;
}
```

---

## 9. DateSwitcher

**Purpose:** Encapsulates the state and constraints of the date navigation control shown above flight results. Computed from session state, not stored independently.

**Layer:** Frontend only (`frontend/src/types/`)

### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `currentDate` | `string` | ✅ | Active date `YYYY-MM-DD` |
| `minDate` | `string` | ✅ | Earliest selectable date |
| `maxDate` | `string` | ✅ | Latest selectable date (today + 365) |
| `canGoBack` | `boolean` | ✅ | `currentDate > minDate` |
| `canGoForward` | `boolean` | ✅ | `currentDate < maxDate` |
| `previousDate` | `string` | ❌ | Only present if `canGoBack` is true |
| `nextDate` | `string` | ❌ | Only present if `canGoForward` is true |

### TypeScript Interface

```typescript
// frontend/src/types/date-switcher.ts

export interface DateSwitcher {
  currentDate: string;
  minDate: string;
  maxDate: string;
  canGoBack: boolean;
  canGoForward: boolean;
  previousDate?: string;
  nextDate?: string;
}

export type BuildDateSwitcher = (
  currentDate: string,
  minDate: string,
  maxDate: string
) => DateSwitcher;
```

---

## 10. Provider Response Normalization Models

**Purpose:** Typed representations of raw external API responses. BE-internal only — never exposed to FE or shared types.

**Layer:** Backend only (`backend/src/providers/`)

### Kiwi Raw Response Types

```typescript
// backend/src/providers/flights/kiwi.types.ts

export interface KiwiApiResponse {
  data: KiwiItinerary[];
  _results: number;
  search_id: string;
}

export interface KiwiItinerary {
  id: string;
  flyFrom: string;
  flyTo: string;
  cityFrom: string;
  cityTo: string;
  countryTo: { code: string; name: string };
  latitudeTo: number;
  longitudeTo: number;
  dTime: number;             // Unix timestamp departure
  aTime: number;             // Unix timestamp arrival
  duration: {
    departure: number;
    return: number;
    total: number;           // seconds
  };
  price: number;
  airlines: string[];
  route: KiwiRouteSegment[];
  deep_link: string;
  availability: { seats: number };
}

export interface KiwiRouteSegment {
  id: string;
  flyFrom: string;
  flyTo: string;
  airline: string;
  operating_carrier: string;
  equipment: string | null;
}
```

### OpenWeatherMap Raw Response Types

```typescript
// backend/src/providers/weather/owm.types.ts

export interface OWMForecastResponse {
  list: OWMForecastEntry[];
  city: {
    id: number;
    name: string;
    coord: { lat: number; lon: number };
    country: string;
    timezone: number;
  };
}

export interface OWMForecastEntry {
  dt: number;
  dt_txt: string;            // "YYYY-MM-DD HH:MM:SS"
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
  };
  weather: Array<{
    id: number;
    main: string;            // "Clear", "Clouds", "Rain", etc.
    description: string;
    icon: string;
  }>;
  clouds: { all: number };
  wind: { speed: number; deg: number };
}
```

### Airport Static Dataset Entry

```typescript
// backend/src/providers/airports/airport-data.types.ts

export interface AirportDataEntry {
  iata: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  timezone: string;
}
```

---

## Model Layer Summary

| Model | Layer | Stored in URL | Stored in Zustand | Computed |
|---|---|---|---|---|
| `City` | Shared | Via Airport | Via Airport | No |
| `Airport` | Shared | Yes (origin) | Yes | No |
| `FlightOption` | Shared | No | Yes (results) | No |
| `WeatherSummary` | Shared | Via TripLeg | Via weatherMap | No |
| `TripLeg` | Shared | Yes | Yes | No |
| `Itinerary` | Shared | Yes | Yes | No |
| `ItinerarySummary` | Frontend | No | No | Yes — from Itinerary |
| `SearchSession` | Frontend | No | Yes | No |
| `DateSwitcher` | Frontend | No | No | Yes — from session |
| `KiwiApiResponse` | Backend | No | No | No |
| `OWMForecastResponse` | Backend | No | No | No |
| `AirportDataEntry` | Backend | No | No | No |
