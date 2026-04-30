import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config';
import { ok, fail } from '../utils/response';

const querySchema = z.object({
  city: z.string().min(1).max(100),
  country: z.string().min(1).max(100).optional(),
});

interface GooglePlace {
  displayName?: { text: string };
  rating?: number;
  priceLevel?: string;
  primaryTypeDisplayName?: { text: string };
  formattedAddress?: string;
  editorialSummary?: { text: string };
}

const PRICE_MAP: Record<string, string> = {
  PRICE_LEVEL_FREE: 'Free',
  PRICE_LEVEL_INEXPENSIVE: '€',
  PRICE_LEVEL_MODERATE: '€€',
  PRICE_LEVEL_EXPENSIVE: '€€€',
  PRICE_LEVEL_VERY_EXPENSIVE: '€€€€',
};

export async function placesRoutes(app: FastifyInstance) {
  app.get('/restaurants', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(fail('INVALID_PARAMS', parsed.error.issues[0]?.message ?? 'Invalid query'));
    }

    const { city, country } = parsed.data;

    if (!config.GOOGLE_PLACES_API_KEY) {
      return reply.status(503).send(fail('NO_API_KEY', 'Google Places not configured'));
    }

    try {
      const query = country ? `restaurants in ${city}, ${country}` : `restaurants in ${city}`;

      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': config.GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask':
            'places.displayName,places.rating,places.priceLevel,places.primaryTypeDisplayName,places.editorialSummary',
        },
        body: JSON.stringify({
          textQuery: query,
          includedType: 'restaurant',
          maxResultCount: 10,
          languageCode: 'en',
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        app.log.error({ status: res.status, err }, 'Google Places API error');
        return reply.status(502).send(fail('PLACES_API_ERROR', 'Could not fetch restaurants'));
      }

      const json = (await res.json()) as { places?: GooglePlace[] };
      const places = json.places ?? [];

      const restaurants = places.map((p) => ({
        name: p.displayName?.text ?? 'Unknown',
        mealType: p.primaryTypeDisplayName?.text ?? 'Restaurant',
        description:
          (p.editorialSummary?.text ??
          [
            p.rating ? `Rated ${p.rating}/5` : null,
            p.priceLevel ? PRICE_MAP[p.priceLevel] : null,
          ]
            .filter(Boolean)
            .join(' · ')) ||
          'Local favourite',
        rating: p.rating,
        priceLevel: p.priceLevel ? PRICE_MAP[p.priceLevel] : undefined,
      }));

      return ok(restaurants);
    } catch (err) {
      app.log.error(err, 'Places fetch failed');
      return reply.status(502).send(fail('PLACES_FETCH_FAILED', 'Restaurant data unavailable', true));
    }
  });
}
