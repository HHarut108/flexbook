# PRD Alignment Decisions

Status: approved from the questionnaire on 2026-04-01.

Purpose: this file captures the current product decisions that should guide all other docs. If a technical doc disagrees with this file, follow this file and the PRD.

---

## Source Of Truth

- The product definition and user flow come first.
- Technical docs should support the PRD, not redefine it.
- For the next pass, documentation should focus on functionality, use cases, and product rules over deep technical detail.

---

## Approved MVP Decisions

### 1. Sharing and Restore

- Shared trips are self-contained in the URL for MVP.
- A shared trip should open from the link alone.
- Refreshing the page during planning should keep the trip.
- Shared links should not expire by design in MVP.

### 2. Outbound Flight Results

- Outbound browsing should show up to 10 destination options.
- The user should see the cheapest flight per destination.
- The product goal is to help the user discover cheap next places to go, not multiple duplicate offers to the same city.

### 3. Flights Home

- "Go home" means fly from the current stop back to the original home city selected at the start.
- The user should see offers for that route back home.
- The current localhost behavior shows up to 3 flight offers on that route.
- Sort them with the cheapest options first.

### 4. Trip Size

- MVP allows up to 15 destinations away from home, then 1 return flight home.

### 5. Final Itinerary Actions

- The final itinerary should have a booking action on each leg.
- The booking review screen can also offer a "Book all at once" action that opens all booking links in separate tabs.
- Sharing the trip remains available on the final screen.
- The positive next step after the itinerary is `Proceed to booking options`.
- The booking review screen should show the full trip, all selected tickets, and per-flight booking links.
- The booking review screen can show airline logos when available, with a graceful fallback to airline initials when they are not.

### 6. Weather and Map Fallbacks

- If weather is unavailable, hide it quietly and keep the trip usable.
- If a stop has missing map coordinates, keep the trip usable and omit that stop from the map when needed.

### 7. Recommendation Text

- Keep simple recommendation text in MVP, such as suggested stay duration.

---

## Implementation Guidance

- Treat URL-based trip state as the default MVP behavior.
- Do not make server-stored itinerary sessions a required part of the first implementation pass.
- If older technical docs mention expiring server-side trip links, itinerary IDs, or restore-by-ID as required MVP behavior, treat those as legacy exploration unless explicitly re-approved.
- If older docs mention a 6-screen flow, 10 return-home offers, or no booking review step, follow the current localhost behavior instead.
