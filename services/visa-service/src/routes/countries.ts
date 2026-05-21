import { Router } from 'express';
import { getDataSource } from '../services/visaDataSource';

export const countriesRouter = Router();

countriesRouter.get('/countries', (_req, res) => {
  const source = getDataSource();
  res.json({
    countries: source.listCountries(),
    last_updated: source.lastUpdated(),
  });
});
