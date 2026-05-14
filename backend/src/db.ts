import { createClient } from '@libsql/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from './generated/prisma/client';

const libsql = createClient({
  url: process.env.DATABASE_URL ?? 'file:local.db',
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const adapter = new PrismaLibSql(libsql);
export const db = new PrismaClient({ adapter });
