import { Router } from 'express';
import { getDataSource } from '../services/visaDataSource';
import { formatLabel } from '../services/labels';

const ISO2_RE = /^[A-Z]{2}$/i;

export const visaRouter = Router();

visaRouter.get('/visa', (req, res) => {
  const passportRaw = req.query.passport;
  const destinationRaw = req.query.destination;
  const source = getDataSource();

  if (typeof passportRaw !== 'string' || typeof destinationRaw !== 'string') {
    return res.status(400).json({
      error: 'Both "passport" and "destination" query parameters are required.',
      last_updated: source.lastUpdated(),
    });
  }

  if (!ISO2_RE.test(passportRaw) || !ISO2_RE.test(destinationRaw)) {
    return res.status(400).json({
      error: 'Country codes must be ISO 3166-1 alpha-2 (two letters).',
      last_updated: source.lastUpdated(),
    });
  }

  const passport = passportRaw.toUpperCase();
  const destination = destinationRaw.toUpperCase();

  if (!source.hasCountry(passport)) {
    return res.status(400).json({
      error: `Unknown passport country: "${passport}".`,
      last_updated: source.lastUpdated(),
    });
  }
  if (!source.hasCountry(destination)) {
    return res.status(400).json({
      error: `Unknown destination country: "${destination}".`,
      last_updated: source.lastUpdated(),
    });
  }

  const req_ = source.lookup(passport, destination);
  if (!req_) {
    return res.status(404).json({
      error: `No visa data for passport=${passport}, destination=${destination}.`,
      last_updated: source.lastUpdated(),
    });
  }

  return res.json({
    passport,
    destination,
    status: req_.status,
    ...(req_.days !== undefined ? { days: req_.days } : {}),
    label: formatLabel(req_),
    last_updated: source.lastUpdated(),
  });
});
