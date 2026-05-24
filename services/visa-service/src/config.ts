function readEnv(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

function readBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(v);
}

function readPort(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n <= 0 || n > 65535) {
    throw new Error(`Invalid ${name}: "${v}"`);
  }
  return n;
}

export const config = {
  PORT: readPort('PORT', 4100),
  NODE_ENV: readEnv('NODE_ENV', 'development'),
  ALLOWED_ORIGIN: readEnv('ALLOWED_ORIGIN', '*'),
  AUTO_REFRESH: readBool('AUTO_REFRESH', false),
  REFRESH_TOKEN: readEnv('REFRESH_TOKEN', ''),
  PASSPORT_INDEX_URL: readEnv(
    'PASSPORT_INDEX_URL',
    'https://raw.githubusercontent.com/imorte/passport-index-data/master/passport-index.json',
  ),
};

export const isProduction = config.NODE_ENV === 'production';
