import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // 5-minute TTL

export function getCache<T>(key: string): T | undefined {
  return cache.get<T>(key);
}

export function setCache<T>(key: string, value: T, ttl?: number): void {
  cache.set(key, value, ttl ?? 300);
}

export function deleteCache(key: string): void {
  cache.del(key);
}
