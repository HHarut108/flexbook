# **Trip Planner MVP — Product Definition**

---

## **1\. Product Summary**

A lightweight, mobile-friendly web app that helps budget travelers build a multi-destination trip by always picking the cheapest next flight. Users chain up to 15 one-way flights starting from any city, choosing how long to stay at each stop before deciding to continue or head home. The result is a visual itinerary — timeline \+ map — built entirely around cost optimization.

---

## **2\. MVP Goal**

Let a user build a complete cheap multi-stop trip in under 5 minutes, starting from any city and ending with a shareable itinerary — without requiring an account or payment.

## **2.1 Documentation Source Of Truth**

For the current MVP, this product definition and [prd-alignment-decisions.md](/Users/harut/Desktop/Fast-Travel-Assistant/Docs/prd-alignment-decisions.md) are the source of truth.

**Approved alignment decisions:**

* Shared trips are self-contained in the URL for MVP and should open from the link alone  
* Refreshing during planning should restore the trip from the URL  
* Shared links should not expire by design in MVP  
* Outbound browsing should show up to 10 destination options, using the cheapest flight per destination  
* "Go home" means showing up to 3 cheapest flight offers back to the original home city  
* Final itinerary uses per-leg booking buttons only; no separate "Book all flights" action in MVP  
* After the itinerary, the positive next step is a dedicated booking review screen

**Current localhost behavior takes priority over older appendix examples below.** Where older user stories or exploratory examples disagree, follow Sections 2.1, 6, and 8 in this document plus `prd-alignment-decisions.md`.

---

## **3\. Target User**

**Primary:** 20–35 year old independent traveler with flexible dates and destinations, optimizing for cost over convenience. Comfortable booking flights themselves. Likely traveling solo or with one other person.

**Mindset:** "Show me where I can go cheapest from here" — not "I want to go to Paris."

---

## **4\. Problems This Product Solves**

1. **Decision paralysis** — Too many flight options across too many tools; this narrows it to 10 cheap choices at each step.  
2. **Multi-stop trip complexity** — Planning a chain of one-way flights across multiple tools is tedious; this makes it a single linear flow.  
3. **Cost opacity** — Users don't know which destination is cheapest from their current location on a given date.  
4. **Itinerary fragmentation** — After booking, travelers have no single view of their full trip; the final summary solves this.

---

## **5\. Product Principles**

1. **Cheap first, always** — Every decision surface is optimized for cost, not popularity or sponsorship.  
2. **One thing at a time** — The UI presents one decision per step. No overload.  
3. **No friction** — No login, no account, no payment. Just start planning.  
4. **Bright and approachable** — Clean, warm, and travel-friendly. Feels consumer-ready, not developer-oriented.  
5. **Trust through transparency** — Show prices clearly. No hidden fees or dark patterns.  
6. **Mobile-first** — The primary user is on a phone, possibly in a hostel.

---

## **6\. In Scope for MVP**

**Core Flow**

* Origin city/airport input with autocomplete  
* Nearby airport suggestions when geolocation is available  
* Selecting origin opens flight results immediately with tomorrow selected by default  
* Departure date can be changed inline from the flight results screen  
* Display 10 cheapest one-way flights from origin on that date  
* User selects a flight → destination is set, arrival date is calculated  
* User inputs number of days to stay  
* User chooses: **Continue to the next destination** or **Wrap up and fly home**  
* If continuing: repeat flight search from current destination \+ next calculated date  
* Up to 15 destination hops  
* If going home: show up to 3 cheapest flights back to origin

**Itinerary Summary Screen**

* Full trip timeline (list of legs: city → city, date, price, duration)  
* Map view with pins and route lines connecting destinations  
* Total estimated flight cost  
* Minimal weather per destination: temperature \+ icon (based on travel date)
* Primary next action: **Proceed to booking options**

**Booking Review Screen**

* Shows all selected tickets with dates, prices, airlines, airline logos when available, and booking links  
* Lets the user open each booking link individually or use a **Book all at once** action  
* Includes a return/back action to the itinerary overview

**Technical**

* Separate frontend (React) and backend (REST API)  
* Flight data via SerpAPI Google Flights (primary); Kiwi/Tequila as fallback
* Weather data via OpenWeatherMap or similar free-tier API  
* No user auth, no database persistence (session or URL-based state only)

---

## **7\. Out of Scope for MVP**

* User accounts, saved trips, login  
* Hotel, accommodation, or transport search  
* Round-trip or multi-passenger search  
* Filters (airlines, stops, time of day, baggage)  
* Booking directly in-app (redirect to airline or aggregator)  
* Price alerts or fare tracking  
* Collaborative trip planning  
* Detailed weather forecasts (only temp \+ icon)  
* Native mobile app (iOS/Android)  
* Offline mode  
* Multi-currency display (USD default)  
* Visa or entry requirement information  
* AI recommendations or personalization

---

## **8\. End-to-End User Flow**

1. User lands on the home screen. They see the prompt: **"Where are you starting?"**  
2. User types a city or airport name. Autocomplete suggests IATA airport options.  
3. User selects their origin airport.  
4. System sets tomorrow as the default departure date and opens the flight results screen immediately.  
5. User can change the date inline with previous/next controls or by opening the calendar overlay.  
6. System calls the flight API and returns the **10 cheapest one-way flights** from that origin on that date.  
7. Each result shows: destination city, airport code, price, flight duration, and airline.  
8. User taps a flight to select it. That destination and arrival date are locked in as **Stop 1**.  
9. System asks: **"How long do you want to stay in \[City\]?"** User enters a number (minimum 1).  
10. System calculates the next available departure date (arrival date \+ stay duration).  
11. System shows the decision step with two options: **Continue to the next destination** or **Wrap up and fly home**.  
12. **If Continue:** System searches for the 10 cheapest one-way flights from the current city on the calculated date. Return to step 7\. Repeat up to 15 stops.  
13. **If Head home:** System searches for up to 3 cheapest one-way flights back to the origin city from the current destination on the calculated date. User selects one.  
14. After the final flight is selected, system generates the **Itinerary Summary**:  
    * Timeline view: each leg listed in order (origin → stop 1 → stop 2 → … → home), with dates, prices, and durations  
    * Map view: pins on each destination, connected by route lines in order  
    * Total estimated flight cost (sum of all selected flights)  
    * Weather for each destination on the arrival date: temperature \+ condition icon  
15. User can **copy a shareable link** to their itinerary (state encoded in URL).  
16. User can tap **Proceed to booking options** to open the booking review screen.  
17. In booking review, each flight ticket has its own booking action that deep-links to the airline or aggregator.

---

## **9\. Key Assumptions & Open Risks**

| \# | Assumption / Risk | Mitigation |
| ----- | ----- | ----- |
| 1 | **Flight API availability** — SerpAPI Google Flights is the primary provider; Kiwi/Tequila is the automatic fallback if SerpAPI key is absent | Validate SerpAPI quotas before dev starts; mock provider is always available for development |
| 2 | **"Cheapest 10" is meaningful** — Assumes the API can reliably sort by price for a given date/origin | Test API response quality early; some routes may return \< 10 results |
| 3 | **Flexible destination \= user mental model** — Users are comfortable not knowing their destination before seeing prices | Core to the value prop; if users resist, add optional destination filter as fast follow |
| 4 | **URL-based state is sufficient** — No DB needed for MVP since trips are session-based and shareable via URL | Keep state serialization simple; long trips may produce long URLs (use encoding) |
| 5 | **Weather API accuracy** — Forecasts beyond 7–10 days are unreliable; most trip dates will exceed this | Display a disclaimer for dates \> 10 days out; use climate averages as fallback |
| 6 | **No booking \= acceptable for MVP** — Users are comfortable being redirected to book externally | Standard for travel aggregators; not a risk unless monetization requires in-app booking |
| 7 | **15-stop limit is sufficient** — Assumed no real user needs more than 15 hops in a single planning session | Easy to increase; exists to cap API call volume and UI complexity |
| 8 | **Mobile-first but web-only** — A responsive web app covers the target user without native app cost | Validate with early users; PWA upgrade is a fast follow if needed |

# **User Stories & Acceptance Criteria — Trip Planner MVP**

---

## **EPIC 1: Origin & Departure Setup**

---

### **US-01 · City / Airport Input**

**Priority: Must Have**

**As a user,** I want to type a city or airport name and see matching suggestions, so that I can quickly set my departure point without knowing the exact IATA code.

**Acceptance Criteria:**

* Input is the first and only element shown on the home screen  
* Autocomplete triggers after 2 characters  
* Suggestions show: city name, country, airport name, IATA code (e.g. "Paris, France — Charles de Gaulle (CDG)")  
* Maximum 7 suggestions shown at a time  
* Selecting a suggestion locks in the origin and advances to flight results with tomorrow selected by default  
* Search is case-insensitive and handles common misspellings (e.g. "Barcelon" returns Barcelona)  
* Placeholder text reads: *"Type a city or airport..."*

**Edge Cases & Error States:**

* No results found → show message: *"No airports found. Try a different city or airport code."*  
* API fails to return suggestions → show: *"Search unavailable. Please try again."* with retry option  
* User clears input after selecting → resets flow back to step 1  
* Input longer than 100 characters is rejected silently (trimmed)

---

### **US-02 · Nearby Airport Selection**

**Priority: Should Have**

**As a user,** I want to see nearby airports as alternatives when I select my origin, so that I can choose a cheaper departure point if one is available close to me.

**Acceptance Criteria:**

* After origin is selected, if there are airports within \~150km, show a secondary row: *"Nearby airports: \[Airport 1\], \[Airport 2\]"*  
* Each nearby airport shown as a pill/chip with IATA code and city name  
* Tapping a nearby airport swaps the origin silently and updates the label  
* Maximum 3 nearby airports shown  
* If no nearby airports exist, this row is hidden entirely (no empty state needed)

**Edge Cases:**

* Nearby airport is in a different country → still show it, add country flag or label  
* User selects a nearby airport then wants to go back → tapping origin input reopens search

---

### **US-03 · Departure Date Selection**

**Priority: Must Have**

**As a user,** I want to select a departure date from a calendar, so that I can search for flights on a specific day.

**Acceptance Criteria:**

* Date picker opens immediately after origin is confirmed  
* Only future dates are selectable (today \+ 1 minimum)  
* Default selection: today \+ 3 days (reasonable planning buffer)  
* Calendar shows one month at a time with forward/back navigation  
* Selected date is shown clearly above the flight results: *"Flights from \[City\] on \[Date\]"*  
* Dates more than 12 months in the future are disabled  
* Confirming date triggers immediate flight search

**Edge Cases:**

* User taps a past date → date is unselectable, no error shown (just visually disabled)  
* User navigates far into future and selects date \> 12 months out → button is disabled, tooltip: *"We can't search flights this far in advance."*

---

### **US-04 · Date Switching While Browsing Results**

**Priority: Should Have**

**As a user,** I want to change the departure date after I see flight results, so that I can compare prices across different days without restarting.

**Acceptance Criteria:**

* A visible date control (e.g. "← Previous day | Mar 31 | Next day →") is shown above flight results  
* Tapping Previous / Next reloads results for ±1 day  
* Tapping the date itself opens the full date picker  
* Loading state shown while new results fetch (skeleton or spinner)  
* If new date returns no results, show empty state (see US-05)  
* Date cannot go to today or earlier via the Previous control (button disabled)

**Edge Cases:**

* User rapidly taps next day multiple times → debounce requests, only fire last selected date  
* Date change returns a completely different set of cheapest destinations → expected behavior, no warning needed

---

## **EPIC 2: Flight Results**

---

### **US-05 · Display 10 Cheapest One-Way Flights**

**Priority: Must Have**

**As a user,** I want to see the 10 cheapest available one-way flights from my origin on my selected date, so that I can make a cost-informed decision about where to go next.

**Acceptance Criteria:**

* Results are sorted by price, ascending (cheapest first)  
* Exactly 10 results shown if available; fewer shown if API returns less  
* Results load within 5 seconds; skeleton cards shown during load  
* Each result is a tappable card leading to destination selection  
* Results refresh automatically when date changes (US-04)  
* A label above results reads: *"10 cheapest flights from \[City\] on \[Date\]"*

**Empty State:**

* Fewer than 3 results → show: *"Not many flights on this date. Try a nearby date."* with quick ±1 day buttons  
* Zero results → show: *"No flights found from \[City\] on \[Date\]. Try changing the date or origin."*

**Error State:**

* API failure → show: *"Couldn't load flights. Check your connection and try again."* with retry button  
* Timeout (\>10s) → same error state with retry

---

### **US-06 · Flight Result Cards**

**Priority: Must Have**

**As a user,** I want each flight result to show me the key information I need, so that I can compare options at a glance and make a fast decision.

**Acceptance Criteria:**

Each card displays:

* Destination city name (large, prominent)  
* Country name  
* Price in USD (large, prominent) — e.g. **$47**  
* Flight duration — e.g. *2h 15m*  
* Number of stops — e.g. *Direct* or *1 stop*  
* Airline name  
* Departure and arrival time — e.g. *14:30 → 16:45*

**Validation Rules:**

* Price must always be present; if missing from API, card is excluded from results  
* Duration must be present; if missing, show *"Duration unknown"*  
* Cards are sorted strictly by price; ties broken by duration (shorter first)

**Edge Cases:**

* Destination city name is very long (\>25 chars) → truncate with ellipsis on card, full name shown on selection  
* Price is above $1,000 → still show, no cap on price display  
* Multiple flights to same destination at different prices → show cheapest one only per destination

---

## **EPIC 3: Destination & Stay Planning**

---

### **US-07 · Destination Weather Summary**

**Priority: Should Have**

**As a user,** I want to see basic weather info for each destination on my planned arrival date, so that I can factor in conditions when choosing where to go.

**Acceptance Criteria:**

* Each flight card shows a small weather widget: temperature (°C) \+ condition icon (sun, cloud, rain, snow)  
* Weather is based on the projected arrival date, not today  
* If arrival date is \> 10 days out, show climate average with a label: *"Avg for this time of year"*  
* Weather data loads asynchronously; if delayed, show a subtle placeholder (no blocking)  
* Temperature shown in °C by default (backpacker/international audience)

**Error State:**

* Weather API fails → hide weather widget silently; do not show an error on the flight card  
* Unknown destination in weather API → same as above, hide silently

---

### **US-08 · Destination Selection**

**Priority: Must Have**

**As a user,** I want to select a flight from the results to lock in my next destination, so that the system can calculate my arrival date and continue building my trip.

**Acceptance Criteria:**

* Tapping a flight card selects it and advances to stay duration input  
* Selected destination is shown as a confirmed stop: *"Stop 1: \[City\], arriving \[Date\]"*  
* Arrival date is calculated automatically: departure date \+ flight duration  
* User cannot proceed without selecting a flight  
* Back navigation from stay duration returns to flight list with same results (no re-fetch)

**Edge Cases:**

* User selects a flight then goes back and selects a different one → previous selection is discarded, new one replaces it  
* Arrival date calculation crosses midnight → date advances correctly (no timezone bugs; use UTC or local airport time — assume local for MVP)

---

### **US-09 · Stay Duration Selection**

**Priority: Must Have**

**As a user,** I want to enter how many days I plan to stay at my destination, so that the system knows when I'll be ready for my next flight.

**Acceptance Criteria:**

* Input appears immediately after destination is confirmed  
* Heading should use natural travel language, for example: *"How long do you want to stay in \[City\]?"*  
* Input type: number spinner or \+/- buttons (no free-text keyboard for mobile)  
* Minimum: 1 day. Maximum: 90 days  
* Default value: 3 days  
* Live preview should explain the user outcome, for example: *"You&apos;ll stay in \[City\] for 3 nights and leave on \[Calculated Date\]"*  
* User must confirm (tap "Set stay") to proceed to the Continue/Home decision

**Validation Rules:**

* Input of 0 or negative → not allowed, minimum enforced by UI controls  
* Input \> 90 days → capped at 90, show subtle note: *"Maximum stay is 90 days"*  
* Non-numeric input → not possible (number input only)

**Edge Cases:**

* Calculated departure date exceeds 12 months from today → show warning: *"Next flight search may not return results this far ahead."* but allow continuation

---

### **US-10 · Stay Duration Recommendation Text**

**Priority: Nice to Have Later**

**As a user,** I want to see a helpful suggestion for how long to stay at a destination, so that I have a starting point if I'm unfamiliar with the city.

**Acceptance Criteria:**

* Below the stay duration input, show a single line of recommendation text  
* Recommendation should feel friendly and lightweight, not technical or prescriptive  
* Recommendation label should be human, for example: *"A helpful starting point"*  
* Recommendation copy can use wording such as: *"A great first plan is 3 days in Lisbon."*  
* Recommendations are a static lookup table for the top \~100 backpacker destinations (hardcoded for MVP)  
* If no data exists for a city → recommendation text is hidden entirely (no fallback guess)  
* Recommendation does not auto-fill the input; it is advisory only

**Edge Cases:**

* City name in lookup table doesn't match API destination name exactly → use fuzzy match or IATA code as key

---

## **EPIC 4: Trip Continuation Logic**

---

### **US-11 · Continue Trip Flow**

**Priority: Must Have**

**As a user,** I want to choose to continue my trip from my current destination, so that I can keep adding stops and finding the next cheapest flight.

**Acceptance Criteria:**

* After stay duration is confirmed, show two options: **"Continue to the next destination"** and **"Wrap up and fly home"**  
* Selecting "Continue to the next destination" triggers a new flight search: origin \= current destination, date \= calculated next departure date  
* The trip progress indicator updates: *"Stop 2"*  
* Previous stops are visible in a persistent trip summary strip above the new results  
* Flow continues identically to the initial flight search (US-05 onwards)  
* The "Continue trip" option is hidden (only "Head home" shown) when the user reaches stop 15

**Edge Cases:**

* Flight search from new origin returns no results → show empty state (US-05) with option to adjust date or go home  
* User navigates back from new results → stay duration screen re-appears with same values

---

### **US-12 · Come Back Home Flow**

**Priority: Must Have**

**As a user,** I want to choose to fly back home at any point, so that I can complete my trip and see the final itinerary.

**Acceptance Criteria:**

* "Head home" option is always visible after stay duration is confirmed (from stop 1 onward)  
* Selecting "Head home" triggers a flight search: origin \= current destination, destination \= user's original origin city  
* Results show up to 3 cheapest one-way flights home on the calculated departure date  
* User selects a flight home; this is added as the final leg of the trip  
* After selection, system immediately advances to the Final Itinerary screen  
* From the itinerary screen, the user can continue to the Booking Review screen
* If no flights home are found → show: *"No direct return flights found. Try adjusting your departure date."* with ±1 day buttons

**Edge Cases:**

* User is already at their origin city (impossible in normal flow, but) → "Head home" is hidden if current destination \= origin  
* User heads home from stop 1 (only 1 destination) → valid trip, itinerary shows 2 legs (outbound \+ return)

---

### **US-13 · Trip Chain Management**

**Priority: Must Have**

**As a user,** I want to see my trip being built as I go, so that I always know where I've been, where I am, and how many stops I have left.

**Acceptance Criteria:**

* A persistent trip progress bar or breadcrumb is shown throughout the planning flow  
* Shows: completed stops (city \+ dates), current stop in progress, stops remaining (e.g. *"3 of 15 stops used"*)  
* Completed stops are tappable to expand details (city, arrival date, stay duration, flight cost)  
* User can **not** edit or remove a past stop in MVP (view only)  
* Trip state is maintained in the URL as encoded parameters so the session can be resumed if the page is refreshed

**Edge Cases:**

* User refreshes mid-flow → trip state restores from URL (no data loss)  
* URL is too long (\>2000 chars for 15 stops) → use compressed encoding (base64 or similar)  
* User opens the URL on a different device → trip displays correctly in view-only mode (continue flow not forced)

---

### **US-14 · Maximum 15 Destinations Enforcement**

**Priority: Must Have**

**As a user,** I want the app to handle the 15-stop limit gracefully, so that I'm not confused when I can no longer add more destinations.

**Acceptance Criteria:**

* After stop 15 is confirmed, the continue button is removed  
* Only the fly-home option is shown  
* A clear message explains that the trip has reached the current stop limit  
* Tone is friendly, not an error  
* After user selects a return flight, flow proceeds to final itinerary normally

**Edge Cases:**

* If user reaches stop 15 and no home flights are available → show same empty state as US-12 with ±1 day options

---

## **EPIC 5: Final Itinerary**

---

### **US-15 · Final Itinerary View**

**Priority: Must Have**

**As a user,** I want to see a complete summary of my planned trip after I finish, so that I have a single reference for my entire journey.

**Acceptance Criteria:**

* Itinerary screen is shown immediately after the return flight is selected  
* Screen title: *"Your Trip"*  
* Two tabs or toggle: **Timeline** and **Map**  
* Timeline tab is shown by default  
* Total trip cost is shown prominently at the top (sum of all selected flight prices)  
* A **"Share trip"** button generates a URL that encodes the full itinerary  
* A primary **"Proceed to booking options"** button opens the booking review screen

**Edge Cases:**

* User can return from booking review back to itinerary overview  
* Trip with only 1 destination \+ return → valid, show 2-leg itinerary

---

### **US-16 · Timeline View**

**Priority: Must Have**

**As a user,** I want to see my trip as a chronological timeline, so that I can understand the full journey at a glance.

**Acceptance Criteria:**

Each leg shows:

* Leg number (e.g. *Leg 1*)  
* Origin → Destination city (with IATA codes)  
* Departure date \+ time  
* Arrival date \+ time  
* Flight duration  
* Airline  
* Price for this leg  
* Weather at destination: temperature \+ icon on arrival date

Between legs (at each destination), show a stay block:

* City name  
* Dates of stay (arrival → departure)  
* Number of nights

At the bottom:

* **Total flight cost** (sum of all legs)  
* Note: *"Prices are estimates. Final prices confirmed at booking."*

**Edge Cases:**

* Stay of 1 night → show *"1 night in \[City\]"*  
* Flight crosses midnight → arrival date shown correctly as next day  
* Very long city names → truncated to 20 chars with ellipsis

---

### **US-17 · Map View**

**Priority: Must Have**

**As a user,** I want to see my trip plotted on a map, so that I can visualize the route geographically.

**Acceptance Criteria:**

* Map shows all destination cities as numbered pins (1 \= origin, 2 \= stop 1, etc.)  
* Pins connected by lines in trip order (polyline or arc)  
* Map auto-fits to show all pins with padding  
* Tapping a pin shows a tooltip: city name, arrival date, stay duration  
* Return flight to origin is shown as a final line back to pin 1  
* Map is interactive: pan and zoom

**Edge Cases:**

* All destinations on the same continent → map fits tightly to region  
* Trip spans multiple continents → map zooms out to world view automatically  
* Two stops in the same city (unlikely but possible) → pins overlap; show as one pin with a note *"Visited twice"*

---

### **US-18 · Booking Links**

**Priority: Must Have**

**As a user,** I want a link to book each flight from the itinerary, so that I can complete my purchases without having to search again.

**Acceptance Criteria:**

* Every flight leg in the timeline has a **"Book"** button  
* Button opens the flight aggregator or airline booking page in a new tab  
* Deep link includes: origin, destination, date, and optionally airline (pre-filled where possible)  
* Link uses the flight data returned from the API; booking URLs point to Google Flights deep links (`https://www.google.com/flights#search;f={origin};t={dest};d={date};tt=o`)
* Button label: *"Book — $\[price\]"*

**Edge Cases:**

* Booking link is expired (flight no longer available at that price) → user lands on aggregator search page; acceptable for MVP  
* API does not return a booking URL for a specific flight → button shows *"Search flight"* and links to a generic search on the aggregator with origin/destination/date pre-filled

---

### **US-19 · Total Trip Price Summary**

**Priority: Must Have**

**As a user,** I want to see the total estimated cost of all my flights, so that I can quickly understand the overall budget for the trip.

**Acceptance Criteria:**

* Total price shown at the top of the itinerary screen in large text  
* Format: *"Total flights: $\[sum\]"*  
* Breakdown is visible in the timeline (each leg's price shown individually)  
* Disclaimer shown below total: *"Prices are live estimates and may change at booking."*  
* Currency: USD for MVP

**Edge Cases:**

* One leg's price is unavailable → exclude from total and add note: *"Price unavailable for 1 leg"*  
* Total exceeds $10,000 → display normally, no cap

---

## **Priority Summary**

| Story | Title | Priority |
| ----- | ----- | ----- |
| US-01 | City / Airport Input | Must Have |
| US-02 | Nearby Airport Selection | Should Have |
| US-03 | Departure Date Selection | Must Have |
| US-04 | Date Switching While Browsing | Should Have |
| US-05 | Display 10 Cheapest Flights | Must Have |
| US-06 | Flight Result Cards | Must Have |
| US-07 | Destination Weather Summary | Should Have |
| US-08 | Destination Selection | Must Have |
| US-09 | Stay Duration Selection | Must Have |
| US-10 | Stay Duration Recommendation Text | Nice to Have Later |
| US-11 | Continue Trip Flow | Must Have |
| US-12 | Come Back Home Flow | Must Have |
| US-13 | Trip Chain Management | Must Have |
| US-14 | Maximum 15 Destinations | Must Have |
| US-15 | Final Itinerary View | Must Have |
| US-16 | Timeline View | Must Have |
| US-17 | Map View | Must Have |
| US-18 | Booking Links | Must Have |
| US-19 | Total Trip Price Summary | Must Have |

# **Functional Requirements Specification**

## **Trip Planner MVP — Engineer Reference**

---

## **Document Conventions**

* **FE** \= Frontend responsibility  
* **BE** \= Backend responsibility  
* **EXT** \= External API dependency  
* All times in UTC unless stated otherwise  
* All prices in USD unless stated otherwise  
* "Session" \= URL-encoded trip state (no server-side session)

---

## **1\. Search and Input Logic**

**Purpose:** Allow users to find and select a departure airport via free-text search.

**Trigger:** User types into the origin input field on the home screen.

**Inputs:**

* Raw text string from user (min 2 characters)  
* Keystroke events (debounced)

**Outputs:**

* Ranked list of up to 7 airport/city suggestions  
* Each suggestion: `{ city_name, country_name, airport_name, iata_code }`

**Business Rules:**

* Autocomplete fires after 2 characters, debounced at 300ms  
* Results ranked by: exact IATA match first → city name prefix match → fuzzy match  
* Only show airports with scheduled commercial flights (filter out private/military)  
* A city with multiple airports (e.g. London: LHR, LGW, STN) shows each airport as a separate suggestion  
* Maximum 7 suggestions rendered at any time  
* Selecting a suggestion emits `{ iata_code, city_name, country_name, lat, lng }` and locks the origin field

**Validations:**

* Input trimmed before search  
* Input capped at 100 characters (silently trimmed beyond that)  
* Only printable characters accepted  
* Empty or whitespace-only string → no search fired

**Failure Cases:**

* Autocomplete API timeout (\>3s) → show inline message: *"Search unavailable. Try again."* with retry; do not block UI  
* No matches found → show: *"No airports found. Try a different city or code."*  
* Network offline → show: *"No connection. Please check your network."*

---

## **2\. Airport and City Resolution Logic**

**Purpose:** Translate a user-selected city/airport into a canonical airport entity used throughout the session, and surface nearby alternatives.

**Trigger:** User selects a suggestion from the autocomplete list.

**Inputs:**

* Selected suggestion object: `{ iata_code, city_name, country_name, lat, lng }`

**Outputs:**

* Confirmed origin: `{ iata_code, city_name, country_name, lat, lng }`  
* Nearby airports list (optional): array of `{ iata_code, city_name, distance_km }`, max 3 items

**Business Rules:**

* BE queries airports database for all airports within 150km radius of `lat/lng`  
* Exclude the selected airport from the nearby list  
* Sort nearby airports by distance ascending  
* Show maximum 3 nearby options  
* If 0 nearby airports found, nearby section is omitted entirely from response  
* Nearby airport selection replaces the origin silently (no confirmation dialog)  
* The resolved origin `iata_code` is the canonical identifier used for all downstream flight searches

**Validations:**

* `iata_code` must be a valid 3-letter IATA code (regex: `/^[A-Z]{3}$/`)  
* `lat/lng` must be valid coordinates: lat ∈ \[-90, 90\], lng ∈ \[-180, 180\]  
* If lat/lng are missing, skip nearby airport lookup silently

**Failure Cases:**

* Nearby airport lookup fails → silently omit nearby section; origin selection still succeeds  
* Resolved IATA code does not exist in flight API → surface error only at flight search time, not here

---

## **3\. Flight Search Logic**

**Purpose:** Retrieve and return the 10 cheapest one-way flights from a given origin on a given date.

**Trigger:**

* User confirms origin \+ departure date (initial search)  
* User selects "Continue trip" (subsequent searches)  
* User changes the date on the results screen

**Inputs:**

{  
  origin\_iata: string,         // e.g. "BCN"  
  date: string,                // ISO 8601: "YYYY-MM-DD"  
  destination\_iata?: string,   // only set for "Head home" search  
  adults: 1,                   // hardcoded for MVP  
  cabin\_class: "economy",      // hardcoded for MVP  
  currency: "USD"              // hardcoded for MVP  
}

**Outputs:**

\[  
  {  
    flight\_id: string,  
    origin\_iata: string,  
    destination\_iata: string,  
    destination\_city: string,  
    destination\_country: string,  
    destination\_lat: number,  
    destination\_lng: number,  
    departure\_datetime: string,   // ISO 8601  
    arrival\_datetime: string,     // ISO 8601  
    duration\_minutes: number,  
    airline\_name: string,  
    stops: number,  
    price\_usd: number,  
    booking\_url: string  
  }  
\]

**Business Rules:**

* BE acts as a proxy to the flight API (SerpAPI primary, Kiwi/Tequila fallback); API keys never exposed to FE
* Sort results by `price_usd` ascending before returning to FE  
* Return maximum 10 results; if API returns more, truncate after sorting  
* If multiple flights exist to the same destination, return only the cheapest one per destination  
* For "Head home" search: pass `destination_iata` \= original origin; return up to 3 results (different airlines/times on same route)  
* `flight_id` is a stable identifier from the API used to construct booking URLs  
* Cache results per `(origin_iata, date)` key for 5 minutes on BE to reduce API calls during date switching

**Validations:**

* `origin_iata` must be present and valid  
* `date` must be today+1 or later (BE validates, rejects with 400 if in past)  
* `date` must not exceed today+365 (BE validates, rejects with 400\)  
* Response must contain at least `origin_iata`, `destination_iata`, `price_usd`, `departure_datetime`, `arrival_datetime` per flight; records missing these are excluded

**Failure Cases:**

* External API returns error → BE returns 502 with `{ error: "flight_api_unavailable" }`  
* External API returns 0 results → BE returns 200 with empty array `[]`  
* External API timeout (\>8s) → BE returns 504; FE shows retry option  
* Fewer than 3 results returned → FE shows reduced list \+ prompt to try adjacent dates  
* 0 results → FE shows empty state with ±1 day quick-switch buttons

---

## **4\. Date Selection and Switching Logic**

**Purpose:** Allow users to set and change the departure date at any point during flight browsing without restarting the flow.

**Trigger:**

* Initial date selection after origin is confirmed  
* User taps "Previous day" or "Next day" arrows on results screen  
* User taps the date label to open full calendar picker

**Inputs:**

* Selected date (from calendar or arrow tap)  
* Current origin `iata_code`  
* Current stop index (to validate minimum date for subsequent legs)

**Outputs:**

* Updated date stored in session state  
* New flight search triggered with updated date (see §3)  
* Updated date label on results screen

**Business Rules:**

* For the initial leg: minimum selectable date \= today \+ 1  
* For subsequent legs: minimum selectable date \= arrival date of previous leg \+ 1 day (enforced in UI)  
* "Previous day" button is disabled if the resulting date would be today or earlier  
* "Next day" button is disabled if resulting date \> today \+ 365  
* Tapping Previous/Next debounced at 400ms to prevent rapid API hammering  
* Calendar picker shows current selected date as highlighted  
* Dates outside valid range shown as greyed out and non-interactive

**Validations:**

* Date must be ISO 8601 string `YYYY-MM-DD`  
* Date must pass same BE validation as flight search (§3)  
* FE validates range before firing API call; invalid dates never sent to BE

**Failure Cases:**

* New date returns 0 flights → show empty state without resetting the date (user can try another)  
* Calendar picker fails to render → fall back to plain `<input type="date">` HTML element

---

## **5\. Flight Result Display Logic**

**Purpose:** Render flight options as tappable cards, sorted by price, with all key details visible.

**Trigger:** BE returns flight search results array.

**Inputs:**

* Array of flight objects (see §3 output schema)  
* Current stop index (for label: "Stop 1", "Stop 2", etc.)  
* Current date  
* Origin city name

**Outputs:**

* Rendered list of up to 10 flight cards  
* Each card is tappable and emits selected flight object on tap

**Business Rules:**

* Cards rendered in price-ascending order (BE already sorted; FE trusts sort order)  
* If two flights have identical price, sort by `duration_minutes` ascending (FE-side tiebreak)  
* Destination city name truncated to 24 characters on card; full name shown on selection screen  
* Price displayed as: `$[integer]` — no decimal places unless price \< $1 (edge case: show `$0.99`)  
* Stops displayed as: `Direct`, `1 stop`, `2 stops` (not "0 stops")  
* Duration displayed as: `2h 15m` (FE formats from `duration_minutes`)  
* Times displayed as: `HH:MM` in local airport time (derive from `departure_datetime` and destination timezone)  
* Skeleton cards (10 of them) shown during loading  
* Weather widget rendered per card asynchronously (see §6); card renders without waiting for weather

**Validations:**

* Cards with missing `price_usd`, `destination_iata`, `departure_datetime`, or `arrival_datetime` are excluded from render  
* If rendered card count drops below 1 after filtering → treat as empty state

**Failure Cases:**

* Partial API response (some fields null) → exclude affected cards, render rest  
* Image or logo assets fail → fall back to text or initials without blocking booking
* Render error on individual card → catch per-card, skip that card, log to console

---

## **6\. Weather Display Logic**

**Purpose:** Show a minimal weather summary (temperature \+ condition icon) per destination on the projected arrival date.

**Trigger:** Flight result cards are rendered; weather loads asynchronously per destination.

**Inputs:**

* `destination_lat`, `destination_lng` per flight result  
* Projected arrival date (derived from departure date \+ flight duration)

**Outputs per card:**

{  
  temperature\_c: number,  
  condition: "clear" | "cloudy" | "rain" | "snow" | "storm" | "unknown",  
  is\_forecast: boolean,      // true if within 10-day forecast window  
  is\_average: boolean        // true if using historical climate average  
}

**Business Rules:**

* BE fetches weather data from OpenWeatherMap (or equivalent) per destination  
* If arrival date is ≤ 10 days from today: use forecast API endpoint  
* If arrival date is \> 10 days from today: use historical climate average for that location and calendar month  
* Weather requests are batched by BE per flight search result (one batch call per search, not one per card)  
* Results cached per `(lat, lng, date)` for 1 hour on BE  
* If `is_average = true`, FE renders a small label: *"Avg for this time of year"*  
* Temperature displayed as integer: `23°C`  
* Condition maps to a simple icon set (6 icons total: sun, cloud, rain, snow, storm, unknown)  
* Weather widget is non-blocking: cards render fully without it; weather fills in when ready

**Validations:**

* Temperature must be a number; if null → hide widget for that card  
* Condition must match one of the 6 allowed values; unknown values map to `"unknown"` icon

**Failure Cases:**

* Weather API unavailable → hide weather widget silently on all cards; no user-facing error  
* Specific destination not found in weather API → hide widget for that card only  
* Weather response takes \>5s → hide widget for that batch; do not block card interaction

---

## **7\. Destination Confirmation Logic**

**Purpose:** Lock in a user's selected flight as the next stop in the trip chain.

**Trigger:** User taps a flight card.

**Inputs:**

* Selected flight object (full object from §3 output)  
* Current stop index

**Outputs:**

* Confirmed stop added to trip chain:

{  
  stop\_index: number,  
  origin\_iata: string,  
  destination\_iata: string,  
  destination\_city: string,  
  destination\_country: string,  
  destination\_lat: number,  
  destination\_lng: number,  
  departure\_datetime: string,  
  arrival\_datetime: string,  
  duration\_minutes: number,  
  airline\_name: string,  
  stops: number,  
  price\_usd: number,  
  booking\_url: string  
}

* UI advances to stay duration input screen  
* Trip chain state updated in URL

**Business Rules:**

* Only one flight can be selected per stop; selecting a new card replaces the previous selection  
* Stop index increments by 1 on confirmation  
* Arrival datetime is stored as-is from the API (used as base for next departure date calculation)  
* Back navigation from stay duration screen returns to flight list without re-fetching (use cached results from §3)  
* If user goes back and selects a different flight, the previous confirmed stop is discarded and replaced

**Validations:**

* Selected flight must contain all required fields (§3 output schema); missing fields → show toast: *"Flight data incomplete. Please select another."*  
* Stop index must not exceed 15; if it does, block selection (UI should have already hidden the option)

**Failure Cases:**

* Tap registers but flight object is malformed → show toast error, do not advance screen  
* State update to URL fails (URL too long) → use compressed encoding fallback (see §11)

---

## **8\. Stay Duration Logic**

**Purpose:** Capture how many days the user plans to stay at the confirmed destination, and calculate the next departure date.

**Trigger:** Destination confirmed; stay duration screen is shown.

**Inputs:**

* Confirmed destination arrival date (`arrival_datetime` from stop)  
* User-entered stay duration in days (integer)

**Outputs:**

* `stay_duration_days: number`  
* `next_departure_date: string` (ISO 8601, derived: arrival date \+ stay duration)  
* Optional recommendation text string (see below)  
* Updated trip chain entry

**Business Rules:**

* Minimum stay: 1 day. Maximum stay: 90 days  
* Default value pre-filled: 3 days  
* `next_departure_date` \= `arrival_date + stay_duration_days` (date arithmetic, no time component needed)  
* `next_departure_date` is displayed dynamically in outcome-focused language, for example: *"You&apos;ll stay in \[City\] for 3 nights and leave on \[Formatted Date\]"*  
* Recommendation text: looked up from a static JSON file keyed by IATA code  
  * Format should feel friendly and lightweight, for example: *"A great first plan is 3 days in Lisbon."*  
  * If no entry exists for the IATA code → recommendation text hidden  
  * Recommendation is advisory only; does not set the input value  
* Input uses stepper (+/- buttons); no free-text keyboard input on mobile  
* "Set stay" button confirms the duration and advances to the continue/home decision screen

**Validations:**

* Value must be integer ≥ 1 and ≤ 90  
* Negative or zero values: blocked by UI stepper (minus button disabled at 1\)  
* Value \> 90: capped at 90, show note: *"Maximum stay is 90 days"*  
* `next_departure_date` must not exceed today \+ 365; if it does, show warning but allow continuation

**Failure Cases:**

* Recommendation JSON fails to load → silently omit recommendation; do not block screen  
* `arrival_datetime` missing or malformed → use departure date as fallback base; log error

---

## **9\. Continue Trip Logic**

**Purpose:** Advance the trip chain by triggering a new flight search from the current destination on the calculated next departure date.

**Trigger:** User taps "Continue trip" on the decision screen.

**Inputs:**

* Current destination `iata_code` (becomes new origin)  
* `next_departure_date` calculated from stay duration  
* Current stop index

**Outputs:**

* New flight search request fired (see §3) with:  
  * `origin_iata` \= current destination IATA  
  * `date` \= `next_departure_date`  
* Results screen rendered (see §5) with updated header: *"Flights from \[City\] on \[Date\]"*  
* Trip progress indicator updated: *"Stop \[N\] of 15"*  
* Collapsed trip summary updated with new confirmed stop

**Business Rules:**

* Stop index increments before new search is fired  
* "Continue trip" button hidden when stop index \= 15; only "Head home" shown  
* Trip progress indicator always visible at top of screen during planning flow  
* Collapsed summary shows all past stops; each expandable to show: city, dates, duration, price  
* Past stops are read-only; no editing allowed in MVP  
* Flight search at this point is identical to §3 with the new inputs

**Validations:**

* `next_departure_date` must be \> today (BE validates per §3)  
* Stop index must be \< 15 before "Continue trip" is permitted  
* Current destination IATA must be a valid airport code

**Failure Cases:**

* New flight search returns 0 results → show empty state with ±1 day date switcher and "Head home" option still visible  
* New flight search API fails → show error with retry; "Head home" still accessible  
* Stop index somehow exceeds 15 (defensive) → force "Head home" only, log error

---

## **10\. Return Home Logic**

**Purpose:** Search for flights from the current destination back to the original origin, and add the return leg to complete the trip chain.

**Trigger:** User taps "Head home" on the decision screen.

**Inputs:**

* Current destination `iata_code` (origin of return flight)  
* Original origin `iata_code` (destination of return flight)  
* `next_departure_date`

**Outputs:**

* Flight search results (up to 10\) filtered to return route only  
* User selects a return flight → final leg added to trip chain  
* System navigates to Final Itinerary screen

**Business Rules:**

* Flight search uses §3 logic with `destination_iata` fixed to original origin IATA  
* Results show flights on the specific date; date switching (±1 day) is still available  
* Return flight selection is mandatory to reach the itinerary; user cannot skip it  
* Return leg stored in trip chain with `is_return: true` flag  
* After return flight selection, no further stops can be added; flow terminates

**Validations:**

* `origin_iata` (current destination) must differ from `destination_iata` (home) — identical airport scenario is blocked (edge case: user somehow ends at origin city)  
* All same validations as §3 apply

**Failure Cases:**

* 0 return flights found → show: *"No flights home found on this date."* with ±1 day buttons and option to go back and stay longer  
* API failure → show error with retry; back navigation available to change stay duration  
* User navigates back from return search → returns to decision screen (continue/home choice)

---

## **11\. Trip Chain Logic**

**Purpose:** Maintain, serialize, and restore the full trip state across the planning session.

**Trigger:** Any state change: stop confirmed, stay set, flight selected, return added.

**Inputs:**

* Full trip chain array (all confirmed stops)  
* Current planning state (current stop index, current screen, pending inputs)

**Outputs:**

* Updated URL query string (encoded trip state)  
* Rendered trip progress indicator  
* Collapsed stop history component

**Data Structure (trip chain):**

{  
  "origin": { "iata": "BCN", "city": "Barcelona", "lat": 41.29, "lng": 2.07 },  
  "stops": \[  
    {  
      "stop\_index": 1,  
      "origin\_iata": "BCN",  
      "destination\_iata": "LIS",  
      "destination\_city": "Lisbon",  
      "destination\_country": "Portugal",  
      "destination\_lat": 38.77,  
      "destination\_lng": \-9.13,  
      "departure\_datetime": "2025-05-10T06:00:00Z",  
      "arrival\_datetime": "2025-05-10T07:45:00Z",  
      "duration\_minutes": 105,  
      "airline\_name": "Ryanair",  
      "stops": 0,  
      "price\_usd": 34,  
      "booking\_url": "https://...",  
      "stay\_duration\_days": 4,  
      "next\_departure\_date": "2025-05-14",  
      "is\_return": false  
    }  
  \],  
  "current\_stop\_index": 2,  
  "status": "planning"   // "planning" | "complete"  
}

**Business Rules:**

* Trip chain serialized to JSON → base64 encoded → stored as single URL query param `?trip=...`  
* On page load: if `?trip=` param exists, decode and restore state  
* Restored state re-renders the appropriate screen for `current_stop_index` and `status`  
* Maximum 15 stops enforced: `stops.length <= 15`  
* If restored URL state is malformed → silently discard and show home screen  
* Progress indicator text: *"\[N\] of 15 stops used"*  
* Each past stop in the collapsed history shows: city name, arrival date, stay duration, flight cost

**Validations:**

* On restore: validate that decoded JSON matches expected schema; reject and discard if invalid  
* Stop count in restored state must not exceed 15  
* All IATA codes in chain must match `/^[A-Z]{3}$/`

**Failure Cases:**

* URL too long for browser (\>2000 chars typical limit) → encode with LZ-string or similar compression; target \<500 chars for 15-stop trip  
* Decode fails (corrupted URL) → home screen with toast: *"Couldn't restore your trip. Please start again."*  
* State restored but origin airport no longer searchable → proceed with restored data; do not re-validate against search API

---

## **12\. Final Itinerary Generation**

**Purpose:** Assemble and render the complete trip summary after the return flight is confirmed.

**Trigger:** User selects return flight; trip chain `status` set to `"complete"`.

**Inputs:**

* Complete trip chain (all stops including return leg)  
* Weather data per destination (fetched on demand if not cached)

**Outputs:**

* Itinerary object:

{  
  "total\_price\_usd": 187,  
  "legs": \[ /\* all stops from chain, in order \*/ \],  
  "origin": { /\* original origin \*/ },  
  "generated\_at": "ISO timestamp"  
}

* Rendered itinerary screen with Timeline and Map tabs

**Business Rules:**

* `total_price_usd` \= sum of all `price_usd` values across all stops (including return leg)  
* Legs rendered in `stop_index` order  
* Weather fetched for each destination arrival date; same logic as §6  
* Weather for return leg (home city) is included in the itinerary  
* "Share trip" URL \= current URL with `?trip=` encoding of complete chain  
* Itinerary is static once generated; no further editing in MVP  
* `generated_at` timestamp shown as: *"Trip planned on \[Date\]"*

**Validations:**

* All stops must have `price_usd` present to be included in total; missing price noted in disclaimer  
* Leg order must be strictly sequential by `stop_index`

**Failure Cases:**

* Total price calculation encounters null → skip that leg's price, append disclaimer: *"Price unavailable for 1 leg"*  
* Weather fetch fails at itinerary stage → hide weather silently (same as §6)  
* Itinerary screen fails to render → show: *"Couldn't generate your itinerary. Please go back and try again."* with back button

---

## **13\. Timeline Rendering Requirements**

**Purpose:** Display the full trip as a vertical chronological list of flight legs and stay blocks.

**Trigger:** Itinerary screen loaded; Timeline tab active (default).

**Inputs:**

* Ordered array of trip legs (from §12)  
* Weather data per destination

**Outputs:**

* Rendered vertical timeline component

**Rendering Rules per Leg:**

\[Leg N\] BCN → LIS  
Ryanair · Direct · 1h 45m  
Departs: Mon 10 May, 06:00 → Arrives: 07:45  
Price: $34                        \[Book — $34\]  
Weather on arrival: ☀ 22°C

**Rendering Rules per Stay Block (between legs):**

📍 Lisbon, Portugal  
4 nights · 10 May → 14 May

**Business Rules:**

* Flight leg and stay block alternate in strict order: leg → stay → leg → stay → ... → return leg  
* Duration formatted from `duration_minutes`: `1h 45m`  
* Times shown in local airport time (derive from ISO datetime \+ destination timezone offset)  
* Stops shown as: `Direct`, `1 stop`, `2 stops`  
* Stay block omitted after return leg (no stay at home needed)  
* Nights shown as: `1 night`, `N nights`  
* Price disclaimer at bottom of timeline: *"Prices are estimates. Final prices confirmed at booking."*  
* Total price banner pinned at top: *"Total flights: $187"*

**Failure Cases:**

* Missing `departure_datetime` on a leg → show: *"Time unavailable"* for that leg's times  
* Timezone offset unavailable → fall back to UTC display with label *(UTC)*  
* Timeline renders empty (no legs) → show: *"No itinerary data available."* with back button

---

## **14\. Map Rendering Requirements**

**Purpose:** Display the full trip route geographically with numbered pins and connecting lines.

**Trigger:** User taps "Map" tab on itinerary screen.

**Inputs:**

* Ordered array of trip stops, each with `{ city_name, lat, lng, stop_index, arrival_date, stay_duration_days }`  
* Original origin `{ city_name, lat, lng }`

**Outputs:**

* Interactive map with numbered pins and polyline route

**Business Rules:**

* Map library: Leaflet.js (open source, no API key required for base tiles; use OpenStreetMap tiles)  
* Pin numbering: origin \= 1, stop 1 \= 2, stop 2 \= 3, ..., return to origin closes the loop (no extra pin; line returns to pin 1\)  
* Pins connected by straight polylines in stop order (no curved arcs for MVP)  
* Map auto-fits bounds to include all pins with 40px padding

Tapping a pin shows tooltip:  
 \[City Name\]Arrives: \[Date\]Stay: \[N\] nights

*   
* Map is pannable and zoomable (standard Leaflet defaults)  
* Return route line drawn from last stop back to origin pin (same pin 1\)

**Validations:**

* All stops must have valid `lat/lng` to render on map; stops with null coordinates are skipped (no pin)  
* If fewer than 2 valid pins → map renders with available pins but no polyline; show note: *"Route incomplete."*

**Failure Cases:**

* Map tiles fail to load (CDN down) → show blank map with pins only; pins and tooltips still functional  
* Leaflet fails to initialize → show static text fallback: *"Map unavailable. View the timeline for your full route."*  
* All stops have null coordinates → hide map tab entirely; show timeline only

---

## **15\. Booking Link Handling**

**Purpose:** Provide a direct link from each itinerary leg to complete the flight purchase externally.

**Trigger:** User taps "Book — $\[price\]" button on any leg in the timeline.

**Inputs:**

* `booking_url` from flight object (Google Flights deep link: `https://www.google.com/flights#search;f={origin};t={dest};d={date};tt=o`)
* Fallback: `{ origin_iata, destination_iata, departure_date, airline_name }`

**Outputs:**

* New browser tab opened with booking URL or fallback search URL

**Business Rules:**

* Primary: use `booking_url` from API directly; open in new tab

Fallback (if `booking_url` is null or empty): construct a Google Flights search deep link:
 https://www.google.com/flights#search;f={origin\_iata};t={destination\_iata};d={departure\_date};tt=o

*   
* Button label: *"Book — $\[price\]"* (primary) or *"Search flight"* (fallback)  
* Booking URL is not validated or health-checked before display; stale prices are expected and disclosed via disclaimer  
* Links always open in a new tab (`target="_blank"` with `rel="noopener noreferrer"`)

**Validations:**

* `booking_url` must be a valid URL (starts with `https://`); otherwise trigger fallback  
* Fallback URL constructed only if `origin_iata`, `destination_iata`, and `departure_date` are all present

**Failure Cases:**

* Both `booking_url` and fallback data are missing → hide "Book" button for that leg; show static text: *"Booking link unavailable"*  
* Booking URL leads to expired listing (expected) → user lands on aggregator; no error handling needed on our side

---

## **16\. Price Aggregation**

**Purpose:** Calculate and display the total estimated flight cost for the full trip.

**Trigger:** Final itinerary generated (§12).

**Inputs:**

* Array of `price_usd` values from all confirmed legs (including return)

**Outputs:**

* `total_price_usd`: integer (rounded to nearest dollar)  
* Per-leg prices rendered in timeline  
* Disclaimer text if any price is missing

**Business Rules:**

* Total \= sum of all `price_usd` values where value is a valid positive number  
* Legs with null or undefined `price_usd` excluded from sum  
* If any leg excluded: append to disclaimer: *"Price unavailable for \[N\] leg(s)."*  
* Display format: `$[total]` — integer only, no decimals  
* Per-leg price in timeline: `$[price]` next to each leg  
* Total price banner pinned to top of itinerary screen (not scrolled away)

**Validations:**

* `price_usd` must be a positive number; zero or negative values treated as missing  
* Total must be ≥ 0; if all prices missing, show: *"Total: Unavailable"*

**Failure Cases:**

* All `price_usd` values are null → display *"Total: Unavailable"* with disclaimer  
* Sum overflows (extremely unlikely at realistic flight prices) → display raw sum; no cap

---

## **17\. Error Handling**

**Purpose:** Define consistent error states, messaging, and recovery paths across the application.

### **Error Categories and Handling**

| Error Type | Trigger | User Message | Recovery Action |
| ----- | ----- | ----- | ----- |
| Airport search unavailable | Autocomplete API timeout/failure | *"Search unavailable. Try again."* | Retry button inline |
| No airports found | 0 autocomplete results | *"No airports found."* | User modifies input |
| Flight search failed | BE returns 5xx or network error | *"Couldn't load flights. Check your connection and try again."* | Retry button; back navigation |
| Flight search timeout | API response \> 10s | *"Taking too long. Please try again."* | Retry button |
| No flights found | API returns 0 results | *"No flights found on this date."* | ±1 day quick buttons |
| Fewer than 3 flights | API returns 1–2 results | *"Not many flights on this date. Try a nearby date."* | ±1 day quick buttons |
| No return flights | Return search returns 0 results | *"No flights home found on this date."* | ±1 day; back to adjust stay |
| Weather unavailable | Weather API failure | *(hidden silently)* | None needed |
| Trip state corrupted | URL decode failure | *"Couldn't restore your trip. Please start again."* | Home screen |
| Itinerary generation failed | Rendering error | *"Couldn't generate your itinerary. Please go back."* | Back button |
| Map unavailable | Leaflet init failure | *"Map unavailable. View the timeline."* | Timeline tab shown |
| Booking link missing | No URL \+ no fallback data | *"Booking link unavailable"* | Static text only |

**Global Rules:**

* All error messages are plain English, non-technical, friendly in tone  
* Errors never expose API keys, stack traces, or internal error codes to FE  
* BE always returns structured error responses: `{ error: string, message: string, retryable: boolean }`  
* FE logs full error details to console; only user-friendly message shown in UI  
* No error state is a dead end; every error includes either a retry, a back option, or an alternative action

---

## **18\. Performance Expectations for MVP**

**Purpose:** Define minimum acceptable performance targets to ensure usable experience on mobile networks.

### **Response Time Targets**

| Operation | Target | Maximum Acceptable |
| ----- | ----- | ----- |
| Autocomplete suggestions | \< 300ms | 1s |
| Flight search (initial) | \< 4s | 8s |
| Flight search (date switch) | \< 3s (cached) | 6s |
| Weather data per batch | \< 2s | 5s |
| Itinerary screen render | \< 1s (client-side) | 2s |
| Map initialization | \< 1.5s | 3s |
| URL encode/decode (trip state) | \< 100ms | 300ms |

### **Frontend Performance**

* First Contentful Paint (FCP): \< 2s on 4G mobile  
* Total bundle size: \< 500KB gzipped (no heavy UI libraries; Leaflet \~140KB is the largest dependency)  
* Skeleton loaders shown for all async operations \> 300ms  
* No full-page reloads during planning flow (SPA behavior)  
* Debounce all user inputs that trigger API calls (300–400ms)  
* Destination photos are not used in MVP. Airline logos may appear on booking review and should fail gracefully without affecting usability.

### **Backend Performance**

* All BE endpoints respond within 8s under normal conditions  
* Flight search cached per `(origin_iata, date)` for 5 minutes (Redis or in-memory)  
* Weather cached per `(lat, lng, date)` for 1 hour  
* Autocomplete endpoint: airport data loaded in memory at startup (\< 10MB static dataset); no DB query per request  
* BE must handle at least 50 concurrent users without degradation (MVP traffic expectation)  
* Rate limiting: 60 requests/minute per IP on flight search endpoint (protect against API quota burn)

### **Resilience**

* All external API calls wrapped in timeouts (flight: 8s, weather: 5s, autocomplete: 3s)  
* Graceful degradation: weather failure → app still fully functional; flight API failure → clear error with retry  
* No single point of failure should crash the full UI; errors are scoped to the affected component

---

*End of Functional Requirements Specification*
