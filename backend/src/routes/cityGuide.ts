import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config';
import { ok, fail } from '../utils/response';

const querySchema = z.object({
  city: z.string().min(1).max(100),
  country: z.string().min(1).max(100).optional(),
  checkin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkout: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  passengers: z.coerce.number().int().min(1).max(9).default(1),
  nights: z.coerce.number().int().min(1).max(14).optional(),
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

    const { city, country, checkin, checkout, passengers, nights: nightsParam } = parsed.data;
    const location = country ? `${city}, ${country}` : city;

    // Determine trip length so we can generate enough days
    let targetNights = nightsParam ?? 2;
    if (checkin && checkout && !nightsParam) {
      const diff = Math.round(
        (new Date(checkout).getTime() - new Date(checkin).getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diff > 0) targetNights = Math.min(diff, 14);
    }

    const detailFields =
      'places.displayName,places.rating,places.priceLevel,places.primaryType,places.editorialSummary,places.formattedAddress,places.userRatingCount';
    const restaurantFields =
      'places.displayName,places.rating,places.priceLevel,places.primaryTypeDisplayName,places.editorialSummary';

    // Need 2 activities per day + a few extras for variety
    const activityFetchCount = Math.min(targetNights * 2 + 4, 20);

    try {
      const [hotelPlaces, attractionPlaces, restaurantPlaces] = await Promise.all([
        searchPlaces(`hotels in ${location}`, 'lodging', detailFields, config.GOOGLE_PLACES_API_KEY, 4),
        searchPlaces(
          `tourist attractions sightseeing in ${location}`,
          'tourist_attraction',
          detailFields,
          config.GOOGLE_PLACES_API_KEY,
          activityFetchCount,
        ),
        searchPlaces(
          `restaurants in ${location}`,
          'restaurant',
          restaurantFields,
          config.GOOGLE_PLACES_API_KEY,
          Math.min(targetNights + 4, 12),
        ),
      ]);

      const hotels = hotelPlaces.slice(0, 3).map((p) => {
        const addressParts = (p.formattedAddress ?? '').split(',');
        const neighborhood = addressParts[1]?.trim() ?? city;

        const bookingParams = new URLSearchParams({
          ss: p.displayName?.text ?? city,
          group_adults: String(passengers),
          no_rooms: '1',
          lang: 'en-gb',
        });
        if (checkin) bookingParams.set('checkin', checkin);
        if (checkout) bookingParams.set('checkout', checkout);

        return {
          name: p.displayName?.text ?? 'Hotel',
          neighborhood,
          pricePerNight: null as number | null,
          rating: p.rating ?? null,
          reviewCount: p.userRatingCount ?? null,
          why:
            p.editorialSummary?.text ??
            (p.rating ? `Rated ${p.rating.toFixed(1)}/5 by guests.` : 'Well-reviewed hotel in the city.'),
          bookingUrl: `https://www.booking.com/searchresults.html?${bookingParams.toString()}`,
        };
      });

      const activities = attractionPlaces.map((p, i) => ({
        name: p.displayName?.text ?? 'Attraction',
        duration: '1–2 hours',
        cost: (p.priceLevel ? PRICE_MAP[p.priceLevel] : 'free') as 'free' | '€' | '€€' | '€€€',
        note: p.editorialSummary?.text ?? undefined,
        rating: p.rating ?? null,
        reviewCount: p.userRatingCount ?? null,
        address: p.formattedAddress ?? null,
        dontSkip: i < 2,
        icon: pickIcon(p.primaryType),
      }));

      const restaurants = restaurantPlaces.map((p, i) => ({
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

      const dayTitles = [`${city} Highlights`, 'More to Explore'];
      const days = [];
      for (let i = 0; i < targetNights; i++) {
        const morning = activities[i * 2];
        const afternoon = activities[i * 2 + 1];
        if (!morning) break; // Not enough attractions to fill this day
        days.push({
          title: dayTitles[i] ?? `Day ${i + 1}`,
          slots: [
            { time: 'Morning', activity: morning.name },
            { time: 'Afternoon', activity: afternoon?.name ?? 'Explore the neighbourhood' },
            {
              time: 'Evening',
              activity: `Dinner at ${restaurants[i]?.name ?? restaurants[0]?.name ?? 'a local restaurant'}`,
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
