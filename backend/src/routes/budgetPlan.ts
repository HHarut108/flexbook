import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { FlightOption } from '@fast-travel/shared';
import { flightService } from '../services/FlightService';
import { airportService } from '../services/AirportService';
import { requireAuth } from '../utils/requireAuth';
import { ok, fail } from '../utils/response';

const BEAM_WIDTH = 3;
const VARIATION_BAND = 0.15;
const RETURN_RESERVE_RATIO = 0.35;
const MIN_HOP_BUDGET = 50;
// Hard wall-clock budget for the whole algorithm — must be less than the client timeout (90 s).
const PLAN_DEADLINE_MS = 75_000;

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 0x100000000; };
}

const bodySchema = z.object({
  originIata: z.string().length(3).toUpperCase(),
  departureDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departureDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  budgetPerPerson: z.number().int().min(100).max(100_000),
  passengers: z.coerce.number().int().min(1).max(9).default(1),
  maxStops: z.number().int().min(1).max(3).default(2),
  nightsPerStop: z.number().int().min(1).max(60).default(4),
  nightsPerStopArray: z.array(z.number().int().min(1).max(60)).optional(),
  tripStyle: z.enum(['value', 'surprise', 'offpath']).default('value'),
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

    const { originIata, departureDateFrom, departureDateTo, budgetPerPerson, passengers, maxStops, nightsPerStop, nightsPerStopArray, tripStyle } = parsed.data;
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

      const searchResults = await Promise.all(
        beam.map(async (state) => {
          const returnReserve = state.remainingBudget * RETURN_RESERVE_RATIO;
          const availableForHop = state.remainingBudget - returnReserve;

          if (availableForHop < MIN_HOP_BUDGET) return null;
          if (state.currentDate > departureDateTo) return null;

          const originCity = airportService.getByIata(state.currentOriginIata)?.city.name ?? state.currentOriginIata;

          try {
            const result = await flightService.search(
              state.currentOriginIata, originCity, state.currentDate,
              undefined, // anywhere
              true,      // deduplicate
              { sort: 'price', passengers },
            );
            return { state, flights: result.flights, availableForHop };
          } catch {
            return null;
          }
        }),
      );

      const nextBeam: BeamState[] = [];

      for (const res of searchResults) {
        if (!res) continue;
        const { state, flights, availableForHop } = res;

        const qualifying = flights.filter(
          (f) => f.priceUsd <= availableForHop && !state.visited.has(f.destinationIata),
        );
        if (qualifying.length === 0) continue;

        let candidate: FlightOption;
        if (tripStyle === 'surprise') {
          // 2nd cheapest, fall back to cheapest if only one option
          candidate = qualifying[1] ?? qualifying[0];
        } else if (tripStyle === 'offpath') {
          // Longest direct flight; fall back to longest overall
          const directs = qualifying.filter((f) => f.stops === 0);
          const pool = directs.length > 0 ? directs : qualifying;
          candidate = pool.reduce((best, f) => f.durationMinutes > best.durationMinutes ? f : best, pool[0]);
        } else {
          candidate = qualifying[0];
        }

        const newVisited = new Set(state.visited);
        newVisited.add(candidate.destinationIata);
        const arrivalDate = candidate.arrivalDatetime.slice(0, 10);
        const stayNights = nightsPerStopArray?.[i] ?? nightsPerStop;

        nextBeam.push({
          legs: [...state.legs, candidate],
          remainingBudget: state.remainingBudget - candidate.priceUsd,
          currentOriginIata: candidate.destinationIata,
          currentDate: addDays(arrivalDate, stayNights),
          visited: newVisited,
        });
      }

      if (nextBeam.length === 0) break;

      nextBeam.sort((a, b) => b.remainingBudget - a.remainingBudget);
      beam = nextBeam.slice(0, BEAM_WIDTH);
    }

    const activeBeam = beam.filter((s) => s.legs.length > 0);

    if (activeBeam.length === 0) {
      return reply.status(422).send(fail('NO_TRIPS_FOUND', 'No flights found within your budget. Try a higher budget or wider date range.'));
    }

    // ── Return legs (all beam states concurrently) ────────────────────────────
    let finalBeam = activeBeam;

    if (Date.now() < deadline) {
      finalBeam = await Promise.all(
        activeBeam.map(async (state) => {
          if (state.currentOriginIata === originIata) return state;

          const returnOriginCity = airportService.getByIata(state.currentOriginIata)?.city.name ?? state.currentOriginIata;

          try {
            const result = await flightService.search(
              state.currentOriginIata, returnOriginCity, state.currentDate,
              originIata, // back home
              true,
              { sort: 'price', passengers },
            );
            // Keep only flights that actually return home — never substitute a random destination.
            const returnFlights = result.flights.filter((f) => f.destinationIata === originIata);
            // offpath: always take the cheapest return even if it goes over budget
            const returnFlight = tripStyle === 'offpath'
              ? returnFlights[0]
              : returnFlights.find((f) => f.priceUsd <= state.remainingBudget);
            if (returnFlight) {
              return {
                ...state,
                legs: [...state.legs, { ...returnFlight, isReturn: true }],
                remainingBudget: state.remainingBudget - returnFlight.priceUsd,
              };
            }
          } catch {
            // no return found — still return outbound legs
          }
          return state;
        }),
      );
    }

    // Pick winner: most legs first, then most remaining budget as tiebreaker
    finalBeam.sort((a, b) => b.legs.length - a.legs.length || b.remainingBudget - a.remainingBudget);
    const winner = finalBeam[0];

    const totalCostPerPerson = budgetPerPerson - winner.remainingBudget;

    return ok({ legs: winner.legs, totalCostPerPerson, budgetPerPerson });
  });
};
