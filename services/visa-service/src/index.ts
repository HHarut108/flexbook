import { createApp } from './app';
import { config } from './config';
import { getDataSource } from './services/visaDataSource';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function main() {
  const source = getDataSource();
  await source.load();

  if (config.AUTO_REFRESH) {
    const tick = async () => {
      try {
        await source.refresh();
        console.log(`[visa-service] auto-refresh ok at ${source.lastUpdated()}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        console.error(`[visa-service] auto-refresh failed: ${message}`);
      }
    };
    const timer = setInterval(tick, ONE_DAY_MS);
    timer.unref();
    console.log('[visa-service] AUTO_REFRESH enabled (every 24h)');
  }

  const app = createApp();
  app.listen(config.PORT, () => {
    console.log(
      `[visa-service] listening on http://localhost:${config.PORT} ` +
        `(env=${config.NODE_ENV}, countries=${source.listCountries().length})`,
    );
  });
}

main().catch((err) => {
  console.error('[visa-service] fatal startup error', err);
  process.exit(1);
});
