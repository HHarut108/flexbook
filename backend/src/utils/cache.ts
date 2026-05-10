import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // 5-minute TTL

interface NamespaceStat {
  hits: number;
  misses: number;
  sets: number;
}

const namespaceCounts = new Map<string, NamespaceStat>();

function extractNamespace(key: string): string {
  if (key.startsWith('flights:schedule:')) return 'flights:schedule';
  if (key.startsWith('flights:price:')) return 'flights:price';
  if (key.startsWith('weather:')) return 'weather';
  if (key.startsWith('trip:')) return 'trip';
  return key.split(':')[0] ?? key;
}

function bump(key: string, field: keyof NamespaceStat): void {
  const ns = extractNamespace(key);
  const stat = namespaceCounts.get(ns) ?? { hits: 0, misses: 0, sets: 0 };
  stat[field]++;
  namespaceCounts.set(ns, stat);
}

export function getCache<T>(key: string): T | undefined {
  const result = cache.get<T>(key);
  bump(key, result !== undefined ? 'hits' : 'misses');
  return result;
}

export function setCache<T>(key: string, value: T, ttl?: number): void {
  cache.set(key, value, ttl ?? 300);
  bump(key, 'sets');
}

export function deleteCache(key: string): void {
  cache.del(key);
}

export interface CacheNamespaceStat {
  hits: number;
  misses: number;
  sets: number;
  hitRate: number;
}

export function getCacheStats(): {
  namespaces: Record<string, CacheNamespaceStat>;
  totalKeys: number;
} {
  const namespaces: Record<string, CacheNamespaceStat> = {};
  for (const [ns, stat] of namespaceCounts) {
    const total = stat.hits + stat.misses;
    namespaces[ns] = {
      hits: stat.hits,
      misses: stat.misses,
      sets: stat.sets,
      hitRate: total > 0 ? stat.hits / total : 0,
    };
  }
  return { namespaces, totalKeys: cache.keys().length };
}
