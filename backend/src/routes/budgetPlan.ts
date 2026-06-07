import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { FlightOption, WeatherSummary } from '@fast-travel/shared';
import { flightService } from '../services/FlightService';
import { airportService } from '../services/AirportService';
import { weatherService } from '../services/WeatherService';
import { requireAuth } from '../utils/requireAuth';
import { ok, fail } from '../utils/response';
import { resolveLocation } from '../utils/resolveLocation';
import { fetchVisaFreeDestinations } from './visa';

const LOCATION_MARKER = /^([A-Z]{3}|@[a-z0-9_]+)$/;
function normalizeMarker(raw: string): string {
  return raw.startsWith('@') ? '@' + raw.slice(1).toLowerCase() : raw.toUpperCase();
}

const BEAM_WIDTH = 3;
const RETURN_RESERVE_RATIO = 0.35;
const MIN_HOP_BUDGET = 50;
// Hard wall-clock budget for the whole algorithm — must be less than the client timeout (90 s).
const PLAN_DEADLINE_MS = 75_000;
// Single retry backoff for transient visa-service failures (C1).
const VISA_RETRY_BACKOFF_MS = 200;

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromStr: string, toStr: string): number {
  const from = new Date(fromStr).getTime();
  const to = new Date(toStr).getTime();
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

/** Composite score for sun-chasing: warm temperature + clear sky beats cheap + cloudy. */
function sunWeatherScore(weather: WeatherSummary | null | undefined): number {
  if (!weather) return 0;
  const conditionBonus: Record<string, number> = {
    clear: 15,
    cloudy: 5,
    rain: -5,
    snow: -15,
    storm: -25,
    unknown: 0,
  };
  return weather.temperatureC + (conditionBonus[weather.condition] ?? 0);
}

const bodySchema = z.object({
  // originIata accepts a 3-letter airport IATA OR an @city_id marker. City
  // markers are resolved to the city's busiest (primary) airport for the
  // beam search — true per-airport fan-out is deferred to a follow-up PR
  // because each beam run respects its own 75 s deadline and would blow
  // the wall clock if multiplied. Member airports are still added to the
  // `visited` set so the algorithm won't propose intra-city hops.
  originIata: z.string().min(1).max(40).transform(normalizeMarker).refine((v) => LOCATION_MARKER.test(v), 'originIata must be a 3-letter IATA or @city_id'),
  departureDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departureDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  budgetPerPerson: z.number().int().min(100).max(100_000),
  passengers: z.coerce.number().int().min(1).max(9).default(1),
  maxStops: z.number().int().min(1).max(15).default(2),
  nightsPerStop: z.number().int().min(1).max(60).default(4),
  nightsPerStopArray: z.array(z.number().int().min(1).max(60)).optional(),
  tripStyle: z.enum(['value', 'offpath', 'sunny', 'short', 'visafree']).default('value'),
  excludedDestinations: z.array(z.string().length(3).toUpperCase()).optional().default([]),
  /** ISO-2 citizenship — required when tripStyle === 'visafree'. */
  passportCode: z.string().length(2).toUpperCase().optional(),
});

/** Warning attached to a successful response (B7 OVER_BUDGET, C3 WEATHER_DEGRADED, ...) */
type Warning = {
  code: 'OVER_BUDGET' | 'WEATHER_DEGRADED';
  message: string;
  [k: string]: unknown;
};

/** Why a beam state died during the outbound loop. Drives diagnostic aggregation. */
type DeathReason =
  | 'BUDGET_FLOOR'           // remaining per-hop budget below MIN_HOP_BUDGET (rare; Zod min mostly prevents this)
  | 'DATE_EXHAUSTED'         // currentDate advanced past departureDateTo
  | 'UPSTREAM_ERROR'         // flightService.search threw
  | 'NO_QUALIFYING_FLIGHTS'; // search returned results, but every flight was rejected by filters

/** Counts of why individual flights were rejected from the qualifying pool on a given hop. */
type RejectionCounts = {
  tooExpensive: number;
  alreadyVisited: number;
  connecting: number;     // stops !== 0
  excluded: number;       // in excludedDestinations
  nonVisaFree: number;    // destination country not in visaFreeCountrySet
};

/** Bookkeeping for a single dead beam — used to diagnose the dominant failure reason. */
type DeadBeam = {
  dead: DeathReason;
  rejection?: RejectionCounts;
  cheapestSeenPrice?: number;            // for B2 — cheapest flight we saw rejected for being too expensive
  cheapestSeenOrigin?: string;           // which origin that price came from
  flightsReturnedByProvider?: number;    // 0 = provider returned nothing → B4a; >0 with all rejected → B4b/B5
};

type BeamState = {
  legs: (FlightOption & { isReturn?: boolean })[];
  remainingBudget: number;
  currentOriginIata: string;
  currentDate: string;
  visited: Set<string>;
  warnings: Warning[];
};

/** Retry wrapper for transient visa-service failures (C1). */
async function fetchVisaFreeWithRetry(passport: string): Promise<string[]> {
  try {
    return await fetchVisaFreeDestinations(passport);
  } catch {
    await new Promise((r) => setTimeout(r, VISA_RETRY_BACKOFF_MS));
    return await fetchVisaFreeDestinations(passport);
  }
}

/**
 * Decide which error to surface when no closed cycle was produced.
 * Applies the priority order: UPSTREAM_ERROR > PLAN_TIMEOUT > BUDGET_FLOOR > DATE_EXHAUSTED > NO_QUALIFYING_FLIGHTS.
 * For NO_QUALIFYING_FLIGHTS, drills further into rejection sub-reasons to split B4a / B4b / B5.
 */
function classifyFailure(
  deadBeams: DeadBeam[],
  ctx: {
    deadlineHit: boolean;
    isSwap: boolean;
    isVisaFree: boolean;
    originIata: string;
    originName: string;
    countryName: string | null;
    dateFrom: string;
    dateTo: string;
    windowDays: number;
    minRequiredDays: number;
    budgetPerPerson: number;
  },
): { status: number; code: string; message: string; retryable: boolean } {
  // C4 PLAN_TIMEOUT — wins over per-beam reasons (it explains the whole run).
  if (ctx.deadlineHit) {
    return {
      status: 504,
      code: 'PLAN_TIMEOUT',
      message: 'Trip search took too long. Try fewer stops or a tighter date range.',
      retryable: true,
    };
  }

  // C2 FLIGHT_SERVICE_UNAVAILABLE — highest priority among beam-level reasons.
  // Any upstream error contributed → tell the truth, don't blame user constraints.
  if (deadBeams.some((d) => d.dead === 'UPSTREAM_ERROR')) {
    return {
      status: 502,
      code: 'FLIGHT_SERVICE_UNAVAILABLE',
      message: 'Flight search is temporarily unavailable. Please retry in a moment.',
      retryable: true,
    };
  }

  // B6 NO_ALTERNATIVES — swap context overrides B4/B5/B8.
  if (ctx.isSwap) {
    return {
      status: 422,
      code: 'NO_ALTERNATIVES',
      message: 'No alternative destination found for this swap. Reset swaps or adjust budget/dates.',
      retryable: false,
    };
  }

  // B2 BUDGET_TOO_LOW — derived from rejection counters on hop 0.
  // Fires when every flight from origin was rejected ONLY for being too expensive,
  // and we have a cheapest-seen price to base the suggestion on.
  const cheapestSeen = deadBeams
    .map((d) => d.cheapestSeenPrice)
    .filter((p): p is number => typeof p === 'number')
    .sort((a, b) => a - b)[0];
  const allBudgetCapped = deadBeams.length > 0 && deadBeams.every((d) => {
    if (d.dead !== 'NO_QUALIFYING_FLIGHTS' || !d.rejection) return false;
    const r = d.rejection;
    const totalRejected = r.tooExpensive + r.alreadyVisited + r.connecting + r.excluded + r.nonVisaFree;
    // "Mostly" budget — at least one rejected for price AND no other reason dominated.
    return r.tooExpensive > 0 && r.tooExpensive >= totalRejected - r.connecting;
  });
  if (allBudgetCapped && typeof cheapestSeen === 'number' && cheapestSeen > ctx.budgetPerPerson * (1 - RETURN_RESERVE_RATIO)) {
    const suggestedMin = Math.ceil(cheapestSeen * 2);
    return {
      status: 422,
      code: 'BUDGET_TOO_LOW',
      message: `Cheapest direct flight from ${ctx.originIata} is $${Math.ceil(cheapestSeen)}. Raise your budget to at least $${suggestedMin} to also cover a return flight.`,
      retryable: false,
    };
  }

  // B3 DATE_RANGE_TOO_NARROW — every beam (or majority) died from date exhaustion.
  const dateExhausted = deadBeams.filter((d) => d.dead === 'DATE_EXHAUSTED').length;
  if (dateExhausted > 0 && dateExhausted >= deadBeams.length / 2) {
    const gap = Math.max(1, ctx.minRequiredDays - ctx.windowDays);
    return {
      status: 422,
      code: 'DATE_RANGE_TOO_NARROW',
      message: `You need at least ${ctx.minRequiredDays} days for this plan (stays + flight days); you gave ${ctx.windowDays}. Add ${gap} more days, or reduce stops/nights.`,
      retryable: false,
    };
  }

  // B5 NO_VISA_FREE_FLIGHTS — visa-free mode, visa-filter was the dominant rejection.
  if (ctx.isVisaFree) {
    const nonVisaTotal = deadBeams.reduce((sum, d) => sum + (d.rejection?.nonVisaFree ?? 0), 0);
    const otherTotal = deadBeams.reduce((sum, d) => {
      const r = d.rejection;
      if (!r) return sum;
      return sum + r.tooExpensive + r.alreadyVisited + r.connecting + r.excluded;
    }, 0);
    if (nonVisaTotal > 0 && nonVisaTotal >= otherTotal) {
      return {
        status: 422,
        code: 'NO_VISA_FREE_FLIGHTS',
        message: `No direct visa-free routes from ${ctx.originIata}${ctx.countryName ? ` for ${ctx.countryName}` : ''} fit your budget. Try a higher budget, wider dates, or switch optimizer.`,
        retryable: false,
      };
    }
  }

  // B4a NO_FLIGHTS_AT_ALL — provider returned zero results on every dead beam.
  const allEmpty = deadBeams.length > 0
    && deadBeams.every((d) => d.flightsReturnedByProvider === 0);
  if (allEmpty) {
    return {
      status: 422,
      code: 'NO_FLIGHTS_AT_ALL',
      message: `No flights from ${ctx.originIata} on ${ctx.dateFrom}–${ctx.dateTo}. Try a different origin or widen the date range.`,
      retryable: false,
    };
  }

  // B4b NO_DIRECT_FLIGHTS — provider returned results, but connecting filter was dominant rejection.
  const connectingTotal = deadBeams.reduce((sum, d) => sum + (d.rejection?.connecting ?? 0), 0);
  const otherFilters = deadBeams.reduce((sum, d) => {
    const r = d.rejection;
    if (!r) return sum;
    return sum + r.tooExpensive + r.alreadyVisited + r.excluded + r.nonVisaFree;
  }, 0);
  if (connectingTotal > 0 && connectingTotal > otherFilters) {
    return {
      status: 422,
      code: 'NO_DIRECT_FLIGHTS',
      message: `No direct flights from ${ctx.originIata} fit your trip. Try a different origin or change dates.`,
      retryable: false,
    };
  }

  // B8 NO_TRIPS_FOUND — defensive fallback when nothing else dominated.
  return {
    status: 422,
    code: 'NO_TRIPS_FOUND',
    message: "We couldn't build a trip with these settings. Try widening dates, raising budget, or reducing stops.",
    retryable: false,
  };
}

export const budgetPlanRoutes: FastifyPluginAsync = async (app) => {
  app.post('/trips/budget-plan', { preHandler: [requireAuth] }, async (req, reply) => {
    // ── A1 INVALID_PARAMS ────────────────────────────────────────────────────
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send(fail('INVALID_PARAMS', parsed.error.issues[0]?.message ?? 'Invalid params'));
    }

    const {
      originIata: originMarker, departureDateFrom, departureDateTo, budgetPerPerson, passengers,
      maxStops, nightsPerStop, nightsPerStopArray, tripStyle, excludedDestinations, passportCode,
    } = parsed.data;

    // ── A4 UNKNOWN_ORIGIN ────────────────────────────────────────────────────
    // For city markers resolveLocation orders members by direct-route popularity
    // DESC, so [0] is the city's busiest hub — used as the seed for the beam
    // search. All member airports go into the `visited` set so the algorithm
    // won't suggest intra-city hops (FCO→CIA as a "leg" would be absurd).
    const originIatas = resolveLocation(originMarker);
    if (originIatas.length === 0) {
      return reply.status(400).send(fail('UNKNOWN_ORIGIN', "We don't recognize that origin airport. Pick another."));
    }
    const originIata = originIatas[0];
    const originAirport = airportService.getByIata(originIata);
    if (!originAirport) {
      return reply.status(400).send(fail('UNKNOWN_ORIGIN', "We don't recognize that origin airport. Pick another."));
    }

    const deadline = Date.now() + PLAN_DEADLINE_MS;
    let deadlineHit = false;
    const isSwap = excludedDestinations.length > 0;

    // ── A2 / B1 / C1 — Visa-free filter set ──────────────────────────────────
    let visaFreeCountrySet: Set<string> | null = null;
    let passportCountryName: string | null = null;
    if (tripStyle === 'visafree') {
      // A2 PASSPORT_REQUIRED
      if (!passportCode) {
        return reply.status(400).send(fail('PASSPORT_REQUIRED', 'Pick a citizenship to run the visa-free planner.'));
      }
      try {
        const allowed = await fetchVisaFreeWithRetry(passportCode);
        visaFreeCountrySet = new Set(allowed);
        // B1 NO_VISA_FREE_DESTINATIONS
        if (visaFreeCountrySet.size === 0) {
          return reply.status(422).send(fail(
            'NO_VISA_FREE_DESTINATIONS',
            `No visa-free destinations found for ${passportCode} for ${departureDateFrom}–${departureDateTo}. Try different dates or use a different optimizer.`,
          ));
        }
      } catch {
        // C1 VISA_LOOKUP_FAILED — fixed message, never leak upstream internals.
        return reply.status(502).send(fail(
          'VISA_LOOKUP_FAILED',
          "Couldn't check visa rules right now. Please retry in a moment.",
          true,
        ));
      }
    }

    // ── Window-size precompute (for B3 message) ──────────────────────────────
    const windowDays = daysBetween(departureDateFrom, departureDateTo);
    const nightsArray = nightsPerStopArray ?? Array(maxStops).fill(nightsPerStop);
    const totalNights = nightsArray.slice(0, maxStops).reduce((s: number, n: number) => s + n, 0);
    // Estimated minimum days: nights of stays + 1 flight-day per leg (including return).
    const minRequiredDays = totalNights + (maxStops + 1);

    // ── Outbound hops (beam search with death-reason tracking) ───────────────
    let beam: BeamState[] = [{
      legs: [],
      remainingBudget: budgetPerPerson,
      currentOriginIata: originIata,
      currentDate: departureDateFrom,
      visited: new Set<string>(originIatas),
      warnings: [],
    }];

    const allDeadBeams: DeadBeam[] = [];

    for (let i = 0; i < maxStops; i++) {
      if (Date.now() >= deadline) {
        deadlineHit = true;
        break;
      }

      type HopResult = { kind: 'alive'; state: BeamState } | { kind: 'dead'; info: DeadBeam };

      const hopResults: HopResult[] = await Promise.all(
        beam.map(async (state): Promise<HopResult> => {

          // Budget available for this hop.
          const totalLegsLeft = (maxStops - i) + 1; // remaining outbound + return
          const availableForHop = tripStyle === 'offpath'
            ? state.remainingBudget / totalLegsLeft
            : state.remainingBudget - state.remainingBudget * RETURN_RESERVE_RATIO;

          if (availableForHop < MIN_HOP_BUDGET) {
            return { kind: 'dead', info: { dead: 'BUDGET_FLOOR' } };
          }
          if (state.currentDate > departureDateTo) {
            return { kind: 'dead', info: { dead: 'DATE_EXHAUSTED' } };
          }

          const originCity = airportService.getByIata(state.currentOriginIata)?.city.name ?? state.currentOriginIata;

          // Fetch flights from this origin.
          let flights: FlightOption[];
          try {
            const result = await flightService.search(
              state.currentOriginIata, originCity, state.currentDate,
              undefined, // anywhere
              true,      // deduplicate
              { sort: 'price', passengers },
            );
            flights = result.flights;
          } catch {
            return { kind: 'dead', info: { dead: 'UPSTREAM_ERROR' } };
          }

          // Filter with per-rejection counters so we can diagnose why nothing matched.
          const rejection: RejectionCounts = {
            tooExpensive: 0, alreadyVisited: 0, connecting: 0, excluded: 0, nonVisaFree: 0,
          };
          let cheapestSeenPrice: number | undefined;

          const qualifying = flights.filter((f) => {
            // We track cheapest among non-stop, non-visited candidates so the
            // B2 BUDGET_TOO_LOW message reflects a realistically usable price.
            const isUsableShape = f.stops === 0
              && !state.visited.has(f.destinationIata)
              && !excludedDestinations.includes(f.destinationIata);
            const passesVisaFree = !visaFreeCountrySet || (() => {
              const cc = airportService.getByIata(f.destinationIata)?.city.countryCode;
              return cc && visaFreeCountrySet.has(cc.toUpperCase());
            })();
            if (isUsableShape && passesVisaFree) {
              if (cheapestSeenPrice === undefined || f.priceUsd < cheapestSeenPrice) {
                cheapestSeenPrice = f.priceUsd;
              }
            }

            // Rejection-counter logic — count the FIRST reason a flight fails, in priority order:
            // visa > connecting > excluded > visited > budget. This avoids double-counting and
            // gives the most informative dominant reason when aggregating.
            if (visaFreeCountrySet) {
              const cc = airportService.getByIata(f.destinationIata)?.city.countryCode;
              if (!cc || !visaFreeCountrySet.has(cc.toUpperCase())) {
                rejection.nonVisaFree++;
                return false;
              }
            }
            if (f.stops !== 0) { rejection.connecting++; return false; }
            if (excludedDestinations.includes(f.destinationIata)) { rejection.excluded++; return false; }
            if (state.visited.has(f.destinationIata)) { rejection.alreadyVisited++; return false; }
            if (f.priceUsd > availableForHop) { rejection.tooExpensive++; return false; }
            return true;
          });

          if (qualifying.length === 0) {
            return {
              kind: 'dead',
              info: {
                dead: 'NO_QUALIFYING_FLIGHTS',
                rejection,
                cheapestSeenPrice,
                cheapestSeenOrigin: state.currentOriginIata,
                flightsReturnedByProvider: flights.length,
              },
            };
          }

          // Candidate selection by trip style.
          let candidate: FlightOption;
          const hopWarnings: Warning[] = [];

          if (tripStyle === 'sunny') {
            try {
              const weatherResults = await weatherService.getBatch(
                qualifying.map((f) => ({
                  iata: f.destinationIata,
                  lat: f.destinationLat,
                  lng: f.destinationLng,
                  date: state.currentDate,
                })),
              );
              const wMap = new Map(weatherResults.map((r) => [r.iata, r.weather]));
              candidate = qualifying.reduce((best, f) =>
                sunWeatherScore(wMap.get(f.destinationIata)) > sunWeatherScore(wMap.get(best.destinationIata))
                  ? f : best,
                qualifying[0],
              );
            } catch {
              // C3 WEATHER_DEGRADED — fall back to cheapest (value strategy) and warn the user
              // that we couldn't actually optimize for weather on this hop.
              candidate = qualifying[0];
              hopWarnings.push({
                code: 'WEATHER_DEGRADED',
                message: "Couldn't check weather for some destinations — picked cheapest options instead.",
              });
            }
          } else if (tripStyle === 'offpath') {
            candidate = qualifying.reduce(
              (best, f) => f.durationMinutes > best.durationMinutes ? f : best,
              qualifying[0],
            );
          } else if (tripStyle === 'short') {
            candidate = qualifying.reduce(
              (best, f) => f.durationMinutes < best.durationMinutes ? f : best,
              qualifying[0],
            );
          } else {
            // value + visafree: cheapest direct flight from the already-filtered pool.
            candidate = qualifying[0];
          }

          // Advance beam state.
          const newVisited = new Set(state.visited);
          newVisited.add(candidate.destinationIata);
          const arrivalDate = candidate.arrivalDatetime.slice(0, 10);
          const stayNights = nightsPerStopArray?.[i] ?? nightsPerStop;

          return {
            kind: 'alive',
            state: {
              legs: [...state.legs, candidate],
              remainingBudget: state.remainingBudget - candidate.priceUsd,
              currentOriginIata: candidate.destinationIata,
              currentDate: addDays(arrivalDate, stayNights),
              visited: newVisited,
              warnings: [...state.warnings, ...hopWarnings],
            },
          };
        }),
      );

      // Collect dead-beam info for end-of-run diagnostics.
      for (const r of hopResults) {
        if (r.kind === 'dead') allDeadBeams.push(r.info);
      }

      const nextBeam = hopResults
        .filter((r): r is { kind: 'alive'; state: BeamState } => r.kind === 'alive')
        .map((r) => r.state);

      if (nextBeam.length === 0) break;
      nextBeam.sort((a, b) => b.remainingBudget - a.remainingBudget);
      beam = nextBeam.slice(0, BEAM_WIDTH);
    }

    const activeBeam = beam.filter((s) => s.legs.length > 0);

    // ── No outbound: classify and surface a specific error ────────────────────
    if (activeBeam.length === 0) {
      const classified = classifyFailure(allDeadBeams, {
        deadlineHit,
        isSwap,
        isVisaFree: tripStyle === 'visafree',
        originIata,
        originName: originAirport.city.name,
        countryName: passportCountryName,
        dateFrom: departureDateFrom,
        dateTo: departureDateTo,
        windowDays,
        minRequiredDays,
        budgetPerPerson,
      });
      return reply.status(classified.status).send(fail(classified.code, classified.message, classified.retryable));
    }

    // ── Return legs (always run — return home is mandatory) ──────────────────
    // B7 revision: never strand the user. If no return fits the remaining budget,
    // take the cheapest available return (direct preferred, else connecting) and
    // attach an OVER_BUDGET warning. The cycle ALWAYS closes for active beams.
    const originIataSet = new Set(originIatas);
    const finalBeam = await Promise.all(
      activeBeam.map(async (state): Promise<BeamState> => {
        // Already back at origin (any member airport when origin is a city).
        if (originIataSet.has(state.currentOriginIata)) return state;

        try {
          // Fan out the return search across all city-origin airports so the
          // user can return to any of them (e.g. London-origin trip might
          // return cheapest into LGW instead of LHR).
          const result = await flightService.searchOneWayFanOut(
            [state.currentOriginIata],
            state.currentDate,
            originIatas,
            { sort: 'price', passengers },
          );
          const allReturnHome = result.flights.filter((f) => originIataSet.has(f.destinationIata));
          const directReturn = allReturnHome.filter((f) => f.stops === 0);
          const returnPool = directReturn.length > 0 ? directReturn : allReturnHome;

          if (returnPool.length === 0) {
            // No return flight exists at all — leave the state without a return leg.
            // It will be filtered out in the closed-cycle check below.
            return state;
          }

          // Cheapest return — provider sorted by price; pool[0] is cheapest.
          const cheapestReturn = returnPool.reduce(
            (best, f) => f.priceUsd < best.priceUsd ? f : best,
            returnPool[0],
          );

          // Try to find one that fits remaining budget first.
          const affordableReturn = returnPool.find((f) => f.priceUsd <= state.remainingBudget);
          const returnFlight = affordableReturn ?? cheapestReturn;

          const newRemaining = state.remainingBudget - returnFlight.priceUsd;
          const warnings = [...state.warnings];

          if (!affordableReturn) {
            const overage = Math.ceil(returnFlight.priceUsd - state.remainingBudget);
            warnings.push({
              code: 'OVER_BUDGET',
              message: `Sorry, this trip is $${overage} over your budget — this is the cheapest return flight from ${state.currentOriginIata} to ${originIata}. Try different dates or fewer destinations.`,
              overage,
            });
          }

          return {
            ...state,
            legs: [...state.legs, { ...returnFlight, isReturn: true }],
            remainingBudget: newRemaining,
            warnings,
          };
        } catch {
          // Provider error on the return-leg search — leave the state without a return.
          // Filtered out below. If ALL beams hit this, the user sees C2 via the no-closed-cycle path.
          return state;
        }
      }),
    );

    // Only closed cycles are valid trips. "Home" means any member airport when
    // origin is a city marker, so a Rome trip can return to FCO or CIA.
    const hasReturn = (s: BeamState) =>
      s.legs.some((l) => l.isReturn) || originIataSet.has(s.currentOriginIata);
    const closedBeam = finalBeam.filter(hasReturn);

    if (closedBeam.length === 0) {
      // Should be rare now (B7 forces a return even if over budget), but defensive.
      // Most likely cause: provider errored on every return-leg search OR returned zero results.
      return reply.status(502).send(fail(
        'FLIGHT_SERVICE_UNAVAILABLE',
        'Flight search is temporarily unavailable. Please retry in a moment.',
        true,
      ));
    }

    // Pick winner: most legs first, then most remaining budget as tiebreaker.
    closedBeam.sort((a, b) => b.legs.length - a.legs.length || b.remainingBudget - a.remainingBudget);
    const winner = closedBeam[0];

    const totalCostPerPerson = budgetPerPerson - winner.remainingBudget;

    return ok({
      legs: winner.legs,
      totalCostPerPerson,
      budgetPerPerson,
      warnings: winner.warnings.length > 0 ? winner.warnings : undefined,
    });
  });
};
