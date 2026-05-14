import { createClient } from '@libsql/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from './generated/prisma/client';

const dbUrl = process.env.DATABASE_URL ?? 'file:local.db';
const dbToken = process.env.DATABASE_AUTH_TOKEN?.trim();
console.log('[db] url:', dbUrl, '| hasToken:', !!dbToken, '| tokenLen:', dbToken?.length ?? 0);

const libsql = createClient({
  url: dbUrl,
  authToken: dbToken || undefined,
});

const adapter = new PrismaLibSql(libsql);
export const db = new PrismaClient({ adapter });
