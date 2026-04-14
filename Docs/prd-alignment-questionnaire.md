# PRD Alignment Questionnaire

Purpose: answer these product questions so we can align the docs before implementation.

How to answer:
- Reply in chat with `Q1: A`, `Q2: C`, etc.
- If none of the options fit, write your own answer in one short sentence.
- If you want, you can also edit this file directly.

---

## Q1. How should sharing a trip work?

A. Share link contains the whole trip itself. If someone opens the link, the trip always opens from the link alone.

B. Share link points to a saved trip on our server. If the saved trip expires, the link stops working.

C. Start with A for MVP.

Recommended: `C`

Why this matters: this is the biggest current doc conflict.

---

## Q2. If a user refreshes the page while planning, what should happen?

A. Their current trip should still be there.

B. The app can reset and they start over.

C. Only the final itinerary should survive refresh.

Recommended: `A`

---

## Q3. Should shared trips expire?

A. No. If a link was shared, it should keep working.

B. Yes. Shared trips can expire after some time.

C. Planning sessions can expire, but shared final trips should keep working.

Recommended: `A`

---

## Q4. When showing outbound flight options, what do you want the user to see?

A. 10 different destinations max, showing the cheapest flight for each destination.

B. The 10 cheapest flights overall, even if several go to the same city.

C. A mix is fine.

Recommended: `A`

Why this matters: this is core to the product promise.

---

## Q5. When showing flights home, what do you want the user to see?

A. Many flight options home on that route, with different times and airlines.

B. Only the single cheapest flight home.

C. Top 10 flight options home, even if they are all to the same city.

Recommended: `C`
Answer: Travel plan to initial <Home> city, if the last stop is BCN, and user requests to fly home, user should see the flight that connects BCN with initial city, if there are few options in terms of route user should see max 10 of these offers, other than that user should see cheapest options
---

## Q6. What is the max trip size for MVP?

A. Up to 15 destinations away from home, then 1 return flight.

B. Up to 15 flights total, including the return.

C. Up to 10 destinations away from home, then 1 return flight.

Recommended: `A`

This should be phrased in a user-friendly way in the docs.

---

## Q7. On the final itinerary screen, what booking action should exist?

A. A booking button on each flight leg only.

B. One big "Book all" button only.

C. Both per-flight booking buttons and a "Book all" button.

Recommended: `A`

Why this matters: some docs say per-leg only, some also add "Book all".

---

## Q8. If weather is unavailable for a destination, what should the user see?

A. Hide weather quietly and keep the rest of the trip working.

B. Show a small "Weather unavailable" label.

C. Block the itinerary until weather loads.

Recommended: `A`

---

## Q9. If a destination has missing map coordinates, what should happen?

A. Show the trip anyway; that stop is just missing from the map.

B. Hide the whole map and only show the timeline.

C. Block that flight from being selected.

Recommended: `A`

---

## Q10. Which should be the main source of truth for the docs going forward?

A. Product definition / PRD first, and technical docs must follow it.

B. API design first, and product docs adjust to it.

C. Engineering plan first, and other docs adjust to it.

Recommended: `A`

---

## Q11. What level of recommendation text do you want in MVP?

A. A simple note like "Typically 3 days is enough in Lisbon."

B. No recommendation text at all.

C. Rich recommendations with activities and tips.

Recommended: `A`

---

## Q12. What matters most for the next documentation pass?

A. Clean user flow, use cases, and product rules.

B. Detailed API and data contracts.

C. Equal detail on both.

Recommended: `A`

This helps set the tone for the rewrite.

---

## Suggested MVP Defaults

If you want the fastest path, these are the defaults I would align the docs around:

- Q1: C
- Q2: A
- Q3: A
- Q4: A
- Q5: C
- Q6: A
- Q7: A
- Q8: A
- Q9: A
- Q10: A
- Q11: A
- Q12: A
