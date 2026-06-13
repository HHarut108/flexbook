/**
 * Build a single Kiwi multi-city *search* URL covering every leg of a trip, so
 * one click opens one tab with every sector pre-filled — instead of opening N
 * popup tabs (and losing all but the first to the browser's popup blocker).
 *
 * Kiwi's path format is slash-separated triples repeated per sector:
 *   /en/search/results/{FROM}/{TO}/{YYYY-MM-DD}/{FROM2}/{TO2}/{YYYY-MM-DD}/…/
 *
 * Other shapes we tried (hyphen-joined IATA codes, comma between segments, a
 * trailing `/no-return`) silently 302 to kiwi.com/en/, which is why earlier
 * hotfixes "opened the wrong page." We confirmed the slash format by inspecting
 * the rendered HTML — Kiwi's state shows `travelType: MULTICITY_B2B2C` and the
 * full sector list.
 *
 * Note: this is a search URL, not a deep-link checkout. The user has to re-pick
 * a flight per leg on Kiwi. For deep-link checkouts to a *specific* itinerary,
 * use the per-leg `bookingUrl` Kiwi returns in the flight payload.
 */
export interface KiwiLegInput {
  originIata: string;
  destinationIata: string;
  /** ISO 8601 string, e.g. "2026-08-30T11:00:00". Only the date portion is used. */
  departureDatetime: string;
}

export function buildKiwiMultiCitySearchUrl(
  legs: KiwiLegInput[],
  passengers: number,
): string | null {
  if (legs.length === 0) return null;
  const adults = Math.max(1, Math.floor(passengers || 1));
  const segments = legs
    .map((leg) => {
      const from = leg.originIata?.trim().toUpperCase();
      const to = leg.destinationIata?.trim().toUpperCase();
      const date = leg.departureDatetime?.slice(0, 10);
      if (!from || !to || !date) return null;
      return `${from}/${to}/${date}`;
    })
    .filter((s): s is string => s !== null);
  if (segments.length === 0) return null;
  return `https://www.kiwi.com/en/search/results/${segments.join('/')}/?adults=${adults}&sortBy=price`;
}

/**
 * Round-trip *search* URL. Unlike multi-city, the round-trip format only
 * carries ONE city pair plus two dates — repeating FROM/TO/DATE/FROM/TO/DATE
 * lands on a Kiwi page that won't parse the IATAs into the form (we saw this
 * empirically: OPO/MAD/.../MAD/OPO/... opened but the From/To fields were blank).
 *
 * Format confirmed against kiwi.com's current router:
 *   /en/search/results/{FROM}/{TO}/{outbound-YYYY-MM-DD}/{return-YYYY-MM-DD}/?adults=N
 */
export function buildKiwiRoundTripSearchUrl(
  originIata: string,
  destinationIata: string,
  outboundDate: string,
  returnDate: string,
  passengers: number,
): string | null {
  const from = originIata?.trim().toUpperCase();
  const to = destinationIata?.trim().toUpperCase();
  const out = outboundDate?.slice(0, 10);
  const back = returnDate?.slice(0, 10);
  if (!from || !to || !out || !back) return null;
  const adults = Math.max(1, Math.floor(passengers || 1));
  return `https://www.kiwi.com/en/search/results/${from}/${to}/${out}/${back}/?adults=${adults}&sortBy=price`;
}
