import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { flightService } from '../services/FlightService';
import { ok, fail } from '../utils/response';
import {
  RapidApiRateLimitError,
  RapidApiAuthError,
  RapidApiUnavailableError,
} from '../providers/RapidApiKiwiFlightProvider';

/**
 * GET /flights/cheapest-day
 *
 * "When To Go" — given (origin, destination, start, end), returns the cheapest
 * single day in that window plus the per-day price list for any UI that wants
 * to render a sparkline or adjacent-window hints later.
 *
 * The route is intentionally separate from /flights/search because:
 *   1. It serves a different question ("when?" vs. "what?").
 *   2. The cache table (PriceCalendarDay) is keyed differently, with its own
 *      7-day TTL — collapsing the two would muddy both contracts.
 *   3. It only needs a single provider call regardless of window length, so
 *      the latency profile is different and we don't want it sharing the
 *      schedule-cache + price-info indirection that /flights/search uses.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_WINDOW_DAYS = 180;

const querySchema = z
  .object({
    origin: z.string().length(3).toUpperCase(),
    destination: z.string().length(3).toUpperCase(),
    start: z.string().regex(ISO_DATE, 'start must be YYYY-MM-DD'),
    end: z.string().regex(ISO_DATE, 'end must be YYYY-MM-DD'),
  })
  .refine((v) => v.origin !== v.destination, {
    message: 'origin and destination must differ',
    path: ['destination'],
  })
  .refine((v) => v.start <= v.end, {
    message: 'start must be <= end',
    path: ['start'],
  })
  .refine(
    (v) => {
      const days = Math.round(
        (new Date(v.end + 'T00:00:00Z').getTime() -
          new Date(v.start + 'T00:00:00Z').getTime()) /
          86400000,
      ) + 1;
      return days <= MAX_WINDOW_DAYS;
    },
    { message: `window cannot exceed ${MAX_WINDOW_DAYS} days`, path: ['end'] },
  );

export async function cheapestDayRoutes(app: FastifyInstance) {
  app.get('/flights/cheapest-day', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply
        .status(400)
        .send(fail('INVALID_PARAMS', parsed.error.issues[0]?.message ?? 'Invalid params'));
    }

    const { origin, destination, start, end } = parsed.data;

    try {
      const result = await flightService.priceCalendar(origin, destination, start, end);
      return ok(result);
    } catch (err) {
      if (err instanceof RapidApiRateLimitError) {
        return reply
          .status(429)
          .headers({ 'Retry-After': '60' })
          .send(
            fail(
              'RATE_LIMITED',
              'Too many requests to the flight API. Please wait a moment and try again.',
              true,
            ),
          );
      }
      if (err instanceof RapidApiAuthError) {
        app.log.error(err, 'RapidAPI auth failure on /flights/cheapest-day');
        return reply
          .status(503)
          .send(
            fail(
              'FLIGHT_API_AUTH_ERROR',
              'Calendar search is temporarily unavailable. Please try again shortly.',
              true,
            ),
          );
      }
      if (err instanceof RapidApiUnavailableError) {
        app.log.warn(err, 'RapidAPI temporarily unavailable on /flights/cheapest-day');
        return reply
          .status(503)
          .send(
            fail(
              'FLIGHT_API_UNAVAILABLE',
              'Calendar search is temporarily unavailable. Please try again shortly.',
              true,
            ),
          );
      }
      app.log.error(err, 'cheapest-day search failed');
      return reply
        .status(502)
        .send(
          fail(
            'FLIGHT_API_UNAVAILABLE',
            'Could not fetch the price calendar. Please try again.',
            true,
          ),
        );
    }
  });
}
