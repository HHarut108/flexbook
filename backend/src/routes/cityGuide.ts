import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config';
import { ok, fail } from '../utils/response';
import { increment } from '../utils/apiMetrics';

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
  formattedAddress?: string;
  userRatingCount?: number;
  location?: { latitude: number; longitude: number };
}

interface PlaceItem {
  name: string;
  type: string;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

interface LocationBias {
  circle: {
    center: { latitude: number; longitude: number };
    radius: number;
  };
}

async function geocodeCity(
  city: string,
  country: string | undefined,
  apiKey: string,
): Promise<{ lat: number; lon: number } | null> {
  try {
    const q = country ? `${city},${country}` : city;
    const res = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=1&appid=${apiKey}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: number; lon: number }>;
    return data[0] ?? null;
  } catch {
    return null;
  }
}

async function searchPlaces(
  textQuery: string,
  includedType: string,
  fieldMask: string,
  apiKey: string,
  maxResultCount: number,
  locationBias?: LocationBias,
): Promise<GooglePlace[]> {
  increment('google-places');
  const body: Record<string, unknown> = {
    textQuery,
    includedType,
    maxResultCount,
    languageCode: 'en',
  };
  if (locationBias) body.locationBias = locationBias;

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Places API ${res.status}: ${err}`);
  }
  const json = (await res.json()) as { places?: GooglePlace[] };
  return json.places ?? [];
}

function toPlaceItem(p: GooglePlace): PlaceItem {
  return {
    name: p.displayName?.text ?? 'Place',
    type: p.primaryTypeDisplayName?.text ?? '',
    rating: p.rating ?? null,
    reviewCount: p.userRatingCount ?? null,
    priceLevel: p.priceLevel ? (PRICE_MAP[p.priceLevel] ?? null) : null,
    address: p.formattedAddress ?? null,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
  };
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

    let targetNights = nightsParam ?? 2;
    if (checkin && checkout && !nightsParam) {
      const diff = Math.round(
        (new Date(checkout).getTime() - new Date(checkin).getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diff > 0) targetNights = Math.min(diff, 14);
    }

    // Field masks — editorialSummary removed (drops from Atmosphere to Enterprise tier)
    const detailFields =
      'places.displayName,places.rating,places.priceLevel,places.primaryType,places.formattedAddress,places.userRatingCount,places.location';
    const restaurantFields =
      'places.displayName,places.rating,places.priceLevel,places.primaryTypeDisplayName,places.userRatingCount,places.location';
    const categoryFields =
      'places.displayName,places.rating,places.priceLevel,places.primaryTypeDisplayName,places.formattedAddress,places.userRatingCount,places.location';

    const activityFetchCount = Math.min(targetNights * 2 + 4, 20);

    try {
      // Geocode the city to get coordinates for locationBias (uses OWM free geocoding API)
      const coords = config.OPENWEATHER_API_KEY
        ? await geocodeCity(city, country, config.OPENWEATHER_API_KEY)
        : null;

      const locationBias: LocationBias | undefined = coords
        ? { circle: { center: { latitude: coords.lat, longitude: coords.lon }, radius: 20000 } }
        : undefined;

      const key = config.GOOGLE_PLACES_API_KEY;

      const [
        hotelPlaces,
        attractionPlaces,
        restaurantPlaces,
        culturePlaces,
        naturePlaces,
        nightlifePlaces,
        wellnessPlaces,
        budgetLodgingPlaces,
      ] = await Promise.all([
        searchPlaces(`hotels in ${location}`, 'lodging', detailFields, key, 4, locationBias),
        searchPlaces(
          `tourist attractions sightseeing in ${location}`,
          'tourist_attraction',
          detailFields,
          key,
          activityFetchCount,
          locationBias,
        ),
        searchPlaces(
          `restaurants in ${location}`,
          'restaurant',
          restaurantFields,
          key,
          Math.min(targetNights + 4, 12),
          locationBias,
        ),
        searchPlaces(
          `museums art galleries cultural sites in ${location}`,
          'museum',
          categoryFields,
          key,
          6,
          locationBias,
        ),
        searchPlaces(
          `parks nature outdoor activities in ${location}`,
          'park',
          categoryFields,
          key,
          6,
          locationBias,
        ),
        searchPlaces(
          `bars nightlife clubs entertainment in ${location}`,
          'bar',
          categoryFields,
          key,
          6,
          locationBias,
        ),
        searchPlaces(
          `spas wellness centers massage in ${location}`,
          'spa',
          categoryFields,
          key,
          5,
          locationBias,
        ),
        searchPlaces(
          `hostels budget accommodation guesthouses in ${location}`,
          'hostel',
          categoryFields,
          key,
          5,
          locationBias,
        ),
      ]);

      const PRICE_LEVEL_ORDER: Record<string, number> = {
        PRICE_LEVEL_INEXPENSIVE: 1,
        PRICE_LEVEL_MODERATE: 2,
        PRICE_LEVEL_EXPENSIVE: 3,
        PRICE_LEVEL_VERY_EXPENSIVE: 4,
      };

      const hotels = hotelPlaces
        .slice(0, 6)
        .map((p) => {
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
            priceLevel: p.priceLevel ? (PRICE_MAP[p.priceLevel] ?? null) : null,
            priceLevelOrder: p.priceLevel ? (PRICE_LEVEL_ORDER[p.priceLevel] ?? 99) : 99,
            why: p.rating ? `Rated ${p.rating.toFixed(1)}/5 by guests.` : 'Well-reviewed hotel in the city.',
            bookingUrl: `https://www.booking.com/searchresults.html?${bookingParams.toString()}`,
            rating: p.rating ?? null,
            reviewCount: p.userRatingCount ?? null,
          };
        })
        .sort((a, b) => a.priceLevelOrder - b.priceLevelOrder)
        .slice(0, 3)
        .map(({ priceLevelOrder: _o, ...rest }) => rest);

      const activities = attractionPlaces.map((p, i) => ({
        name: p.displayName?.text ?? 'Attraction',
        duration: '1–2 hours',
        cost: (p.priceLevel ? PRICE_MAP[p.priceLevel] : 'free') as 'free' | '€' | '€€' | '€€€',
        note: undefined,
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
          [
            p.rating ? `Rated ${p.rating.toFixed(1)}/5` : null,
            p.priceLevel ? PRICE_MAP[p.priceLevel] : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'Local favourite',
        rating: p.rating,
        priceLevel: p.priceLevel ? PRICE_MAP[p.priceLevel] : undefined,
      }));

      const doCategories = {
        culture: culturePlaces.map(toPlaceItem),
        natureOutdoors: naturePlaces.map(toPlaceItem),
        cuisineRestaurants: restaurantPlaces.map(toPlaceItem),
        nightlife: nightlifePlaces.map(toPlaceItem),
        wellness: wellnessPlaces.map(toPlaceItem),
        budgetLodging: budgetLodgingPlaces.map(toPlaceItem),
      };

      const dayTitles = [`${city} Highlights`, 'More to Explore'];
      const days = [];
      for (let i = 0; i < targetNights; i++) {
        const morning = activities[i * 2];
        const afternoon = activities[i * 2 + 1];
        if (!morning) break;
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

      return ok({ hotels, activities, restaurants, days, practical, doCategories });
    } catch (err) {
      app.log.error(err, 'City guide fetch failed');
      return reply.status(502).send(fail('CITY_GUIDE_FAILED', 'Could not load city guide', true));
    }
  });
}
