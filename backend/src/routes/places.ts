import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config';
import { ok, fail } from '../utils/response';
import { increment } from '../utils/apiMetrics';
import { fetchWithTimeout } from '../utils/http';
import { PRICE_LEVEL_LABEL } from '../utils/priceLevel';

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
  userRatingCount?: number;
  location?: { latitude: number; longitude: number };
}

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

      increment('google-places');
      const res = await fetchWithTimeout('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': config.GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask':
            'places.displayName,places.rating,places.priceLevel,places.primaryTypeDisplayName,places.userRatingCount,places.location',
        },
        body: JSON.stringify({
          textQuery: query,
          includedType: 'restaurant',
          maxResultCount: 10,
          languageCode: 'en',
        }),
      });

      if (!res.ok) {
        app.log.error({ status: res.status }, 'Google Places API error');
        return reply.status(502).send(fail('PLACES_API_ERROR', 'Could not fetch restaurants'));
      }

      const json = (await res.json()) as { places?: GooglePlace[] };
      const places = json.places ?? [];

      const restaurants = places.map((p) => ({
        name: p.displayName?.text ?? 'Unknown',
        mealType: p.primaryTypeDisplayName?.text ?? 'Restaurant',
        description:
          [
            p.rating ? `Rated ${p.rating}/5` : null,
            p.priceLevel ? PRICE_LEVEL_LABEL[p.priceLevel] : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'Local favourite',
        rating: p.rating,
        reviewCount: p.userRatingCount ?? null,
        priceLevel: p.priceLevel ? PRICE_LEVEL_LABEL[p.priceLevel] : undefined,
        lat: p.location?.latitude ?? null,
        lng: p.location?.longitude ?? null,
      }));

      return ok(restaurants);
    } catch (err) {
      app.log.error(err, 'Places fetch failed');
      return reply.status(502).send(fail('PLACES_FETCH_FAILED', 'Restaurant data unavailable', true));
    }
  });
}
