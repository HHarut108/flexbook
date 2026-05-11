import NodeCache from 'node-cache';
import crypto from 'crypto';
import { Itinerary } from '@fast-travel/shared';
import { redis, recordRedisOk, recordRedisError } from './redisClient';

const TTL_SECONDS = 2592000; // 30 days

const localCache = new NodeCache({ stdTTL: TTL_SECONDS });

function redisKey(slug: string): string {
  return `trip:${slug}`;
}

export const tripCache = {
  async set(slug: string, itinerary: Itinerary): Promise<void> {
    if (redis) {
      try {
        await redis.set(redisKey(slug), JSON.stringify(itinerary), { ex: TTL_SECONDS });
        recordRedisOk();
        return;
      } catch (err) {
        recordRedisError(err);
      }
    }
    localCache.set(slug, itinerary);
  },

  async get(slug: string): Promise<Itinerary | null> {
    if (redis) {
      try {
        const raw = await redis.get<string>(redisKey(slug));
        recordRedisOk();
        if (!raw) return localCache.get<Itinerary>(slug) ?? null;
        return typeof raw === 'string' ? JSON.parse(raw) : (raw as Itinerary);
      } catch (err) {
        recordRedisError(err);
      }
    }
    return localCache.get<Itinerary>(slug) ?? null;
  },
};

export function generateTripSlug(itinerary: Itinerary): string {
  const origin = itinerary.origin.iata.toLowerCase();
  const outboundLegs = itinerary.legs.filter((l) => !l.isReturn);
  const dests = outboundLegs.map((l) => l.destinationIata.toLowerCase()).join('-');
  const firstLeg = itinerary.legs[0];
  const date = firstLeg
    ? new Date(firstLeg.departureDatetime)
        .toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        .toLowerCase()
        .replace(' ', '')
        .replace(',', '')
    : '';
  const suffix = crypto.randomBytes(3).toString('base64url').slice(0, 4);
  return [origin, dests, date, suffix].filter(Boolean).join('-');
}
