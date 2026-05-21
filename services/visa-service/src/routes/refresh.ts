import { Router } from 'express';
import { config, isProduction } from '../config';
import { getDataSource } from '../services/visaDataSource';

export const refreshRouter = Router();

refreshRouter.post('/refresh', async (req, res) => {
  if (isProduction && !config.REFRESH_TOKEN) {
    return res.status(503).json({
      error: 'REFRESH_TOKEN is not configured on this server; refresh is disabled.',
    });
  }

  if (config.REFRESH_TOKEN) {
    const header = req.header('authorization') ?? '';
    const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (provided !== config.REFRESH_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const source = getDataSource();
  try {
    await source.refresh();
    return res.json({
      ok: true,
      last_updated: source.lastUpdated(),
      countries: source.listCountries().length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(502).json({ error: `Refresh failed: ${message}` });
  }
});

refreshRouter.get('/refresh', (_req, res) => {
  res.status(405).json({ error: 'Use POST /refresh.' });
});
