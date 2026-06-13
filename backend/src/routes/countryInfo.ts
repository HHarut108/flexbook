import { FastifyInstance } from 'fastify';
import { getCache, setCache } from '../utils/cache';
import { fetchWithTimeout } from '../utils/http';
import { setCacheControl, CACHE_CONTROL } from '../utils/httpCache';

const TTL = 24 * 60 * 60; // 24 hours

interface CountryInfo {
  flag: string;
  flagUrl: string;
  currencyCode: string;
  currencyName: string;
  currencySymbol: string;
  capital: string;
  region: string;
}

export async function countryInfoRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { country?: string } }>('/country-info', async (request, reply) => {
    const { country } = request.query;
    if (!country) {
      return reply.status(400).send({ error: 'country query param required' });
    }

    const cacheKey = `country:${country.toLowerCase()}`;
    const cached = getCache<CountryInfo>(cacheKey);
    if (cached) {
      setCacheControl(reply, CACHE_CONTROL.COUNTRY_INFO);
      return reply.send(cached);
    }

    try {
      const res = await fetchWithTimeout(
        `https://restcountries.com/v3.1/name/${encodeURIComponent(country)}?fullText=true&fields=flag,flags,currencies,capital,region`,
        {},
        8000,
      );
      if (!res.ok) {
        return reply.status(404).send({ error: 'Country not found' });
      }
      const [c] = await res.json() as [Record<string, unknown>];
      const currencies = c.currencies as Record<string, { name: string; symbol: string }>;
      const [currencyCode, currencyData] = Object.entries(currencies)[0];
      const flags = c.flags as { png?: string } | undefined;
      const capital = c.capital as string[] | undefined;

      const info: CountryInfo = {
        flag: c.flag as string,
        flagUrl: flags?.png ?? '',
        currencyCode,
        currencyName: currencyData.name,
        currencySymbol: currencyData.symbol,
        capital: capital?.[0] ?? '',
        region: (c.region as string) ?? '',
      };

      setCache(cacheKey, info, TTL);
      setCacheControl(reply, CACHE_CONTROL.COUNTRY_INFO);
      return reply.send(info);
    } catch {
      return reply.status(502).send({ error: 'Failed to fetch country data' });
    }
  });
}
