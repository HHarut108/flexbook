/**
 * Custom migration runner for Turso/libSQL.
 * `prisma migrate deploy` cannot connect to libsql:// URLs (it only handles
 * file: SQLite). This script applies pending migrations using @libsql/client,
 * which works with Turso, and tracks them in a _migrations table.
 */
import { createClient } from '@libsql/client';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(__dirname, '../prisma/migrations');
const TRACKING_TABLE = '_migrations';

async function main() {
  const client = createClient({
    url: process.env.DATABASE_URL ?? 'file:local.db',
    authToken: process.env.DATABASE_AUTH_TOKEN?.trim() || undefined,
  });

  await client.execute(`
    CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
      name       TEXT NOT NULL PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const { rows } = await client.execute(`SELECT name FROM ${TRACKING_TABLE}`);
  const applied = new Set(rows.map(r => String(r.name)));

  const dirs = readdirSync(MIGRATIONS_DIR)
    .filter(d => !d.endsWith('.toml'))
    .sort();

  for (const dir of dirs) {
    if (applied.has(dir)) {
      console.log(`[migrate] skip (already applied): ${dir}`);
      continue;
    }

    const sqlPath = join(MIGRATIONS_DIR, dir, 'migration.sql');
    if (!existsSync(sqlPath)) continue;

    const sql = readFileSync(sqlPath, 'utf-8');
    // Strip comment lines within each semicolon-delimited segment so that
    // statements preceded by -- comments are not accidentally filtered out.
    const statements = sql
      .split(';')
      .map(s =>
        s.split('\n')
          .filter(line => !line.trim().startsWith('--'))
          .join('\n')
          .trim(),
      )
      .filter(s => s.length > 0);

    console.log(`[migrate] applying: ${dir}`);
    for (const stmt of statements) {
      try {
        await client.execute(stmt + ';');
      } catch (err: any) {
        const msg: string = err?.message ?? '';
        // Ignore "already exists" errors — idempotent re-runs are safe.
        if (
          msg.includes('already exists') ||
          msg.includes('duplicate column') ||
          msg.includes('table already has a column')
        ) {
          console.log(`[migrate] skipped (already exists): ${stmt.slice(0, 60)}…`);
          continue;
        }
        throw err;
      }
    }

    await client.execute({
      sql: `INSERT INTO ${TRACKING_TABLE} (name) VALUES (?)`,
      args: [dir],
    });
    console.log(`[migrate] applied:  ${dir}`);
  }

  await client.close();
  console.log('[migrate] done');
}

main().catch(e => {
  console.error('[migrate] failed:', e);
  process.exit(1);
});
