import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { FlightOption, WeatherSummary } from '@fast-travel/shared';
import { flightService } from '../services/FlightService';
import { airportService } from '../services/AirportService';
import { weatherService } from '../services/WeatherService';
import { requireAuth } from '../utils/requireAuth';
import { ok, fail } from '../utils/response';

const BEAM_WIDTH = 3;
const RETURN_RESERVE_RATIO = 0.35;
const MIN_HOP_BUDGET = 50;
// Hard wall-clock budget for the whole algorithm — must be less than the client timeout (90 s).
const PLAN_DEADLINE_MS = 75_000;

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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
  originIata: z.string().length(3).toUpperCase(),
  departureDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departureDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  budgetPerPerson: z.number().int().min(100).max(100_000),
  passengers: z.coerce.number().int().min(1).max(9).default(1),
  maxStops: z.number().int().min(1).max(15).default(2),
  nightsPerStop: z.number().int().min(1).max(60).default(4),
  nightsPerStopArray: z.array(z.number().int().min(1).max(60)).optional(),
  tripStyle: z.enum(['value', 'offpath', 'sunny', 'short']).default('value'),
  excludedDestinations: z.array(z.string().length(3).toUpperCase()).optional().default([]),
});

type BeamState = {
  legs: (FlightOption & { isReturn?: boolean })[];
  remainingBudget: number;
  currentOriginIata: string;
  currentDate: string;
  visited: Set<string>;
};

export const budgetPlanRoutes: FastifyPluginAsync = async (app) => {
  app.post('/trips/budget-plan', { preHandler: [requireAuth] }, async (req, reply) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send(fail('INVALID_PARAMS', parsed.error.issues[0]?.message ?? 'Invalid params'));
    }

    const { originIata, departureDateFrom, departureDateTo, budgetPerPerson, passengers, maxStops, nightsPerStop, nightsPerStopArray, tripStyle, excludedDestinations } = parsed.data;
    const deadline = Date.now() + PLAN_DEADLINE_MS;

    let beam: BeamState[] = [{
      legs: [],
      remainingBudget: budgetPerPerson,
      currentOriginIata: originIata,
      currentDate: departureDateFrom,
      visited: new Set<string>([originIata]),
    }];

    // ── Outbound hops (beam search) ───────────────────────────────────────────
    for (let i = 0; i < maxStops; i++) {
      if (Date.now() >= deadline) break;

      const nextBeam = (await Promise.all(
        beam.map(async (state): Promise<BeamState | null> => {

          // ── Budget available for this hop ────────────────────────────────
          // offpath: split remaining budget evenly across all legs still to fly
          // (remaining outbound hops + 1 return) so no single long flight starves later hops.
          // All other modes: reserve a flat 35% for the return leg.
          const totalLegsLeft = (maxStops - i) + 1; // remaining outbound + return
          const availableForHop = tripStyle === 'offpath'
            ? state.remainingBudget / totalLegsLeft
            : state.remainingBudget - state.remainingBudget * RETURN_RESERVE_RATIO;

          if (availableForHop < MIN_HOP_BUDGET) return null;
          if (state.currentDate > departureDateTo) return null;

          const originCity = airportService.getByIata(state.currentOriginIata)?.city.name ?? state.currentOriginIata;

          // ── Fetch flights ────────────────────────────────────────────────
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
            return null;
          }

          // ── Direct-only qualifying filter ────────────────────────────────
          const qualifying = flights.filter(
            (f) => f.priceUsd <= availableForHop
              && !state.visited.has(f.destinationIata)
              && f.stops === 0
              && !excludedDestinations.includes(f.destinationIata),
          );
          if (qualifying.length === 0) return null;

          // ── Candidate selection by trip style ────────────────────────────
          let candidate: FlightOption;

          if (tripStyle === 'sunny') {
            // Fetch weather for all qualifying destinations in parallel (cached, 1 h TTL)
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

          } else if (tripStyle === 'offpath') {
            // Furthest: longest direct flight within per-hop budget
            candidate = qualifying.reduce(
              (best, f) => f.durationMinutes > best.durationMinutes ? f : best,
              qualifying[0],
            );

          } else if (tripStyle === 'short') {
            // Shortest: quickest direct flight — maximises time on the ground
            candidate = qualifying.reduce(
              (best, f) => f.durationMinutes < best.durationMinutes ? f : best,
              qualifying[0],
            );

          } else {
            // value: cheapest direct flight
            candidate = qualifying[0];
          }

          // ── Advance beam state ───────────────────────────────────────────
          const newVisited = new Set(state.visited);
          newVisited.add(candidate.destinationIata);
          const arrivalDate = candidate.arrivalDatetime.slice(0, 10);
          const stayNights = nightsPerStopArray?.[i] ?? nightsPerStop;

          return {
            legs: [...state.legs, candidate],
            remainingBudget: state.remainingBudget - candidate.priceUsd,
            currentOriginIata: candidate.destinationIata,
            currentDate: addDays(arrivalDate, stayNights),
            visited: newVisited,
          };
        }),
      )).filter((s): s is BeamState => s !== null);

      if (nextBeam.length === 0) break;
      nextBeam.sort((a, b) => b.remainingBudget - a.remainingBudget);
      beam = nextBeam.slice(0, BEAM_WIDTH);
    }

    const activeBeam = beam.filter((s) => s.legs.length > 0);

    if (activeBeam.length === 0) {
      return reply.status(422).send(fail('NO_TRIPS_FOUND', 'No direct flights found within your budget. Try a higher budget or a wider date range.'));
    }

    // ── Return legs (always run — return home is mandatory) ──────────────────
    // Do NOT gate on deadline here: return leg search is only 1 API call per
    // beam state (≤ BEAM_WIDTH = 3) and must complete so the cycle closes.
    const finalBeam = await Promise.all(
      activeBeam.map(async (state) => {
        // Already back at origin (single-hop loop) — nothing to do.
        if (state.currentOriginIata === originIata) return state;

        const returnOriginCity = airportService.getByIata(state.currentOriginIata)?.city.name ?? state.currentOriginIata;

        try {
          const result = await flightService.search(
            state.currentOriginIata, returnOriginCity, state.currentDate,
            originIata, // back home
            true,
            { sort: 'price', passengers },
          );
          // Prefer direct return; fall back to any (connecting) if no direct exists.
          const allReturnHome = result.flights.filter((f) => f.destinationIata === originIata);
          const directReturn = allReturnHome.filter((f) => f.stops === 0);
          const returnPool = directReturn.length > 0 ? directReturn : allReturnHome;

          // offpath forces the return even if it blows the budget;
          // all other modes require it to fit within remaining budget.
          const returnFlight = tripStyle === 'offpath'
            ? returnPool[0]
            : returnPool.find((f) => f.priceUsd <= state.remainingBudget);

          if (returnFlight) {
            return {
              ...state,
              legs: [...state.legs, { ...returnFlight, isReturn: true }],
              remainingBudget: state.remainingBudget - returnFlight.priceUsd,
            };
          }
        } catch {
          // Flight search failed — state carries no return leg (filtered below).
        }
        return state; // no return flight found
      }),
    );

    // Prefer states that have a closed cycle (return leg present).
    // Fall back to open-ended states only if nothing closed was found.
    const hasReturn = (s: BeamState) =>
      s.legs.some((l) => l.isReturn) || s.currentOriginIata === originIata;
    const closedBeam = finalBeam.filter(hasReturn);
    const beamToRank = closedBeam.length > 0 ? closedBeam : finalBeam;

    // Pick winner: most legs first, then most remaining budget as tiebreaker
    beamToRank.sort((a, b) => b.legs.length - a.legs.length || b.remainingBudget - a.remainingBudget);
    const winner = beamToRank[0];

    const totalCostPerPerson = budgetPerPerson - winner.remainingBudget;

    return ok({ legs: winner.legs, totalCostPerPerson, budgetPerPerson });
  });
};
