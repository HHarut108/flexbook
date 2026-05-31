import { Router } from 'express';
import { getDataSource } from '../services/visaDataSource';
import { formatLabel, isKnownStatus } from '../services/labels';
import type { VisaStatus } from '../types/visa';

const ISO2_RE = /^[A-Z]{2}$/i;

// Default "open" statuses for the visa-free destination listing — the union of
// statuses requiring no advance paperwork before travel.
const DEFAULT_OPEN_STATUSES: VisaStatus[] = ['visa free', 'visa on arrival'];

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

/**
 * GET /visa-free?passport=XX[&statuses=visa%20free,visa%20on%20arrival]
 * Returns ISO-2 destination codes whose status for `passport` is in `statuses`.
 * Defaults to ['visa free', 'visa on arrival'] — destinations that need no
 * paperwork before travel.
 */
visaRouter.get('/visa-free', (req, res) => {
  const passportRaw = req.query.passport;
  const statusesRaw = req.query.statuses;
  const source = getDataSource();

  if (typeof passportRaw !== 'string' || !ISO2_RE.test(passportRaw)) {
    return res.status(400).json({
      error: '"passport" query parameter is required and must be ISO-2.',
      last_updated: source.lastUpdated(),
    });
  }

  const passport = passportRaw.toUpperCase();
  if (!source.hasCountry(passport)) {
    return res.status(400).json({
      error: `Unknown passport country: "${passport}".`,
      last_updated: source.lastUpdated(),
    });
  }

  let statuses: VisaStatus[] = DEFAULT_OPEN_STATUSES;
  if (typeof statusesRaw === 'string' && statusesRaw.trim().length > 0) {
    const parts = statusesRaw.split(',').map((s) => s.trim().toLowerCase());
    const valid = parts.filter(isKnownStatus);
    if (valid.length === 0) {
      return res.status(400).json({
        error: '"statuses" must be a comma-separated list of known visa statuses.',
        last_updated: source.lastUpdated(),
      });
    }
    statuses = valid;
  }

  const destinations = source.listDestinationsByStatus(passport, statuses);
  return res.json({
    passport,
    statuses,
    destinations,
    last_updated: source.lastUpdated(),
  });
});
