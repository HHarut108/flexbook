import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import { visaRouter } from './routes/visa';
import { countriesRouter } from './routes/countries';
import { refreshRouter } from './routes/refresh';
import { healthRouter } from './routes/health';

function buildCorsOrigin(): cors.CorsOptions['origin'] {
  const raw = config.ALLOWED_ORIGIN.trim();
  if (raw === '*' || raw === '') return true;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length === 1 ? list[0] : list;
}

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: buildCorsOrigin() }));
  app.use(express.json({ limit: '64kb' }));

  app.use(healthRouter);
  app.use(visaRouter);
  app.use(countriesRouter);
  app.use(refreshRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[visa-service]', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
