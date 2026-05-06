import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  KIWI_API_KEY: z.string().default(''),
  RAPIDAPI_KEY: z.string().default(''),
  SERPAPI_API_KEY: z.string().default(''),
  OPENWEATHER_API_KEY: z.string().default(''),
  AIRHEX_API_KEY: z.string().default(''),
  GOOGLE_PLACES_API_KEY: z.string().default(''),
  FRONTEND_URL: z.string().default('https://flexbook-frontend.vercel.app'),
  UPSTASH_REDIS_REST_URL: z.string().default(''),
  UPSTASH_REDIS_REST_TOKEN: z.string().default(''),
  RESEND_API_KEY: z.string().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
