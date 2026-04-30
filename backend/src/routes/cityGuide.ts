import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config';
import { ok, fail } from '../utils/response';

const querySchema = z.object({
  city: z.string().min(1).max(100),
  country: z.string().min(1).max(100).optional(),
});

const PRICE_MAP: Record<string, string> = {
  PRICE_LEVEL_FREE: 'free',
  PRICE_LEVEL_INEXPENSIVE: '€',
  PRICE_LEVEL_MODERATE: '€€',
  PRICE_LEVEL_EXPENSIVE: '€€€',
  PRICE_LEVEL_VERY_EXPENSIVE: '€€€€',
};

const ICON_BY_TYPE: [string, string][] = [
  ['museum', 'Building2'],
  ['church', 'Building2'],
  ['cathedral', 'Building2'],
  ['castle', 'Building2'],
  ['palace', 'Building2'],
  ['monument', 'Building2'],
  ['landmark', 'Building2'],
  ['historical', 'Building2'],
  ['beach', 'Waves'],
  ['lake', 'Waves'],
  ['river', 'Waves'],
  ['aquarium', 'Waves'],
  ['park', 'Mountain'],
  ['garden', 'Mountain'],
  ['mountain', 'Mountain'],
  ['hiking', 'Mountain'],
  ['gallery', 'Camera'],
  ['art', 'Camera'],
  ['viewpoint', 'Camera'],
];

function pickIcon(primaryType?: string): string {
  if (!primaryType) return 'Compass';
  const lower = primaryType.toLowerCase();
  for (const [key, icon] of ICON_BY_TYPE) {
    if (lower.includes(key)) return icon;
  }
  return 'Compass';
}

interface GooglePlace {
  displayName?: { text: string };
  rating?: number;
  priceLevel?: string;
  primaryType?: string;
  primaryTypeDisplayName?: { text: string };
  editorialSummary?: { text: string };
  formattedAddress?: string;
  userRatingCount?: number;
}

async function searchPlaces(
  textQuery: string,
  includedType: string,
  fieldMask: string,
  apiKey: string,
  maxResultCount: number,
): Promise<GooglePlace[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify({ textQuery, includedType, maxResultCount, languageCode: 'en' }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Places API ${res.status}: ${err}`);
  }
  const json = (await res.json()) as { places?: GooglePlace[] };
  return json.places ?? [];
}

const MEAL_TYPES = ['Lunch', 'Dinner', 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Coffee', 'Dinner'];

export async function cityGuideRoutes(app: FastifyInstance) {
  app.get('/city-guide', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(
        fail('INVALID_PARAMS', parsed.error.issues[0]?.message ?? 'Invalid query'),
      );
    }

    if (!config.GOOGLE_PLACES_API_KEY) {
      return reply.status(503).send(fail('NO_API_KEY', 'Google Places not configured'));
    }

    const { city, country } = parsed.data;
    const location = country ? `${city}, ${country}` : city;

    const detailFields =
      'places.displayName,places.rating,places.priceLevel,places.primaryType,places.editorialSummary,places.formattedAddress,places.userRatingCount';
    const restaurantFields =
      'places.displayName,places.rating,places.priceLevel,places.primaryTypeDisplayName,places.editorialSummary';

    try {
      const [hotelPlaces, attractionPlaces, restaurantPlaces] = await Promise.all([
        searchPlaces(`hotels in ${location}`, 'lodging', detailFields, config.GOOGLE_PLACES_API_KEY, 4),
        searchPlaces(
          `tourist attractions sightseeing in ${location}`,
          'tourist_attraction',
          detailFields,
          config.GOOGLE_PLACES_API_KEY,
          6,
        ),
        searchPlaces(
          `restaurants in ${location}`,
          'restaurant',
          restaurantFields,
          config.GOOGLE_PLACES_API_KEY,
          8,
        ),
      ]);

      const hotels = hotelPlaces.slice(0, 3).map((p) => {
        const addressParts = (p.formattedAddress ?? '').split(',');
        const neighborhood = addressParts[1]?.trim() ?? city;
        return {
          name: p.displayName?.text ?? 'Hotel',
          neighborhood,
          pricePerNight: null as number | null,
          why:
            p.editorialSummary?.text ??
            (p.rating ? `Rated ${p.rating.toFixed(1)}/5 by guests.` : 'Well-reviewed hotel in the city.'),
          bookingUrl: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(p.displayName?.text ?? city)}`,
        };
      });

      const activities = attractionPlaces.slice(0, 5).map((p, i) => ({
        name: p.displayName?.text ?? 'Attraction',
        duration: '1–2 hours',
        cost: (p.priceLevel ? PRICE_MAP[p.priceLevel] : 'free') as 'free' | '€' | '€€' | '€€€',
        note: p.editorialSummary?.text ?? undefined,
        dontSkip: i < 2,
        icon: pickIcon(p.primaryType),
      }));

      const restaurants = restaurantPlaces.slice(0, 6).map((p, i) => ({
        name: p.displayName?.text ?? 'Restaurant',
        mealType: MEAL_TYPES[i] ?? 'Dinner',
        description:
          (p.editorialSummary?.text ??
            [
              p.rating ? `Rated ${p.rating.toFixed(1)}/5` : null,
              p.priceLevel ? PRICE_MAP[p.priceLevel] : null,
            ]
              .filter(Boolean)
              .join(' · ')) || 'Local favourite',
        rating: p.rating,
        priceLevel: p.priceLevel ? PRICE_MAP[p.priceLevel] : undefined,
      }));

      const topActs = activities.slice(0, 6);
      const days = [];
      if (topActs.length > 0) {
        days.push({
          title: `${city} Highlights`,
          slots: [
            { time: 'Morning', activity: topActs[0]?.name ?? 'Explore the city centre' },
            { time: 'Afternoon', activity: topActs[1]?.name ?? 'Visit a local landmark' },
            {
              time: 'Evening',
              activity: `Dinner at ${restaurants[1]?.name ?? 'a local restaurant'}`,
            },
          ],
        });
      }
      if (topActs.length > 2) {
        days.push({
          title: 'More to Explore',
          slots: [
            { time: 'Morning', activity: topActs[2]?.name ?? 'Morning walk' },
            { time: 'Afternoon', activity: topActs[3]?.name ?? 'Afternoon exploration' },
            {
              time: 'Evening',
              activity: `Dinner at ${restaurants[3]?.name ?? 'a local restaurant'}`,
            },
          ],
        });
      }

      const practical = {
        currency: country ?? city,
        sim: 'Buy an eSIM before you travel (Airalo, Holafly) or pick up a local SIM on arrival.',
        transport: 'Use Bolt or Uber for taxis. Check Google Maps for public transit routes and schedules.',
      };

      return ok({ hotels, activities, restaurants, days, practical });
    } catch (err) {
      app.log.error(err, 'City guide fetch failed');
      return reply.status(502).send(fail('CITY_GUIDE_FAILED', 'Could not load city guide', true));
    }
  });
}
