/**
 * Rebuild backend/src/data/direct-routes.json from OpenFlights' routes.dat.
 *
 * Why: the When To Go suggested-routes endpoint needs to know which (origin,
 * destination) pairs have non-stop service so it can filter PostHog popularity
 * data + the curated regional fallback to direct flights only. OpenFlights
 * publishes ~67k commercial routes as a free CC-BY-SA dataset — stale by
 * months (new airline launches don't appear until we rebuild), but every
 * major route is covered and the data is structured.
 *
 * Source: https://openflights.org/data.html (routes.dat)
 *
 * Output shape: `{ "<originIATA>": ["<destIATA>", ...] }` — destinations are
 * deduplicated and sorted alphabetically per origin. Codeshares are kept
 * (they still represent direct service from the passenger's perspective).
 *
 * Run: pnpm tsx backend/scripts/build-routes.ts
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROUTES_URL = 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/routes.dat';
const OUTPUT_PATH = resolve(__dirname, '../src/data/direct-routes.json');

interface RouteRow {
  /** CSV: Airline,Airline_ID,Source_IATA,Source_ID,Dest_IATA,Dest_ID,Codeshare,Stops,Equipment */
  origin: string;
  dest: string;
  stops: number;
}

function parseRow(line: string): RouteRow | null {
  const parts = line.split(',');
  if (parts.length < 9) return null;
  const origin = parts[2]?.trim().toUpperCase();
  const dest = parts[4]?.trim().toUpperCase();
  const stops = Number(parts[7]);
  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(dest)) return null;
  if (Number.isNaN(stops)) return null;
  return { origin, dest, stops };
}

async function main() {
  console.log(`Fetching ${ROUTES_URL}...`);
  const res = await fetch(ROUTES_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch routes.dat: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  const lines = text.split('\n').filter(Boolean);
  console.log(`Parsed ${lines.length} raw rows`);

  const byOrigin = new Map<string, Set<string>>();
  let direct = 0;
  let skipped = 0;
  for (const line of lines) {
    const row = parseRow(line);
    if (!row) {
      skipped++;
      continue;
    }
    if (row.stops !== 0) continue;
    direct++;
    if (row.origin === row.dest) continue;
    let set = byOrigin.get(row.origin);
    if (!set) {
      set = new Set();
      byOrigin.set(row.origin, set);
    }
    set.add(row.dest);
  }

  // Stable ordering for deterministic diffs in source control.
  const sortedOrigins = [...byOrigin.keys()].sort();
  const output: Record<string, string[]> = {};
  for (const origin of sortedOrigins) {
    output[origin] = [...byOrigin.get(origin)!].sort();
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 0) + '\n');
  const totalPairs = Object.values(output).reduce((sum, ds) => sum + ds.length, 0);
  console.log(
    `Wrote ${OUTPUT_PATH}: ${sortedOrigins.length} origins, ${totalPairs} direct pairs ` +
      `(skipped ${skipped} malformed rows, kept ${direct} direct rows out of ${lines.length})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
