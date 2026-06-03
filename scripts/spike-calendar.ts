/**
 * Throwaway spike: does Kiwi (via RapidAPI) or SerpAPI Google Flights expose
 * a multi-day "calendar" mode in one request? If neither, what does sampled
 * probing (N parallel single-date calls) cost in wall time?
 *
 * Run from repo root:
 *   npx tsx --env-file=backend/.env scripts/spike-calendar.ts
 *
 * Findings go to stdout; nothing is persisted, nothing else is touched.
 */
import axios, { AxiosError } from 'axios';

const ORIGIN = 'EVN';        // Yerevan (matches the user's running example)
const DEST = 'CDG';          // Paris CDG
const RANGE_START = '2026-08-01';
const RANGE_END = '2026-08-31';
const SAMPLED_DAYS = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28].map(
  (d) => `2026-08-${String(d).padStart(2, '0')}`,
);

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const SERPAPI_KEY = process.env.SERPAPI_API_KEY;

function hr(label: string) {
  console.log('\n' + '═'.repeat(70));
  console.log(' ' + label);
  console.log('═'.repeat(70));
}

function ms(start: number) {
  return `${(Date.now() - start).toFixed(0)}ms`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1 — Kiwi range mode
// ─────────────────────────────────────────────────────────────────────────────
async function testKiwiRange() {
  hr('TEST 1 — Kiwi RapidAPI: does a 30-day range return multi-day results?');
  if (!RAPIDAPI_KEY) {
    console.log('  SKIP — no RAPIDAPI_KEY in env');
    return;
  }

  const params: Record<string, string | number> = {
    source: `Airport:${ORIGIN}`,
    destination: `Airport:${DEST}`,
    currency: 'usd',
    locale: 'en',
    adults: 1,
    children: 0,
    infants: 0,
    handbags: 0,
    holdbags: 0,
    cabinClass: 'ECONOMY',
    sortBy: 'PRICE',
    sortOrder: 'ASCENDING',
    transportTypes: 'FLIGHT',
    limit: 250,
    // The interesting bit: expand the existing same-day clamp into a real range.
    outboundDepartureDateStart: `${RANGE_START}T00:00:00`,
    outboundDepartureDateEnd: `${RANGE_END}T23:59:59`,
  };

  const t0 = Date.now();
  try {
    const { data, headers } = await axios.get(
      'https://kiwi-com-cheap-flights.p.rapidapi.com/one-way',
      {
        params,
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': 'kiwi-com-cheap-flights.p.rapidapi.com',
        },
        timeout: 30000,
      },
    );
    const took = ms(t0);
    const itineraries: any[] = data.itineraries ?? [];
    console.log(`  ✓ HTTP 200 in ${took} · ${itineraries.length} itineraries returned`);
    console.log(`  RapidAPI quota headers: ` + JSON.stringify({
      limit: headers['x-ratelimit-requests-limit'],
      remaining: headers['x-ratelimit-requests-remaining'],
    }));

    // Group by departure date — if the range param is honored, we see multiple days.
    const byDay = new Map<string, { count: number; minUsd: number }>();
    for (const it of itineraries) {
      const segs = it?.sector?.sectorSegments ?? [];
      const dep = segs[0]?.segment?.source?.localTime;
      if (!dep) continue;
      const day = dep.slice(0, 10); // YYYY-MM-DD
      const price = parseFloat(it?.price?.amount ?? '0');
      const cur = byDay.get(day);
      if (!cur || price < cur.minUsd) byDay.set(day, { count: (cur?.count ?? 0) + 1, minUsd: price });
      else cur.count++;
    }

    const days = [...byDay.entries()].sort();
    console.log(`  Distinct departure days in response: ${days.length}`);
    if (days.length > 1) {
      console.log('  ✓✓ RANGE MODE WORKS — sample (cheapest per day):');
      for (const [day, { count, minUsd }] of days.slice(0, 10)) {
        console.log(`     ${day}  ·  ${count.toString().padStart(3)} itin  ·  min $${minUsd.toFixed(2)}`);
      }
      if (days.length > 10) console.log(`     … and ${days.length - 10} more days`);
    } else {
      console.log('  ✗ Range param ignored — all itineraries are from one day. Path A on Kiwi is out.');
    }
  } catch (err) {
    const e = err as AxiosError;
    console.log(`  ✗ FAIL — HTTP ${e.response?.status ?? '?'} after ${ms(t0)}: ${e.message}`);
    if (e.response?.data) console.log('  body: ' + JSON.stringify(e.response.data).slice(0, 300));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2 — SerpAPI: does the baseline response carry calendar/price-insight data?
// ─────────────────────────────────────────────────────────────────────────────
async function testSerpApiPayload() {
  hr('TEST 2 — SerpAPI Google Flights: inspect baseline response for calendar data');
  if (!SERPAPI_KEY) {
    console.log('  SKIP — no SERPAPI_API_KEY in env');
    return;
  }

  const t0 = Date.now();
  try {
    const { data } = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google_flights',
        departure_id: ORIGIN,
        arrival_id: DEST,
        outbound_date: SAMPLED_DAYS[5], // mid-month
        type: 2, // one-way
        currency: 'USD',
        adults: 1,
        hl: 'en',
        api_key: SERPAPI_KEY,
      },
      timeout: 20000,
    });
    console.log(`  ✓ HTTP 200 in ${ms(t0)}`);
    console.log('  Top-level keys: ' + Object.keys(data).join(', '));

    // Calendar / price-insight surfaces we know about from SerpAPI docs.
    const interesting = ['price_insights', 'price_history', 'price_levels', 'date_grid', 'cheapest_flights'];
    for (const k of interesting) {
      if (data[k]) {
        console.log(`  ✓ Found "${k}"  · type=${Array.isArray(data[k]) ? `array(${data[k].length})` : typeof data[k]}`);
        const preview = JSON.stringify(data[k]).slice(0, 240);
        console.log(`     preview: ${preview}${preview.length >= 240 ? '…' : ''}`);
      }
    }

    // Try the "calendar"-style call explicitly: SerpAPI exposes a `flights_results` /
    // `cheapest_flights` array on some routes. Also try `type=1` (round-trip is needed
    // for some calendar features per their docs).
    console.log('\n  --- Retry with type=1 (round-trip, return 7d later) to see if calendar surfaces ---');
    const t1 = Date.now();
    const { data: data2 } = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google_flights',
        departure_id: ORIGIN,
        arrival_id: DEST,
        outbound_date: SAMPLED_DAYS[5],
        return_date: '2026-08-23',
        type: 1,
        currency: 'USD',
        adults: 1,
        hl: 'en',
        api_key: SERPAPI_KEY,
      },
      timeout: 20000,
    });
    console.log(`  ✓ HTTP 200 in ${ms(t1)}`);
    console.log('  Top-level keys (round-trip): ' + Object.keys(data2).join(', '));
    for (const k of interesting) {
      if (data2[k]) {
        console.log(`  ✓ Found "${k}" in round-trip response`);
        const preview = JSON.stringify(data2[k]).slice(0, 240);
        console.log(`     preview: ${preview}${preview.length >= 240 ? '…' : ''}`);
      }
    }
  } catch (err) {
    const e = err as AxiosError;
    console.log(`  ✗ FAIL — HTTP ${e.response?.status ?? '?'}: ${e.message}`);
    if (e.response?.data) console.log('  body: ' + JSON.stringify(e.response.data).slice(0, 300));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3 — Path B realism: 10 parallel Kiwi single-date calls
// ─────────────────────────────────────────────────────────────────────────────
async function testSampledProbing() {
  hr('TEST 3 — Path B: 10 parallel single-date Kiwi calls (sampled probing latency)');
  if (!RAPIDAPI_KEY) {
    console.log('  SKIP — no RAPIDAPI_KEY in env');
    return;
  }

  const t0 = Date.now();
  const results = await Promise.allSettled(
    SAMPLED_DAYS.map(async (date) => {
      const startedAt = Date.now();
      const { data } = await axios.get(
        'https://kiwi-com-cheap-flights.p.rapidapi.com/one-way',
        {
          params: {
            source: `Airport:${ORIGIN}`,
            destination: `Airport:${DEST}`,
            currency: 'usd',
            locale: 'en',
            adults: 1,
            children: 0,
            infants: 0,
            handbags: 0,
            holdbags: 0,
            cabinClass: 'ECONOMY',
            sortBy: 'PRICE',
            sortOrder: 'ASCENDING',
            transportTypes: 'FLIGHT',
            limit: 50,
            outboundDepartureDateStart: `${date}T00:00:00`,
            outboundDepartureDateEnd: `${date}T23:59:59`,
          },
          headers: {
            'x-rapidapi-key': RAPIDAPI_KEY,
            'x-rapidapi-host': 'kiwi-com-cheap-flights.p.rapidapi.com',
          },
          timeout: 25000,
        },
      );
      const its: any[] = data.itineraries ?? [];
      const minPrice = its
        .map((it) => parseFloat(it?.price?.amount ?? 'Infinity'))
        .reduce((a, b) => Math.min(a, b), Infinity);
      return { date, count: its.length, minUsd: minPrice, took: ms(startedAt) };
    }),
  );

  const totalTook = ms(t0);
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected');

  console.log(`  Wall time for 10 parallel calls: ${totalTook}`);
  console.log(`  Success: ${ok}/${results.length}`);

  for (const r of results) {
    if (r.status === 'fulfilled') {
      const v = r.value;
      console.log(`    ${v.date}  ·  ${v.count.toString().padStart(3)} itin  ·  min $${Number.isFinite(v.minUsd) ? v.minUsd.toFixed(2) : 'none'}  ·  ${v.took}`);
    } else {
      const e = r.reason as AxiosError;
      console.log(`    FAIL — HTTP ${e.response?.status ?? '?'}: ${e.message}`);
    }
  }

  if (failed.length) {
    const rateLimited = failed.filter((r) => (r.reason as AxiosError).response?.status === 429).length;
    if (rateLimited) console.log(`  ⚠ ${rateLimited}/${failed.length} failures were 429 rate-limit — Path B needs throttling.`);
  }
}

async function main() {
  console.log(`spike-calendar · ${new Date().toISOString()}`);
  console.log(`route: ${ORIGIN}→${DEST}  ·  range: ${RANGE_START} → ${RANGE_END}`);
  console.log(`keys present: kiwi=${!!RAPIDAPI_KEY}  serpapi=${!!SERPAPI_KEY}`);

  await testKiwiRange();
  await testSerpApiPayload();
  await testSampledProbing();

  hr('DONE');
}

main().catch((e) => {
  console.error('spike-calendar failed:', e);
  process.exit(1);
});
