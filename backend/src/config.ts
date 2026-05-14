import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  KIWI_API_KEY: z.string().default(''),
  RAPIDAPI_KEY: z.string().default(''),
  SERPAPI_API_KEY: z.string().default(''),
  OPENWEATHER_API_KEY: z.string().default(''),
  GOOGLE_PLACES_API_KEY: z.string().default(''),
  FRONTEND_URL: z.string().default('https://flexbook-frontend.vercel.app'),
  UPSTASH_REDIS_REST_URL: z.string().default(''),
  UPSTASH_REDIS_REST_TOKEN: z.string().default(''),
  RESEND_API_KEY: z.string().default(''),
  ADMIN_PASSWORD: z.string().default(''),
  ADMIN_SESSION_SECRET: z.string().default(''),
  CRON_SECRET: z.string().default(''),
  USER_JWT_SECRET: z.string().default('dev-user-jwt-secret-change-in-prod'),
  DATABASE_URL: z.string().default('file:./dev.db'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;

if (config.NODE_ENV === 'production') {
  const missing: string[] = [];
  if (!config.ADMIN_SESSION_SECRET) missing.push('ADMIN_SESSION_SECRET');
  if (!config.ADMIN_PASSWORD) missing.push('ADMIN_PASSWORD');
  if (!config.USER_JWT_SECRET || config.USER_JWT_SECRET === 'dev-user-jwt-secret-change-in-prod') missing.push('USER_JWT_SECRET');
  if (missing.length) {
    console.error(
      `FATAL: ${missing.join(', ')} must be set in production. Refusing to start.`,
    );
    process.exit(1);
  }
}
