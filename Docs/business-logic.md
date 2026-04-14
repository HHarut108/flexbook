# Core Business Logic & Algorithms — Trip Planner MVP

---

## 1. How City Input Becomes Airport Options

### Plain English

The user types into a search box. After two characters, the system searches a static airport dataset loaded into memory when the server started. It does not hit an external API — the dataset is local. The search runs three matching strategies in order of priority, combines the results, deduplicates, and returns the top 7.

The dataset is a flat JSON array of ~7,000 airports, each with IATA code, airport name, city name, country, coordinates, and a flag indicating whether it has scheduled commercial service. Non-commercial airports are filtered out at load time, leaving roughly 3,500 usable entries.

### Algorithm

```
FUNCTION searchAirports(query, limit = 7):

  query = query.trim().toUpperCase()

  IF query.length < 2:
    RETURN []

  results = []

  // Pass 1: Exact IATA match
  exactIata = airports.find(a => a.iata === query)
  IF exactIata EXISTS:
    results.push({ airport: exactIata, score: 100 })

  // Pass 2: City or airport name starts with query
  prefixMatches = airports.filter(a =>
    a.city.toUpperCase().startsWith(query) OR
    a.name.toUpperCase().startsWith(query)
  )
  FOR each match IN prefixMatches:
    IF match NOT already in results:
      results.push({ airport: match, score: 80 })

  // Pass 3: City or airport name contains query anywhere
  containsMatches = airports.filter(a =>
    a.city.toUpperCase().includes(query) OR
    a.name.toUpperCase().includes(query)
  )
  FOR each match IN containsMatches:
    IF match NOT already in results:
      results.push({ airport: match, score: 60 })

  // Sort: score descending, then alphabetically by city
  results.sort(by score DESC, then by city ASC)

  RETURN results.slice(0, limit).map(r => r.airport)
```

### Decision Rules

- Minimum 2 characters before any search fires
- Query is trimmed and uppercased before all comparisons
- Only airports with `scheduledService: true` are in the working dataset
- A city with multiple airports (London: LHR, LGW, STN) appears as 3 separate results
- Exact IATA match always surfaces first regardless of other matches

### Nearby Airports

After the user selects an airport, the system runs a secondary pass to find airports within 150km using the Haversine formula:

```
FUNCTION findNearbyAirports(selectedIata, radiusKm = 150, limit = 3):

  origin = airports.find(a => a.iata === selectedIata)
  IF NOT origin: RETURN []

  nearby = []

  FOR each airport IN airports:
    IF airport.iata === selectedIata: CONTINUE

    distance = haversine(origin.lat, origin.lng, airport.lat, airport.lng)

    IF distance <= radiusKm:
      nearby.push({ airport, distanceKm: distance })

  nearby.sort(by distanceKm ASC)

  RETURN nearby.slice(0, limit)


FUNCTION haversine(lat1, lng1, lat2, lng2):
  R = 6371  // Earth radius in km
  dLat = toRadians(lat2 - lat1)
  dLng = toRadians(lng2 - lng1)
  a = sin(dLat/2)^2 + cos(lat1) * cos(lat2) * sin(dLng/2)^2
  c = 2 * atan2(sqrt(a), sqrt(1-a))
  RETURN R * c
```

### Fallback

- Dataset fails to load at startup → server refuses to start (fail fast)
- Query returns 0 results → return empty array; FE shows "No airports found"
- Nearby lookup fails silently → FE omits nearby section; origin selection still works

---

## 2. How the System Fetches 10 Cheapest One-Way Flights

### Plain English

The backend receives an origin IATA code and a date. It checks an in-memory cache first. On a cache miss, it calls the external flight provider (Kiwi/Tequila), passes the raw parameters, receives a list of itineraries, normalizes each one into a `FlightOption`, discards any with missing critical fields, deduplicates by destination (keeping cheapest per city), sorts by price, and returns the top 10.

The key insight: the provider returns many flights to many destinations. We want at most one flight per destination — the cheapest one — so the user sees 10 different places to go, not 10 flights to the same 2 cities.

### Algorithm

```
FUNCTION getCheapestFlights(originIata, date, destinationIata = null):

  cacheKey = buildCacheKey(originIata, date, destinationIata)

  cached = cache.get(cacheKey)
  IF cached EXISTS AND cached.age < 300s:
    RETURN cached.data

  rawResults = flightProvider.search({
    origin: originIata,
    destination: destinationIata ?? "anywhere",
    date: date,
    dateRange: 0,
    adults: 1,
    currency: "USD",
    limit: 50,
    sort: "price"
  })

  // Normalize
  normalized = []
  FOR each raw IN rawResults:
    flight = normalizeProviderFlight(raw)
    IF flight IS VALID:
      normalized.push(flight)

  // Deduplicate: keep cheapest per destination city
  destinationMap = {}
  FOR each flight IN normalized:
    key = flight.destinationIata
    IF key NOT IN destinationMap OR flight.priceUsd < destinationMap[key].priceUsd:
      destinationMap[key] = flight

  deduplicated = values(destinationMap)

  // Sort: price ascending, duration as tiebreaker
  deduplicated.sort((a, b) => {
    IF a.priceUsd !== b.priceUsd: RETURN a.priceUsd - b.priceUsd
    RETURN a.durationMinutes - b.durationMinutes
  })

  results = deduplicated.slice(0, 10)

  cache.set(cacheKey, results, ttl = 300s)

  RETURN results
```

### Normalization Function

```
FUNCTION normalizeProviderFlight(raw):

  REQUIRED_FIELDS = [price, flyFrom, flyTo, dTime, aTime, deep_link]

  FOR each field IN REQUIRED_FIELDS:
    IF raw[field] IS null OR undefined:
      RETURN null

  RETURN {
    flightId:            raw.id,
    originIata:          raw.flyFrom,
    originCity:          raw.cityFrom,
    destinationIata:     raw.flyTo,
    destinationCity:     raw.cityTo,
    destinationCountry:  raw.countryTo?.name ?? "",
    destinationLat:      raw.latitudeTo,
    destinationLng:      raw.longitudeTo,
    departureDatetime:   unixToISO(raw.dTime),
    arrivalDatetime:     unixToISO(raw.aTime),
    durationMinutes:     Math.round(raw.duration.total / 60),
    airlineName:         raw.airlines?.[0] ?? "Unknown",
    stops:               raw.route.length - 1,
    priceUsd:            raw.price,
    bookingUrl:          raw.deep_link,
    weather:             null
  }
```

### Decision Rules

- Always fetch 50 from provider, deduplicate down to 10 — prevents showing 10 flights to London
- `stops` = number of route segments minus 1; a direct flight has 1 segment
- If `durationMinutes` comes out negative (data error) → exclude that record
- If `destinationIata` === `originIata` (provider bug) → exclude that record
- `airlineName` uses first airline in the array (operating carrier for first segment)

### Fallback

- Provider returns < 10 results → return however many passed validation
- Provider returns 0 results → return empty array; FE shows date-switch prompt
- Provider times out → return 504; FE shows retry button
- Provider returns 5xx → return 502; FE shows retry button

---

## 3. How Date Switching Works

### Plain English

Date switching is a pure UI + cache interaction. When the user taps "next day" or "previous day," the FE computes the new date, validates it against the known boundaries, and fires a new flight search with the updated date. The BE treats this as a fresh search — it either hits the cache or calls the provider again.

No part of the confirmed trip chain is modified. Date switching only affects the pending search.

### Algorithm

```
FUNCTION buildDateSwitcher(currentDate, tripContext):

  IF tripContext.currentStopIndex === 1:
    minDate = TODAY + 1 day
  ELSE:
    lastLeg = tripContext.confirmedLegs.last()
    arrivalDate = dateOnly(lastLeg.arrivalDatetime)
    minDate = arrivalDate + 1 day

  maxDate = TODAY + 365 days

  canGoBack    = currentDate > minDate
  canGoForward = currentDate < maxDate

  RETURN {
    currentDate,
    minDate,
    maxDate,
    canGoBack,
    canGoForward,
    previousDate: canGoBack    ? currentDate - 1 day : null,
    nextDate:     canGoForward ? currentDate + 1 day : null
  }


FUNCTION onDateChange(newDate, switcher):

  IF newDate < switcher.minDate: RETURN
  IF newDate > switcher.maxDate: RETURN

  // Debounce: cancel pending search, wait 400ms
  cancelPendingFlightSearch()
  scheduleFlightSearch(newDate, delay = 400ms)


FUNCTION scheduleFlightSearch(date, delay):
  WAIT delay
  IF date IS STILL the selected date:
    flightResults = FETCH /flights/search?originIata=...&date=...
    renderFlightCards(flightResults)
```

### Decision Rules

- Previous day button: disabled if `currentDate - 1 < minDate`
- Next day button: disabled if `currentDate + 1 > maxDate`
- Rapid tapping: only the last selected date fires (debounce prevents API hammering)
- Date change does not reset the trip chain
- If new date returns 0 results: show empty state, keep the new date selected (don't revert)

### Edge Cases

- Date switch crosses a month boundary → calendar renders next month correctly
- `minDate` is today + 1 even after midnight in user's timezone → BE validates server-side with UTC date comparison as final authority

---

## 4. How Destination Selection Works

### Plain English

When the user taps a flight card, the system captures the full `FlightOption` object and stores it as the pending selection. This does not yet commit anything. Only when the user confirms stay duration does `POST /itineraries/:id/legs` fire, committing the leg to the trip chain.

If the user goes back from the stay duration screen and taps a different card, the pending selection is replaced. No API call was made yet, so there's nothing to undo.

### Algorithm

```
FUNCTION onFlightCardTapped(flight):

  session.selectedFlight = flight    // store in session state, not trip chain

  arrivalDate = dateOnly(flight.arrivalDatetime)

  navigateTo("stay-duration", {
    destinationCity:  flight.destinationCity,
    destinationIata:  flight.destinationIata,
    arrivalDate:      arrivalDate,
    priceUsd:         flight.priceUsd
  })


FUNCTION onGoBackFromStayDuration():

  session.selectedFlight = null
  navigateTo("flight-results")       // re-render same results (cached, no re-fetch)


// Backend — when leg is actually committed

FUNCTION confirmLeg(itineraryId, stopIndex, flight, isReturn):

  itinerary = getItinerary(itineraryId)

  IF stopIndex === 1:
    expectedOrigin = itinerary.origin.iata
  ELSE:
    expectedOrigin = itinerary.legs[stopIndex - 2].destinationIata

  IF flight.originIata !== expectedOrigin:
    THROW ValidationError("Origin does not match previous destination")

  IF stopIndex > 1:
    previousArrival = itinerary.legs[stopIndex - 2].arrivalDatetime
    IF flight.departureDatetime < previousArrival:
      THROW ValidationError("Departure before previous arrival")

  leg = buildTripLeg(flight, stopIndex, isReturn)
  itinerary.legs.push(leg)

  RETURN leg
```

### Decision Rules

- Tapping a card → updates `session.selectedFlight` only (no API call)
- Confirming stay → fires `POST /legs` and `PATCH /legs/:stopIndex/stay` in sequence
- Going back → discards `session.selectedFlight`, shows cached flight results
- BE re-validates origin continuity even though FE already enforced it — belt and suspenders

---

## 5. How Stay Duration Affects Next Departure Date

### Plain English

Stay duration is an integer number of days. The next departure date is computed by adding that integer to the arrival date of the confirmed leg. This is pure date arithmetic — no time components involved. The result is always a calendar date, not a datetime.

### Algorithm

```
FUNCTION computeNextDepartureDate(arrivalDatetime, stayDurationDays):

  // Extract date only — ignore time and timezone
  arrivalDate = toDateString(arrivalDatetime)   // "YYYY-MM-DD"

  // Add days
  nextDate = addDays(arrivalDate, stayDurationDays)

  RETURN nextDate   // "YYYY-MM-DD"

// Example:
// arrivalDatetime = "2025-05-10T07:45:00Z"
// stayDurationDays = 4
// arrivalDate = "2025-05-10"
// nextDate = "2025-05-14"
```

### Decision Rules

- Arrival date extracted from ISO datetime using UTC date (`arrivalDatetime.split("T")[0]`)
- "Stay of 1 day" means: arrive May 10, depart May 11 (not same day)
- "Stay of 0 days" is invalid — minimum is 1
- Result displayed to user as: *"You'd leave on Wednesday, May 14"*
- If `nextDepartureDate > today + 365`: flag as warning but do not block

### Stay Duration Display Logic

```
FUNCTION formatStayDisplay(stayDays, arrivalDate, nextDepartureDate):

  nightsLabel    = stayDays === 1 ? "1 night" : `${stayDays} nights`
  departureLabel = formatDate(nextDepartureDate, "dddd, MMM D")

  RETURN {
    nightsLabel,
    departureLabel,
    nextDepartureDate
  }
```

### Edge Cases

- Arrival crosses midnight → arrival date is correctly the next calendar day
- User edits stay from 4 to 7 days → `nextDepartureDate` is recomputed; no confirmed flights invalidated
- Stay duration changed after weather was loaded → weather stays; only `nextDepartureDate` changes

---

## 6. How Continue Trip Flow Works

### Plain English

After the user sets stay duration and taps "Continue trip," the system uses the current leg's destination as the new origin, and `nextDepartureDate` as the new departure date, to search for the next batch of flights. The flow is identical to the initial search. The only differences are: the origin is now a destination from the chain, the stop index has incremented, and the progress indicator updates.

### Algorithm

```
FUNCTION handleContinueTrip(itinerary):

  lastLeg = itinerary.legs.last()

  IF lastLeg.stayDurationDays === 0:
    THROW Error("Stay duration not set")

  IF countNonReturnLegs(itinerary) >= 15:
    THROW Error("Maximum destinations reached")

  newOriginIata = lastLeg.destinationIata
  newOriginCity = lastLeg.destinationCity
  newDate       = lastLeg.nextDepartureDate
  newStopIndex  = lastLeg.stopIndex + 1

  session.currentStopIndex  = newStopIndex
  session.pendingOriginIata = newOriginIata
  session.pendingDate       = newDate
  session.selectedFlight    = null
  session.flightResults     = []

  navigateTo("flight-results")

  results = fetchNextFlights(itinerary.id)
  session.flightResults = results

  // Async: fetch weather
  fetchWeatherBatch(results.map(f => ({
    iata: f.destinationIata,
    lat:  f.destinationLat,
    lng:  f.destinationLng,
    date: f.arrivalDatetime.split("T")[0]
  })))


FUNCTION countNonReturnLegs(itinerary):
  RETURN itinerary.legs.filter(l => NOT l.isReturn).length
```

### Decision Rules

- "Continue trip" option only rendered if `countNonReturnLegs < 15`
- At exactly 15 non-return legs: hide "Continue trip," show only "Head home"
- If new flight search returns 0 results: show empty state with ±1 day switcher AND keep "Head home" visible
- Progress indicator: *"Stop 3 of 15"*

### State Transitions

```
[Decision screen: "Continue trip" tapped]
  → session.currentStopIndex += 1
  → session.pendingOriginIata = lastLeg.destinationIata
  → session.pendingDate = lastLeg.nextDepartureDate
  → navigate to flight-results
  → fire GET /next-flights
  → render results
  → [user taps card] → session.selectedFlight = flight
  → [user confirms stay] → POST /legs, PATCH /stay
  → navigate to decision screen
  → [loop]
```

---

## 7. How Return Home Flow Works

### Plain English

When the user taps "Head home," the system searches for flights from their current location back to the original departure city. The origin becomes the current destination, and the destination is fixed as the original trip origin. The same 10-flights logic runs, but this time `destinationIata` is passed to restrict the search to a single route. Multiple results on the same route are valid here (different airlines, different times).

After the user selects a return flight, it's added as a leg with `isReturn: true`, and `POST /finalize` is called. The flow ends.

### Algorithm

```
FUNCTION handleReturnHome(itinerary):

  lastLeg      = itinerary.legs.last()
  returnOrigin = lastLeg.destinationIata
  returnDest   = itinerary.origin.iata
  returnDate   = lastLeg.nextDepartureDate

  IF returnOrigin === returnDest:
    HANDLE_AS_ALREADY_HOME()
    RETURN

  results = fetchReturnFlights(itinerary.id)

  session.flightResults = results
  navigateTo("return-search")


FUNCTION onReturnFlightSelected(flight, itinerary):

  POST /itineraries/:id/legs {
    stopIndex: nextStopIndex,
    flight:    flight,
    isReturn:  true
  }

  POST /itineraries/:id/finalize

  navigateTo("itinerary")
```

### Decision Rules

- Return flight results are sorted by price but NOT deduplicated (all same city pair)
- Date switching (±1 day) is available on the return search screen
- "Head home" is available from stop 1 onward
- If 0 return flights: show empty state with ±1 day buttons and "Go back and stay longer" option

### Fallback for No Return Flights

```
IF returnFlights.length === 0:
  SHOW empty state:
    - "No flights home on [date]"
    - [← Previous day] [Next day →] buttons
    - "Stay longer" button → navigates back to stay duration

IF returnFlights.length > 0 AND returnFlights.length < 3:
  SHOW available results with note:
    - "Only [N] flight(s) available on this date"
    - ±1 day buttons still visible
```

---

## 8. How the 15-Destination Limit Is Enforced

### Plain English

The limit is enforced at three layers: the UI (hide the button), the store (guard before state mutation), and the backend (validate before accepting a new leg). All three must agree. The BE is the final authority.

"Destination" = any non-return leg. The return flight home does not count against the limit. Maximum trip: 15 outbound legs + 1 return leg = 16 total legs.

### Algorithm

```
MAX_DESTINATIONS = 15


// Frontend: what to show on decision screen

FUNCTION getDecisionOptions(tripStore):

  nonReturnCount = tripStore.stops.filter(s => NOT s.isReturn).length

  canContinue = nonReturnCount < MAX_DESTINATIONS

  RETURN {
    showContinueButton: canContinue,
    showHeadHomeButton: true,
    progressText: `${nonReturnCount} of ${MAX_DESTINATIONS} stops used`,
    stopsRemaining: MAX_DESTINATIONS - nonReturnCount
  }


// Frontend: store guard

FUNCTION addStop(stop):

  IF store.stops.filter(s => NOT s.isReturn).length >= MAX_DESTINATIONS AND NOT stop.isReturn:
    LOG error "Attempted to add stop beyond limit"
    RETURN

  store.stops.push(stop)


// Backend: route validation

FUNCTION validateAddLeg(itinerary, newLeg):

  nonReturnLegs = itinerary.legs.filter(l => NOT l.isReturn)

  IF NOT newLeg.isReturn AND nonReturnLegs.length >= MAX_DESTINATIONS:
    THROW ValidationError(
      code: "MAX_DESTINATIONS_REACHED",
      message: "Maximum of 15 destinations reached."
    )
```

### Decision Rules

- Count is `non-return legs only`; return leg is exempt
- When count reaches 14: "Continue trip" shows with note *"1 stop remaining"*
- When count reaches 15: "Continue trip" button hidden; only "Head home" shown
- Message at 15: *"You've reached the maximum of 15 destinations. Time to head home!"*
- Tone is friendly, not an error state

### Edge Cases

- User navigates back after BE rejected: FE re-evaluates on render, hides continue button
- BE receives `stopIndex: 16` for a non-return leg → returns 400 `MAX_DESTINATIONS_REACHED`
- Return leg at stop 16 (index 16): valid, accepted by BE

---

## 9. How Trip Total Price Is Calculated

### Plain English

The total is a simple sum of `priceUsd` across all confirmed legs, including the return flight. Legs with missing prices are excluded from the sum but counted and flagged in a disclaimer. Prices are stored as they were at search time — they are estimates.

### Algorithm

```
FUNCTION calculateTotalPrice(legs):

  total            = 0
  missingCount     = 0
  hasMissingPrices = false

  FOR each leg IN legs:

    IF leg.priceUsd IS null OR leg.priceUsd IS undefined:
      missingCount += 1
      hasMissingPrices = true
      CONTINUE

    IF leg.priceUsd <= 0:
      missingCount += 1
      hasMissingPrices = true
      CONTINUE

    total += leg.priceUsd

  total = Math.round(total)

  RETURN {
    totalPriceUsd:     total,
    hasMissingPrices:  hasMissingPrices,
    missingPriceCount: missingCount,
    disclaimer:        buildDisclaimer(hasMissingPrices, missingCount)
  }


FUNCTION buildDisclaimer(hasMissingPrices, missingCount):

  base = "Prices are estimates. Final prices confirmed at booking."

  IF hasMissingPrices:
    RETURN base + ` Price unavailable for ${missingCount} leg(s).`

  RETURN base
```

### Decision Rules

- `priceUsd` = 0 is treated as missing (a $0 flight is a data error)
- If ALL legs have missing prices: display *"Total: Unavailable"* instead of $0
- Currency is always USD for MVP
- Total is an integer (no cents displayed)

### Edge Cases

```
// All prices missing
IF missingCount === legs.length:
  DISPLAY "Total: Unavailable"

// Partial
IF missingCount > 0 AND missingCount < legs.length:
  DISPLAY "Total: $[sum of available]"
  DISPLAY disclaimer: "Price unavailable for N leg(s)."

// All present
IF missingCount === 0:
  DISPLAY "Total: $[sum]"
  DISPLAY standard disclaimer
```

---

## 10. How Timeline Data Is Generated

### Plain English

The timeline is a strictly ordered interleaving of flight legs and stay blocks. For every confirmed leg (except the return), there is a corresponding stay block that follows it. The return leg has no stay block after it. The timeline is computed from the confirmed `legs` array in stop index order — it is a pure derivation, never stored separately.

### Algorithm

```
FUNCTION buildTimelineItems(itinerary):

  items = []
  legs  = itinerary.legs.sortBy(l => l.stopIndex)

  FOR each leg IN legs:

    // Add flight leg item
    items.push({
      type:               "flight",
      stopIndex:          leg.stopIndex,
      legNumber:          leg.stopIndex,
      originIata:         leg.originIata,
      originCity:         leg.originCity,
      destinationIata:    leg.destinationIata,
      destinationCity:    leg.destinationCity,
      destinationCountry: leg.destinationCountry,
      departureDatetime:  leg.departureDatetime,
      arrivalDatetime:    leg.arrivalDatetime,
      durationFormatted:  formatDuration(leg.durationMinutes),
      airlineName:        leg.airlineName,
      stopsLabel:         formatStops(leg.stops),
      priceUsd:           leg.priceUsd,
      bookingUrl:         leg.bookingUrl,
      weather:            leg.weather ?? null,
      isReturn:           leg.isReturn
    })

    // Add stay block — ONLY for non-return legs
    IF NOT leg.isReturn:
      items.push({
        type:         "stay",
        city:         leg.destinationCity,
        country:      leg.destinationCountry,
        arrivalDate:  dateOnly(leg.arrivalDatetime),
        departureDate: leg.nextDepartureDate,
        nightsLabel:  formatNights(leg.stayDurationDays)
      })

  RETURN items


FUNCTION formatDuration(minutes):
  hours = Math.floor(minutes / 60)
  mins  = minutes % 60
  IF hours === 0: RETURN `${mins}m`
  IF mins  === 0: RETURN `${hours}h`
  RETURN `${hours}h ${mins}m`


FUNCTION formatStops(stops):
  IF stops === 0: RETURN "Direct"
  IF stops === 1: RETURN "1 stop"
  RETURN `${stops} stops`


FUNCTION formatNights(days):
  IF days === 1: RETURN "1 night"
  RETURN `${days} nights`
```

### Decision Rules

- Cards alternate strictly: flight → stay → flight → stay → ... → return flight
- Return leg is the last item; no stay block appended after it
- `priceUsd` missing → show *"Price unavailable"* for that leg
- `weather` null → hide weather widget for that leg
- `durationMinutes` = 0 or negative → show *"Duration unknown"*

### Edge Cases

- Single-stop trip (1 outbound + return): 3 items — flight, stay, return flight
- All times shown in local airport time (derive from UTC + timezone offset)
- Timezone offset unavailable: show UTC with *(UTC)* label

---

## 11. How Map Route Data Is Generated

### Plain English

The map needs two things: a list of pins (points) and a list of line segments connecting them in order. Pins are generated from the origin and each destination in the trip chain. The return flight does not add a new pin — it adds a line segment back to pin 1 (origin).

### Algorithm

```
FUNCTION buildMapData(itinerary):

  pins     = []
  segments = []

  // Pin 1: origin
  pins.push({
    pinIndex:        1,
    iata:            itinerary.origin.iata,
    city:            itinerary.origin.city.name,
    lat:             itinerary.origin.city.lat,
    lng:             itinerary.origin.city.lng,
    isOrigin:        true,
    isReturn:        false,
    arrivalDate:     null,
    stayDurationDays: null
  })

  legs = itinerary.legs.sortBy(l => l.stopIndex)

  FOR each leg IN legs:

    IF NOT leg.isReturn:
      pins.push({
        pinIndex:        pins.length + 1,
        iata:            leg.destinationIata,
        city:            leg.destinationCity,
        lat:             leg.destinationLat,
        lng:             leg.destinationLng,
        isOrigin:        false,
        isReturn:        false,
        arrivalDate:     dateOnly(leg.arrivalDatetime),
        stayDurationDays: leg.stayDurationDays
      })

    // Add line segment
    IF leg.isReturn:
      fromPin = pins[pins.length - 1]
      toPin   = pins[0]              // back to origin
    ELSE:
      fromPin = pins[pins.length - 2]
      toPin   = pins[pins.length - 1]

    segments.push({
      fromPinIndex: fromPin.pinIndex,
      toPinIndex:   toPin.pinIndex,
      fromLat:      fromPin.lat,
      fromLng:      fromPin.lng,
      toLat:        toPin.lat,
      toLng:        toPin.lng,
      isReturn:     leg.isReturn
    })

  bounds = computeBounds(pins)

  RETURN { pins, segments, bounds }


FUNCTION computeBounds(pins):
  lats = pins.map(p => p.lat)
  lngs = pins.map(p => p.lng)

  RETURN {
    minLat: min(lats) - 2,
    maxLat: max(lats) + 2,
    minLng: min(lngs) - 3,
    maxLng: max(lngs) + 3
  }
```

### Decision Rules

- Pin index is 1-based; pin 1 is always origin
- Return segment connects last stop back to pin 1 — no new pin added
- `isReturn: true` segment can be styled differently (dashed line) by renderer
- Segments are straight polylines; no great-circle curves for MVP

### Edge Cases

```
// Only 1 destination + return (minimum valid trip)
pins:     [origin, destination]
segments: [origin→destination, destination→origin]

// Trip crosses antimeridian (Tokyo → Los Angeles)
// Leaflet handles correctly with signed lngs (-180 to 180)
// No special handling needed

// Pin with invalid coordinates (null from provider)
SKIP that pin
IF < 2 pins remain: hide map tab, show "Map unavailable for this trip"

// Two stops at same city
Pins overlap; show both with tooltip listing both visits
```

---

## 12. How to Handle Missing or Partial Provider Data

### Plain English

External providers are unreliable. Fields go missing, values come back null, requests time out, APIs go down. The system must never crash or show broken UI because of upstream data problems. Every consumer of external data must handle the absence of any field gracefully and fall back to a defined behavior.

### Decision Framework

```
FUNCTION handleProviderData(rawData, fieldName, options):

  value = rawData[fieldName]

  IF value IS null OR undefined OR "":

    IF options.required:
      RETURN { valid: false, value: null }   // discard record

    IF options.fallback IS defined:
      RETURN { valid: true, value: options.fallback }

    RETURN { valid: true, value: null }

  IF options.validator AND NOT options.validator(value):
    IF options.required:
      RETURN { valid: false, value: null }
    RETURN { valid: true, value: options.fallback ?? null }

  RETURN { valid: true, value: value }
```

### Field-Level Fallback Rules

```
FLIGHT RECORD FIELDS:
┌─────────────────────┬──────────┬──────────────────────────────────┐
│ Field               │ Required │ Fallback                         │
├─────────────────────┼──────────┼──────────────────────────────────┤
│ flightId            │ YES      │ Discard record                   │
│ originIata          │ YES      │ Discard record                   │
│ destinationIata     │ YES      │ Discard record                   │
│ departureDatetime   │ YES      │ Discard record                   │
│ arrivalDatetime     │ YES      │ Discard record                   │
│ priceUsd            │ YES      │ Discard record                   │
│ bookingUrl          │ YES      │ Use fallback Kiwi search URL     │
│ durationMinutes     │ NO       │ Compute from dep/arr times       │
│ airlineName         │ NO       │ "Unknown"                        │
│ stops               │ NO       │ Compute from route.length - 1    │
│ destinationCity     │ NO       │ Use destinationIata as label     │
│ destinationCountry  │ NO       │ "" (omit from display)           │
│ destinationLat/Lng  │ NO       │ null (omit from map/weather)     │
└─────────────────────┴──────────┴──────────────────────────────────┘

WEATHER FIELDS:
┌─────────────────────┬──────────┬──────────────────────────────────┐
│ Field               │ Required │ Fallback                         │
├─────────────────────┼──────────┼──────────────────────────────────┤
│ temperatureC        │ NO       │ Hide widget                      │
│ condition           │ NO       │ "unknown" (renders ? icon)       │
└─────────────────────┴──────────┴──────────────────────────────────┘
```

### Partial Result Sets

```
FUNCTION handleFlightResultSet(rawResults):

  valid   = []
  invalid = []

  FOR each raw IN rawResults:
    normalized = normalizeProviderFlight(raw)
    IF normalized IS NOT null:
      valid.push(normalized)
    ELSE:
      invalid.push(raw.id ?? "unknown")

  IF invalid.length > 0:
    LOG warning `Discarded ${invalid.length} invalid records`

  IF valid.length === 0:
    RETURN { flights: [], isEmpty: true }

  RETURN { flights: valid.slice(0, 10), isEmpty: false }
```

### Provider Timeout Handling

```
FUNCTION callProviderWithTimeout(providerFn, timeoutMs):

  result = Promise.race([
    providerFn(),
    sleep(timeoutMs).then(() => THROW TimeoutError())
  ])

  TRY:
    RETURN await result
  CATCH TimeoutError:
    LOG error "Provider timeout after ${timeoutMs}ms"
    THROW { code: "FLIGHT_API_TIMEOUT", retryable: true }
  CATCH ProviderError as e:
    LOG error "Provider error: ${e.message}"
    THROW { code: "FLIGHT_API_ERROR", retryable: true }
```

### Complete Failure Scenarios

```
SCENARIO: Flight provider is down
→ BE returns 502
→ FE shows: "Couldn't load flights. Try again."
→ Trip chain is unaffected; no state changes

SCENARIO: Weather provider is down
→ BE returns partial batch response (all keys missing)
→ FE silently hides weather widgets on all cards
→ Cards render fully; user can still select flights

SCENARIO: One flight in result set has null price
→ Record discarded during normalization
→ Remaining 9 records returned
→ User sees 9 cards; no gap or error shown

SCENARIO: Booking URL is null
→ BE substitutes Kiwi fallback search URL:
  https://www.kiwi.com/en/search/results/{origin}/{dest}/{date}
→ Button label changes to "Search flight"

SCENARIO: All flights to same destination (dedup produces < 3 results)
→ Return however many valid results exist
→ FE shows: "Not many flights on this date. Try a nearby date."
→ ±1 day buttons shown

SCENARIO: Provider returns flight where origin === destination
→ Caught in normalization: discard record
→ Log: "Provider returned invalid route: BCN → BCN"

SCENARIO: Duration comes back as 0 or negative
→ Attempt to compute: (arrivalDatetime - departureDatetime) / 60000
→ If still invalid: set durationMinutes = null
→ Display: "Duration unknown"

SCENARIO: Itinerary ID not found (expired cache, bad share URL)
→ BE returns 404
→ FE shows: "This trip has expired or doesn't exist."
→ FE shows: [Start a new trip] button → home screen
```
