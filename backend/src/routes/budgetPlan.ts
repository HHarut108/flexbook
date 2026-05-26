import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { FlightOption } from '@fast-travel/shared';
import { flightService } from '../services/FlightService';
import { airportService } from '../services/AirportService';
import { requireAuth } from '../utils/requireAuth';
import { ok, fail } from '../utils/response';

const MAX_STOPS = 3;
const STAY_DAYS = 3;
// Fraction of remaining budget reserved for the return leg before committing to each hop.
const RETURN_RESERVE_RATIO = 0.35;
// Minimum price buffer to bother searching another hop.
const MIN_HOP_BUDGET = 50;

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const bodySchema = z.object({
  originIata: z.string().length(3).toUpperCase(),
  departureDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departureDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  budgetPerPerson: z.number().int().min(100).max(100_000),
  passengers: z.coerce.number().int().min(1).max(9).default(1),
});

export const budgetPlanRoutes: FastifyPluginAsync = async (app) => {
  app.post('/trips/budget-plan', { preHandler: [requireAuth] }, async (req, reply) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send(fail('INVALID_PARAMS', parsed.error.issues[0]?.message ?? 'Invalid params'));
    }

    const { originIata, departureDateFrom, departureDateTo, budgetPerPerson, passengers } = parsed.data;

    const legs: (FlightOption & { isReturn?: boolean })[] = [];
    let remainingBudget = budgetPerPerson;
    let currentOriginIata = originIata;
    let currentDate = departureDateFrom;
    const visited = new Set<string>([originIata]);

    // ── Outbound hops ─────────────────────────────────────────────────────────
    for (let i = 0; i < MAX_STOPS; i++) {
      const returnReserve = remainingBudget * RETURN_RESERVE_RATIO;
      const availableForHop = remainingBudget - returnReserve;

      if (availableForHop < MIN_HOP_BUDGET) break;
      if (currentDate > departureDateTo) break;

      const originCity = airportService.getByIata(currentOriginIata)?.city.name ?? currentOriginIata;

      let flights: FlightOption[];
      try {
        const result = await flightService.search(
          currentOriginIata, originCity, currentDate,
          undefined, // anywhere
          true,      // deduplicate
          { sort: 'price', passengers },
        );
        flights = result.flights;
      } catch {
        break;
      }

      const candidate = flights.find(
        (f) => f.priceUsd <= availableForHop && !visited.has(f.destinationIata),
      );
      if (!candidate) break;

      legs.push(candidate);
      remainingBudget -= candidate.priceUsd;
      visited.add(candidate.destinationIata);
      currentOriginIata = candidate.destinationIata;

      // Advance date past arrival + minimum stay
      const arrivalDate = candidate.arrivalDatetime.slice(0, 10);
      currentDate = addDays(arrivalDate, STAY_DAYS);
    }

    if (legs.length === 0) {
      return reply.status(422).send(fail('NO_TRIPS_FOUND', 'No flights found within your budget. Try a higher budget or wider date range.'));
    }

    // ── Return leg ────────────────────────────────────────────────────────────
    if (currentOriginIata !== originIata) {
      const returnOriginCity = airportService.getByIata(currentOriginIata)?.city.name ?? currentOriginIata;

      let returnFlights: FlightOption[] = [];
      try {
        const result = await flightService.search(
          currentOriginIata, returnOriginCity, currentDate,
          originIata, // back home
          true,
          { sort: 'price', passengers },
        );
        // The provider may return multi-destination results; keep only flights home.
        returnFlights = result.flights.filter((f) => f.destinationIata === originIata);
        // If provider deduplication removed the home airport, fall back to cheapest overall.
        if (returnFlights.length === 0) returnFlights = result.flights;
      } catch {
        // no return found — still return outbound legs
      }

      const returnFlight = returnFlights.find((f) => f.priceUsd <= remainingBudget);
      if (returnFlight) {
        legs.push({ ...returnFlight, isReturn: true });
        remainingBudget -= returnFlight.priceUsd;
      }
    }

    const totalCostPerPerson = budgetPerPerson - remainingBudget;

    return ok({ legs, totalCostPerPerson, budgetPerPerson });
  });
};
