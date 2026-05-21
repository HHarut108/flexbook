import { Router } from 'express';
import { getDataSource } from '../services/visaDataSource';

export const healthRouter = Router();

const startedAt = new Date().toISOString();

healthRouter.get('/health', (_req, res) => {
  const source = getDataSource();
  const lastLoaded = source.lastUpdated();
  const hasData = source.listCountries().length > 0;
  res.status(hasData ? 200 : 503).json({
    status: hasData ? 'ok' : 'unavailable',
    started_at: startedAt,
    last_updated: lastLoaded,
    countries: source.listCountries().length,
  });
});
