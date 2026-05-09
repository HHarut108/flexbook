import NodeCache from 'node-cache';
import crypto from 'crypto';
import { Redis } from '@upstash/redis';
import { Itinerary } from '@fast-travel/shared';
import { config } from '../config';

const TTL_SECONDS = 2592000; // 30 days

let redis: Redis | null = null;
if (config.UPSTASH_REDIS_REST_URL && config.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: config.UPSTASH_REDIS_REST_URL,
    token: config.UPSTASH_REDIS_REST_TOKEN,
  });
}

const localCache = new NodeCache({ stdTTL: TTL_SECONDS });

function redisKey(slug: string): string {
  return `trip:${slug}`;
}

export const tripCache = {
  set(slug: string, itinerary: Itinerary): void {
    if (redis) {
      redis.set(redisKey(slug), JSON.stringify(itinerary), { ex: TTL_SECONDS }).catch(() => {
        localCache.set(slug, itinerary);
      });
    } else {
      localCache.set(slug, itinerary);
    }
  },

  async get(slug: string): Promise<Itinerary | null> {
    if (redis) {
      try {
        const raw = await redis.get<string>(redisKey(slug));
        if (!raw) return null;
        return typeof raw === 'string' ? JSON.parse(raw) : (raw as Itinerary);
      } catch {
        return localCache.get<Itinerary>(slug) ?? null;
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
