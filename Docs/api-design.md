# REST API Design — Trip Planner MVP

---

## API Conventions

```
Base URL:        https://api.tripplanner.app/v1
Content-Type:    application/json
Auth:            None (MVP — no auth)
Rate limiting:   60 req/min per IP on flight endpoints
                 120 req/min per IP on all other endpoints
```

**Standard response envelope:**

```json
// Success
{
  "success": true,
  "data": { }
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "retryable": false,
    "details": { }
  }
}
```

**Standard error codes:**

| Code | HTTP Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request failed schema/business validation |
| `NOT_FOUND` | 404 | Resource not found |
| `FLIGHT_API_ERROR` | 502 | External flight provider failed |
| `WEATHER_API_ERROR` | 502 | External weather provider failed |
| `FLIGHT_API_TIMEOUT` | 504 | External flight provider timed out |
| `RATE_LIMITED` | 429 | Too many requests from this IP |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## MVP Alignment Status

The current product source of truth is [\_docs_product-definition.md](/Users/harut/Desktop/Fast-Travel-Assistant/Docs/_docs_product-definition.md) plus [prd-alignment-decisions.md](/Users/harut/Desktop/Fast-Travel-Assistant/Docs/prd-alignment-decisions.md).

For the current MVP:

- Required backend endpoints are `GET /airports/search`, `GET /airports/nearby`, `GET /flights/search`, and `POST /weather/batch`
- Trip planning state should survive refresh via URL state
- Shared trips should open from the URL alone and should not depend on an expiring server-side record
- The `/itineraries/*` endpoints documented below are legacy exploratory API design and should be treated as optional future enhancement, not required MVP scope

---

## Itinerary State Machine

```
[POST /itineraries]           → status: "planning"
        │
        ▼
[POST /itineraries/:id/legs]  → adds leg, status: "planning"
        │
        │  (repeat up to 15 times)
        │
        ▼
[POST /itineraries/:id/finalize] → status: "complete"
        │
        ▼
[GET  /itineraries/:id]       → read-only itinerary
```

---

## Endpoint Index

| # | Method | Route | Purpose |
|---|---|---|---|
| 1 | GET | `/airports/search` | Search cities and airports |
| 2 | GET | `/airports/nearby` | Get nearby airports for a given airport |
| 3 | GET | `/flights/search` | Search cheapest one-way flights for a leg |
| 4 | POST | `/weather/batch` | Get weather for multiple destinations |
| 5 | POST | `/itineraries` | Create a new itinerary session |
| 6 | POST | `/itineraries/:id/legs` | Add a confirmed leg to the itinerary |
| 7 | PATCH | `/itineraries/:id/legs/:stopIndex/date` | Update departure date for a leg in progress |
| 8 | PATCH | `/itineraries/:id/legs/:stopIndex/stay` | Set stay duration for a confirmed leg |
| 9 | GET | `/itineraries/:id/next-flights` | Get flight options to continue the trip |
| 10 | GET | `/itineraries/:id/return-flights` | Get cheapest flights home |
| 11 | POST | `/itineraries/:id/finalize` | Mark itinerary as complete |
| 12 | GET | `/itineraries/:id` | Get full itinerary by ID |

---

## 1. Search Cities / Airports

### `GET /airports/search`

**Purpose:** Power the origin input autocomplete. Returns ranked airport suggestions matching a text query. Airport data is a static JSON dataset loaded in memory at server startup — no external API call.

**Query Parameters:**

| Param | Type | Required | Validation |
|---|---|---|---|
| `q` | `string` | ✅ | Min 2 chars, max 100 chars |
| `limit` | `number` | ❌ | Default 7, max 10 |

**Response Body:**

```typescript
{
  "success": true,
  "data": {
    "airports": Airport[]
  }
}
```

**Validation Rules:**
- `q` must be at least 2 non-whitespace characters
- `q` is trimmed before search
- Results ranked: exact IATA match → city prefix → fuzzy name match
- Only airports with `scheduled_service: true` in dataset returned
- Cities with multiple airports return each airport as a separate result

**Error Responses:**

| Scenario | Code | HTTP |
|---|---|---|
| `q` missing or < 2 chars | `VALIDATION_ERROR` | 400 |
| `q` > 100 chars | `VALIDATION_ERROR` | 400 |

**Example Request:**
```
GET /v1/airports/search?q=bar&limit=5
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "airports": [
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
        "timezone": "Europe/Madrid"
      }
    ]
  }
}
```

---

## 2. Get Nearby Airports

### `GET /airports/nearby`

**Purpose:** After origin is selected, surface alternative departure airports within 150km radius. Uses Haversine distance on in-memory airport dataset.

**Query Parameters:**

| Param | Type | Required | Validation |
|---|---|---|---|
| `iata` | `string` | ✅ | Valid 3-letter IATA code |
| `radiusKm` | `number` | ❌ | Default 150, max 300 |
| `limit` | `number` | ❌ | Default 3, max 5 |

**Response Body:**

```typescript
{
  "success": true,
  "data": {
    "airports": Airport[]   // Each has distanceKm populated, sorted ascending
  }
}
```

**Validation Rules:**
- `iata` must match `/^[A-Z]{3}$/`
- `iata` must exist in the airport dataset
- Source airport excluded from results
- Results sorted by `distanceKm` ascending
- If 0 nearby airports found, returns empty array (not an error)

**Error Responses:**

| Scenario | Code | HTTP |
|---|---|---|
| `iata` missing | `VALIDATION_ERROR` | 400 |
| `iata` invalid format | `VALIDATION_ERROR` | 400 |
| `iata` not found in dataset | `NOT_FOUND` | 404 |

**Example Request:**
```
GET /v1/airports/nearby?iata=BCN&radiusKm=150&limit=3
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "airports": [
      {
        "iata": "GRO",
        "name": "Girona–Costa Brava Airport",
        "city": {
          "id": "city:girona",
          "name": "Girona",
          "countryCode": "ES",
          "countryName": "Spain",
          "lat": 41.9010,
          "lng": 2.7605
        },
        "timezone": "Europe/Madrid",
        "distanceKm": 98
      }
    ]
  }
}
```

---

## 3. Search Flights for a Leg

### `GET /flights/search`

**Purpose:** Core flight search. Returns up to 10 cheapest one-way flights from a given origin on a given date. BE proxies to flight provider, normalizes, deduplicates by destination, sorts by price, and caches for 5 minutes.

**Query Parameters:**

| Param | Type | Required | Validation |
|---|---|---|---|
| `originIata` | `string` | ✅ | Valid IATA, must exist in dataset |
| `date` | `string` | ✅ | `YYYY-MM-DD`, must be ≥ tomorrow |
| `destinationIata` | `string` | ❌ | Valid IATA; if passed, restricts to that route |
| `currency` | `string` | ❌ | Default `"USD"`, ISO 4217 |

**Response Body:**

```typescript
{
  "success": true,
  "data": {
    "flights": FlightOption[],
    "searchMeta": {
      "originIata": string,
      "date": string,
      "currency": string,
      "resultCount": number,
      "cachedAt": string | null
    }
  }
}
```

**Validation Rules:**
- `originIata` must match `/^[A-Z]{3}$/`
- `date` must be today + 1 at minimum (BE enforces server-side)
- `date` must not exceed today + 365
- `destinationIata` if provided: must be valid IATA and must differ from `originIata`
- Results deduplicated: only cheapest flight per unique `destinationIata` returned
- Results sorted by `priceUsd` ascending; tiebreak by `durationMinutes` ascending
- Maximum 10 results returned

**Error Responses:**

| Scenario | Code | HTTP |
|---|---|---|
| `originIata` missing/invalid | `VALIDATION_ERROR` | 400 |
| `date` in the past | `VALIDATION_ERROR` | 400 |
| `date` beyond 365 days | `VALIDATION_ERROR` | 400 |
| `originIata` === `destinationIata` | `VALIDATION_ERROR` | 400 |
| Provider API failure | `FLIGHT_API_ERROR` | 502 |
| Provider timeout | `FLIGHT_API_TIMEOUT` | 504 |
| 0 results (valid, not error) | — | 200 with empty array |

**Example Request:**
```
GET /v1/flights/search?originIata=BCN&date=2025-05-10&currency=USD
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "flights": [
      {
        "flightId": "serpapi_abc123",
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
        "bookingUrl": "https://www.google.com/flights#search;f=BCN;t=LIS;d=2025-05-10;tt=o",
        "weather": null
      }
    ],
    "searchMeta": {
      "originIata": "BCN",
      "date": "2025-05-10",
      "currency": "USD",
      "resultCount": 1,
      "cachedAt": null
    }
  }
}
```

---

## 4. Get Destination Weather (Batch)

### `POST /weather/batch`

**Purpose:** Fetch minimal weather for multiple destinations at once. Called after flight results are returned. Non-blocking from FE perspective.

**Request Body:**

```typescript
{
  "requests": WeatherRequest[]  // max 10 items
}
```

**Response Body:**

```typescript
{
  "success": true,
  "data": {
    "weather": Record<string, WeatherSummary>  // keyed by iata
  }
}
```

**Validation Rules:**
- `requests` array: min 1, max 10 items
- Each item must have `iata`, `lat`, `lng`, `date`
- `iata` must match `/^[A-Z]{3}$/`
- `lat` must be ∈ [-90, 90], `lng` must be ∈ [-180, 180]
- `date` must be valid `YYYY-MM-DD`
- If weather for a specific destination fails, that key is omitted from response
- BE fetches in parallel; total timeout 5s across all requests

**Error Responses:**

| Scenario | Code | HTTP |
|---|---|---|
| `requests` missing or empty | `VALIDATION_ERROR` | 400 |
| `requests` > 10 items | `VALIDATION_ERROR` | 400 |
| Any item missing required field | `VALIDATION_ERROR` | 400 |
| All weather fetches fail | `WEATHER_API_ERROR` | 502 |
| Some fail, some succeed | 200 with partial data |  |

**Example Request:**
```
POST /v1/weather/batch
```
```json
{
  "requests": [
    { "iata": "LIS", "lat": 38.7749, "lng": -9.1342, "date": "2025-05-10" },
    { "iata": "MAD", "lat": 40.4168, "lng": -3.7038, "date": "2025-05-10" }
  ]
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "weather": {
      "LIS": { "temperatureC": 22, "condition": "clear", "isForecast": true, "date": "2025-05-10" },
      "MAD": { "temperatureC": 19, "condition": "cloudy", "isForecast": true, "date": "2025-05-10" }
    }
  }
}
```

---

## 5. Create Itinerary

### `POST /itineraries`

**Purpose:** Initialize a new itinerary session. Called once when the user confirms their origin airport and departure date. Stored in BE in-memory cache with a 24-hour TTL.

**Request Body:**

```typescript
{
  "origin": {
    "iata": string,
    "name": string,
    "city": {
      "id": string,
      "name": string,
      "countryCode": string,
      "countryName": string,
      "lat": number,
      "lng": number
    },
    "timezone": string
  },
  "departureDate": string   // YYYY-MM-DD
}
```

**Response Body:**

```typescript
{
  "success": true,
  "data": {
    "itineraryId": string,    // UUID v4
    "origin": Airport,
    "status": "planning",
    "createdAt": string,
    "legs": [],
    "nextDepartureDate": string
  }
}
```

**Validation Rules:**
- `origin.iata` must match `/^[A-Z]{3}$/` and exist in airport dataset
- `departureDate` must be today + 1 minimum
- `departureDate` must not exceed today + 365
- All `origin` fields are required

**Error Responses:**

| Scenario | Code | HTTP |
|---|---|---|
| Any required field missing | `VALIDATION_ERROR` | 400 |
| `origin.iata` invalid format | `VALIDATION_ERROR` | 400 |
| `departureDate` in the past | `VALIDATION_ERROR` | 400 |

**Example Request:**
```
POST /v1/itineraries
```
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
  "departureDate": "2025-05-10"
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "itineraryId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "origin": { "iata": "BCN", "name": "Barcelona–El Prat Airport" },
    "status": "planning",
    "createdAt": "2025-04-01T10:00:00Z",
    "legs": [],
    "nextDepartureDate": "2025-05-10"
  }
}
```

---

## 6. Add Leg to Itinerary

### `POST /itineraries/:id/legs`

**Purpose:** Confirm a selected flight and add it as the next leg. BE validates leg is consistent with current itinerary state.

**Path Parameters:**

| Param | Type | Required |
|---|---|---|
| `id` | `string` | ✅ UUID of itinerary |

**Request Body:**

```typescript
{
  "stopIndex": number,
  "flight": {
    "flightId": string,
    "originIata": string,
    "originCity": string,
    "destinationIata": string,
    "destinationCity": string,
    "destinationCountry": string,
    "destinationLat": number,
    "destinationLng": number,
    "departureDatetime": string,
    "arrivalDatetime": string,
    "durationMinutes": number,
    "airlineName": string,
    "stops": number,
    "priceUsd": number,
    "bookingUrl": string
  },
  "isReturn": boolean
}
```

**Response Body:**

```typescript
{
  "success": true,
  "data": {
    "itineraryId": string,
    "stopIndex": number,
    "leg": TripLeg,
    "totalLegs": number,
    "canContinue": boolean,
    "nextStopIndex": number,
    "status": "planning"
  }
}
```

**Validation Rules:**
- Itinerary must exist and have `status: "planning"`
- `stopIndex` must equal `currentLegs.length + 1`
- `stopIndex` must be ≤ 15 for non-return legs
- `flight.originIata` must match previous leg's `destinationIata` (or itinerary origin for leg 1)
- `flight.departureDatetime` must be ≥ previous leg's `arrivalDatetime`
- If `isReturn: true`, `flight.destinationIata` must equal itinerary `origin.iata`
- `flight.priceUsd` must be > 0

**Error Responses:**

| Scenario | Code | HTTP |
|---|---|---|
| Itinerary not found | `NOT_FOUND` | 404 |
| Itinerary already complete | `VALIDATION_ERROR` | 400 |
| `stopIndex` out of sequence | `VALIDATION_ERROR` | 400 |
| Stop count would exceed 15 | `VALIDATION_ERROR` | 400 |
| Origin continuity broken | `VALIDATION_ERROR` | 400 |
| Departure before previous arrival | `VALIDATION_ERROR` | 400 |

**Example Request:**
```
POST /v1/itineraries/a1b2c3d4-e5f6-7890-abcd-ef1234567890/legs
```
```json
{
  "stopIndex": 1,
  "flight": {
    "flightId": "serpapi_abc123",
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
    "bookingUrl": "https://www.google.com/flights#search;f=BCN;t=LIS;d=2025-05-10;tt=o"
  },
  "isReturn": false
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "itineraryId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "stopIndex": 1,
    "leg": {
      "stopIndex": 1,
      "flightId": "serpapi_abc123",
      "originIata": "BCN",
      "destinationIata": "LIS",
      "destinationCity": "Lisbon",
      "priceUsd": 34,
      "stayDurationDays": 0,
      "isReturn": false
    },
    "totalLegs": 1,
    "canContinue": true,
    "nextStopIndex": 2,
    "status": "planning"
  }
}
```

---

## 7. Update Leg Departure Date

### `PATCH /itineraries/:id/legs/:stopIndex/date`

**Purpose:** Change the departure date for the leg currently being browsed (before flight is confirmed). Used by the date switcher.

**Path Parameters:**

| Param | Type | Required |
|---|---|---|
| `id` | `string` | ✅ UUID |
| `stopIndex` | `number` | ✅ 1-based stop being browsed |

**Request Body:**

```typescript
{
  "date": string    // YYYY-MM-DD
}
```

**Response Body:**

```typescript
{
  "success": true,
  "data": {
    "itineraryId": string,
    "stopIndex": number,
    "updatedDate": string,
    "minDate": string,
    "maxDate": string
  }
}
```

**Validation Rules:**
- Itinerary must exist with `status: "planning"`
- `stopIndex` must equal `currentLegs.length + 1` (unconfirmed leg only)
- For stop 1: `date` ≥ today + 1
- For stop N: `date` ≥ previous leg's arrival date + 1 day
- `date` ≤ today + 365
- Does NOT modify any confirmed legs

**Error Responses:**

| Scenario | Code | HTTP |
|---|---|---|
| Itinerary not found | `NOT_FOUND` | 404 |
| `stopIndex` refers to confirmed leg | `VALIDATION_ERROR` | 400 |
| `date` before minimum allowed | `VALIDATION_ERROR` | 400 |
| `date` beyond 365 days | `VALIDATION_ERROR` | 400 |

**Example Request:**
```
PATCH /v1/itineraries/a1b2c3d4-e5f6-7890-abcd-ef1234567890/legs/2/date
```
```json
{ "date": "2025-05-15" }
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "itineraryId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "stopIndex": 2,
    "updatedDate": "2025-05-15",
    "minDate": "2025-05-11",
    "maxDate": "2026-04-01"
  }
}
```

---

## 8. Set Stay Duration

### `PATCH /itineraries/:id/legs/:stopIndex/stay`

**Purpose:** Record how many days the user plans to stay. BE computes `nextDepartureDate` and returns recommendation text from static lookup.

**Path Parameters:**

| Param | Type | Required |
|---|---|---|
| `id` | `string` | ✅ UUID |
| `stopIndex` | `number` | ✅ 1-based, must be a confirmed leg |

**Request Body:**

```typescript
{
  "stayDurationDays": number    // integer, 1–90
}
```

**Response Body:**

```typescript
{
  "success": true,
  "data": {
    "itineraryId": string,
    "stopIndex": number,
    "stayDurationDays": number,
    "nextDepartureDate": string,
    "recommendationText": string | null,
    "warningMessage": string | null
  }
}
```

**Validation Rules:**
- `stayDurationDays` must be integer ≥ 1 and ≤ 90
- `nextDepartureDate` = arrivalDate of the leg + `stayDurationDays`
- If `nextDepartureDate` > today + 365: valid but `warningMessage` set
- `recommendationText` looked up by `destinationIata`; `null` if not found
- Idempotent: calling again on same stopIndex overwrites previous stay

**Error Responses:**

| Scenario | Code | HTTP |
|---|---|---|
| Itinerary not found | `NOT_FOUND` | 404 |
| `stopIndex` not a confirmed leg | `VALIDATION_ERROR` | 400 |
| `stayDurationDays` < 1 or > 90 | `VALIDATION_ERROR` | 400 |

**Example Request:**
```
PATCH /v1/itineraries/a1b2c3d4-e5f6-7890-abcd-ef1234567890/legs/1/stay
```
```json
{ "stayDurationDays": 4 }
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "itineraryId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "stopIndex": 1,
    "stayDurationDays": 4,
    "nextDepartureDate": "2025-05-14",
    "recommendationText": "Typically 3 days is enough to explore Lisbon.",
    "warningMessage": null
  }
}
```

---

## 9. Get Next Flight Options (Continue Trip)

### `GET /itineraries/:id/next-flights`

**Purpose:** Fetch next cheapest flights when user chooses to continue. BE derives `originIata` and `date` from itinerary state so FE doesn't have to compute these.

**Path Parameters:**

| Param | Type | Required |
|---|---|---|
| `id` | `string` | ✅ UUID |

**Query Parameters:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `dateOverride` | `string` | ❌ | `YYYY-MM-DD` — used when user changes date on results screen |

**Response Body:**

```typescript
{
  "success": true,
  "data": {
    "flights": FlightOption[],
    "searchMeta": {
      "originIata": string,
      "originCity": string,
      "date": string,
      "stopIndex": number,
      "stopsRemaining": number,
      "currency": "USD",
      "resultCount": number,
      "cachedAt": string | null
    }
  }
}
```

**Validation Rules:**
- Itinerary must exist with `status: "planning"`
- Last confirmed leg must have `stayDurationDays` set
- `stopsRemaining` must be > 0
- BE derives: `originIata` = last leg `destinationIata`, `date` = last leg `nextDepartureDate`

**Error Responses:**

| Scenario | Code | HTTP |
|---|---|---|
| Itinerary not found | `NOT_FOUND` | 404 |
| Stay duration not set on last leg | `VALIDATION_ERROR` | 400 |
| No stops remaining (at limit) | `VALIDATION_ERROR` | 400 |
| Provider failure | `FLIGHT_API_ERROR` | 502 |

**Example Request:**
```
GET /v1/itineraries/a1b2c3d4-e5f6-7890-abcd-ef1234567890/next-flights
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "flights": [
      {
        "flightId": "serpapi_ghi789",
        "originIata": "LIS",
        "originCity": "Lisbon",
        "destinationIata": "FAO",
        "destinationCity": "Faro",
        "destinationCountry": "Portugal",
        "destinationLat": 37.0144,
        "destinationLng": -7.9659,
        "departureDatetime": "2025-05-14T11:00:00Z",
        "arrivalDatetime": "2025-05-14T11:55:00Z",
        "durationMinutes": 55,
        "airlineName": "TAP Air Portugal",
        "stops": 0,
        "priceUsd": 28,
        "bookingUrl": "https://www.google.com/flights#search;f=LIS;t=FAO;d=2025-05-14;tt=o",
        "weather": null
      }
    ],
    "searchMeta": {
      "originIata": "LIS",
      "originCity": "Lisbon",
      "date": "2025-05-14",
      "stopIndex": 2,
      "stopsRemaining": 14,
      "currency": "USD",
      "resultCount": 1,
      "cachedAt": null
    }
  }
}
```

---

## 10. Get Return Flight Options

### `GET /itineraries/:id/return-flights`

**Purpose:** Fetch cheapest flights from current location back to original origin. BE derives the return route from itinerary state.

**Path Parameters:**

| Param | Type | Required |
|---|---|---|
| `id` | `string` | ✅ UUID |

**Query Parameters:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `dateOverride` | `string` | ❌ | `YYYY-MM-DD` for date switcher on return screen |

**Response Body:**

```typescript
{
  "success": true,
  "data": {
    "flights": FlightOption[],
    "searchMeta": {
      "originIata": string,
      "originCity": string,
      "destinationIata": string,
      "destinationCity": string,
      "date": string,
      "currency": "USD",
      "resultCount": number,
      "cachedAt": string | null
    }
  }
}
```

**Validation Rules:**
- Itinerary must exist with `status: "planning"`
- Must have at least 1 confirmed leg with stay duration set
- `originIata` must not equal `destinationIata`
- Results NOT deduplicated by destination (all same route, different times/airlines)

**Error Responses:**

| Scenario | Code | HTTP |
|---|---|---|
| Itinerary not found | `NOT_FOUND` | 404 |
| No confirmed legs | `VALIDATION_ERROR` | 400 |
| Stay not set on last leg | `VALIDATION_ERROR` | 400 |
| Itinerary already complete | `VALIDATION_ERROR` | 400 |
| Provider failure | `FLIGHT_API_ERROR` | 502 |

**Example Request:**
```
GET /v1/itineraries/a1b2c3d4-e5f6-7890-abcd-ef1234567890/return-flights
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "flights": [
      {
        "flightId": "serpapi_ret001",
        "originIata": "LIS",
        "originCity": "Lisbon",
        "destinationIata": "BCN",
        "destinationCity": "Barcelona",
        "destinationCountry": "Spain",
        "destinationLat": 41.3851,
        "destinationLng": 2.1734,
        "departureDatetime": "2025-05-14T09:00:00Z",
        "arrivalDatetime": "2025-05-14T11:10:00Z",
        "durationMinutes": 130,
        "airlineName": "Vueling",
        "stops": 0,
        "priceUsd": 41,
        "bookingUrl": "https://www.google.com/flights#search;f=LIS;t=BCN;d=2025-05-14;tt=o",
        "weather": null
      }
    ],
    "searchMeta": {
      "originIata": "LIS",
      "originCity": "Lisbon",
      "destinationIata": "BCN",
      "destinationCity": "Barcelona",
      "date": "2025-05-14",
      "currency": "USD",
      "resultCount": 1,
      "cachedAt": null
    }
  }
}
```

---

## 11. Finalize Itinerary

### `POST /itineraries/:id/finalize`

**Purpose:** Mark the itinerary as complete. BE validates the last leg is a return leg, computes full summary, and transitions `status` to `"complete"`. After this call the itinerary is immutable.

**Path Parameters:**

| Param | Type | Required |
|---|---|---|
| `id` | `string` | ✅ UUID |

**Request Body:** None

**Response Body:**

```typescript
{
  "success": true,
  "data": {
    "itineraryId": string,
    "status": "complete",
    "completedAt": string,
    "summary": {
      "totalPriceUsd": number,
      "totalLegs": number,
      "totalDestinations": number,
      "tripDurationDays": number,
      "hasMissingPrices": boolean,
      "missingPriceCount": number
    },
    "shareUrl": string
  }
}
```

**Validation Rules:**
- Itinerary must exist with `status: "planning"`
- Must have at least 2 legs (1 outbound + 1 return)
- Last leg must have `isReturn: true`
- All non-return legs must have `stayDurationDays` ≥ 1
- After finalization: itinerary TTL extended to 30 days in cache

**Error Responses:**

| Scenario | Code | HTTP |
|---|---|---|
| Itinerary not found | `NOT_FOUND` | 404 |
| Already finalized | `VALIDATION_ERROR` | 400 |
| Last leg is not a return leg | `VALIDATION_ERROR` | 400 |
| Fewer than 2 legs | `VALIDATION_ERROR` | 400 |
| A non-return leg has `stayDurationDays` = 0 | `VALIDATION_ERROR` | 400 |

**Example Request:**
```
POST /v1/itineraries/a1b2c3d4-e5f6-7890-abcd-ef1234567890/finalize
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "itineraryId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "complete",
    "completedAt": "2025-04-01T10:08:00Z",
    "summary": {
      "totalPriceUsd": 75,
      "totalLegs": 2,
      "totalDestinations": 1,
      "tripDurationDays": 4,
      "hasMissingPrices": false,
      "missingPriceCount": 0
    },
    "shareUrl": "https://tripplanner.app/trip?id=a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

---

## 12. Get Itinerary by ID

### `GET /itineraries/:id`

**Purpose:** Retrieve a complete itinerary by ID. Used when a user opens a shared link, refreshes the page, or FE needs to rehydrate state.

**Path Parameters:**

| Param | Type | Required |
|---|---|---|
| `id` | `string` | ✅ UUID |

**Response Body:**

```typescript
{
  "success": true,
  "data": {
    "itinerary": {
      "itineraryId": string,
      "origin": Airport,
      "legs": TripLeg[],
      "status": "planning" | "complete",
      "createdAt": string,
      "completedAt": string | null,
      "summary": ItinerarySummary | null,
      "shareUrl": string | null
    }
  }
}
```

**Validation Rules:**
- `id` must be a valid UUID v4 format
- Returns itinerary regardless of `status`

**Error Responses:**

| Scenario | Code | HTTP |
|---|---|---|
| `id` invalid UUID format | `VALIDATION_ERROR` | 400 |
| Itinerary not found / expired | `NOT_FOUND` | 404 |

**Example Request:**
```
GET /v1/itineraries/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "itinerary": {
      "itineraryId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
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
          "flightId": "serpapi_abc123",
          "originIata": "BCN",
          "destinationIata": "LIS",
          "destinationCity": "Lisbon",
          "priceUsd": 34,
          "stayDurationDays": 4,
          "isReturn": false,
          "weather": { "temperatureC": 22, "condition": "clear", "isForecast": true, "date": "2025-05-10" }
        },
        {
          "stopIndex": 2,
          "flightId": "serpapi_ret001",
          "originIata": "LIS",
          "destinationIata": "BCN",
          "destinationCity": "Barcelona",
          "priceUsd": 41,
          "stayDurationDays": 0,
          "isReturn": true,
          "weather": { "temperatureC": 21, "condition": "cloudy", "isForecast": true, "date": "2025-05-14" }
        }
      ],
      "status": "complete",
      "createdAt": "2025-04-01T10:00:00Z",
      "completedAt": "2025-04-01T10:08:00Z",
      "summary": {
        "totalPriceUsd": 75,
        "totalLegs": 2,
        "totalDestinations": 1,
        "tripDurationDays": 4,
        "hasMissingPrices": false,
        "missingPriceCount": 0
      },
      "shareUrl": "https://tripplanner.app/trip?id=a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    }
  }
}
```

---

## API Call Sequence (Full User Flow)

```
1.  GET  /airports/search?q=bar              → origin autocomplete
2.  GET  /airports/nearby?iata=BCN           → nearby airport options
3.  POST /itineraries                        → create session, get itineraryId
4.  GET  /flights/search?originIata=BCN      → browse cheapest flights
        &date=2025-05-10
5.  POST /weather/batch                      → load weather onto cards
6.  POST /itineraries/:id/legs              → confirm selected flight (stop 1)
7.  PATCH /itineraries/:id/legs/1/stay      → set stay duration

    [User chooses: Continue trip]

8.  GET  /itineraries/:id/next-flights      → flights from Lisbon on May 14
9.  POST /weather/batch                      → weather for new cards
10. POST /itineraries/:id/legs              → confirm flight (stop 2)
11. PATCH /itineraries/:id/legs/2/stay      → set stay duration

    [User chooses: Head home]

12. GET  /itineraries/:id/return-flights    → cheapest flights back to BCN
13. POST /itineraries/:id/legs              → confirm return flight (isReturn: true)
14. POST /itineraries/:id/finalize          → complete itinerary, get shareUrl
15. GET  /itineraries/:id                   → render full itinerary screen
```
