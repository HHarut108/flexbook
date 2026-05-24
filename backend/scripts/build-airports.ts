/**
 * Rebuild backend/src/data/airports.json from the OurAirports CC0 dataset.
 *
 * Why: the previous dataset was a frozen OpenFlights-derived snapshot with
 * broken country codes (US/UK/UAE all stored as "UN", Chile/Chad/China all
 * "CH") and ~1.5k non-commercial entries (military, heliports, GA strips).
 *
 * OurAirports has a `scheduled_service` flag and ISO-3166 alpha-2 country
 * codes — both fields we need.
 *
 * Run: pnpm tsx backend/scripts/build-airports.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OURAIRPORTS_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const OUTPUT_PATH = resolve(__dirname, '../src/data/airports.json');
const LEGACY_PATH = resolve(__dirname, '../src/data/airports.json');
const GAZETTEER_PATH = resolve(__dirname, '../src/data/airports.gazetteer.json');

interface LegacyAirport {
  iata: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  timezone: string;
  /** Alternate names / marketing aliases / metro codes / local-language
   *  spellings from OurAirports' `keywords` field. Used for search only
   *  (e.g. BGY's keywords include "Milan Bergamo Airport" so a "Milan"
   *  query surfaces it). Empty string when no aliases. */
  keywords: string;
}

/** Slim "place" record used to resolve a city name → coords when the user
 *  searches for a city that has no commercial airport (e.g. São Carlos).
 *  We then surface the nearest commercial airports as "did you mean" hits. */
interface GazetteerEntry {
  city: string;       // display name, with diacritics
  cityNorm: string;   // lowercased + diacritic-stripped, for matching
  lat: number;
  lng: number;
  cc: string;
}

interface OurAirportsRow {
  type: string;
  name: string;
  latitude_deg: string;
  longitude_deg: string;
  iso_country: string;
  municipality: string;
  scheduled_service: string;
  iata_code: string;
  keywords: string;
}

// Minimal RFC 4180 CSV parser: handles quoted fields with embedded commas and
// escaped double-quotes. The OurAirports file does both.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function parseRows(text: string): OurAirportsRow[] {
  const rows = parseCsv(text);
  const header = rows.shift();
  if (!header) throw new Error('CSV has no header row');
  const idx = (k: string) => {
    const i = header.indexOf(k);
    if (i === -1) throw new Error(`Missing column "${k}" in OurAirports CSV`);
    return i;
  };
  const cols = {
    type: idx('type'),
    name: idx('name'),
    latitude_deg: idx('latitude_deg'),
    longitude_deg: idx('longitude_deg'),
    iso_country: idx('iso_country'),
    municipality: idx('municipality'),
    scheduled_service: idx('scheduled_service'),
    iata_code: idx('iata_code'),
    keywords: idx('keywords'),
  };
  return rows
    .filter((r) => r.length >= header.length - 2) // trailing-comma tolerance
    .map((r) => ({
      type: r[cols.type],
      name: r[cols.name],
      latitude_deg: r[cols.latitude_deg],
      longitude_deg: r[cols.longitude_deg],
      iso_country: r[cols.iso_country],
      municipality: r[cols.municipality],
      scheduled_service: r[cols.scheduled_service],
      keywords: r[cols.keywords],
      iata_code: r[cols.iata_code],
    }));
}

const COUNTRY_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

// Used as a final fallback when the IATA isn't present in the legacy dataset.
// Doesn't need to be precise for every country — the search/visa flows only
// care about the country code; timezone is only consumed when rendering local
// departure/arrival strings, where a single-zone approximation is acceptable.
const COUNTRY_PRIMARY_TZ: Record<string, string> = {
  AE: 'Asia/Dubai', AR: 'America/Argentina/Buenos_Aires', AT: 'Europe/Vienna',
  AU: 'Australia/Sydney', BE: 'Europe/Brussels', BG: 'Europe/Sofia',
  BR: 'America/Sao_Paulo', CA: 'America/Toronto', CH: 'Europe/Zurich',
  CL: 'America/Santiago', CN: 'Asia/Shanghai', CO: 'America/Bogota',
  CZ: 'Europe/Prague', DE: 'Europe/Berlin', DK: 'Europe/Copenhagen',
  EG: 'Africa/Cairo', ES: 'Europe/Madrid', FI: 'Europe/Helsinki',
  FR: 'Europe/Paris', GB: 'Europe/London', GR: 'Europe/Athens',
  HK: 'Asia/Hong_Kong', HU: 'Europe/Budapest', ID: 'Asia/Jakarta',
  IE: 'Europe/Dublin', IL: 'Asia/Jerusalem', IN: 'Asia/Kolkata',
  IR: 'Asia/Tehran', IS: 'Atlantic/Reykjavik', IT: 'Europe/Rome',
  JP: 'Asia/Tokyo', KR: 'Asia/Seoul', MA: 'Africa/Casablanca',
  MX: 'America/Mexico_City', MY: 'Asia/Kuala_Lumpur', NG: 'Africa/Lagos',
  NL: 'Europe/Amsterdam', NO: 'Europe/Oslo', NZ: 'Pacific/Auckland',
  PE: 'America/Lima', PH: 'Asia/Manila', PK: 'Asia/Karachi',
  PL: 'Europe/Warsaw', PT: 'Europe/Lisbon', QA: 'Asia/Qatar',
  RO: 'Europe/Bucharest', RU: 'Europe/Moscow', SA: 'Asia/Riyadh',
  SE: 'Europe/Stockholm', SG: 'Asia/Singapore', TH: 'Asia/Bangkok',
  TR: 'Europe/Istanbul', TW: 'Asia/Taipei', UA: 'Europe/Kyiv',
  US: 'America/New_York', VN: 'Asia/Ho_Chi_Minh', ZA: 'Africa/Johannesburg',
};

/** OurAirports stores some municipalities with regional suffixes that read
 *  as gibberish to most users — e.g. Italian province codes ("Ferno (VA)",
 *  "Orio al Serio (BG)") and parenthetical sub-locality clarifiers
 *  ("Frankfurt am Main (Lautzenhausen)"). It also uses comma-suffixed
 *  county/region names for the UK ("London, Essex" for Stansted,
 *  "Luton, Luton") and similar. Strip both — anything from the first
 *  " (" or ", " onwards — so autocomplete shows clean city names.
 *  The marketing-alias overlay (MARKETING_CITY_ALIAS) handles the
 *  remaining cases where the resulting municipality still doesn't match
 *  how travellers think of the airport (e.g. "Ferno" → "Milan"). */
function cleanMunicipality(s: string): string {
  let cleaned = s;
  const paren = cleaned.indexOf(' (');
  if (paren !== -1) cleaned = cleaned.slice(0, paren);
  const comma = cleaned.indexOf(', ');
  if (comma !== -1) cleaned = cleaned.slice(0, comma);
  return cleaned.trim();
}

/** Manual overlay for airports whose city display, after cleanMunicipality,
 *  still doesn't match how travellers think of the airport. Applied last.
 *  Two patterns covered:
 *    1. Low-cost-carrier "satellite" airports branded as the nearby major
 *       city (Ryanair's Milan Bergamo, Paris Beauvais, etc.).
 *    2. Italian / German / French airports where OurAirports stores the
 *       municipality in the local language ("Venezia", "Napoli", "Köln")
 *       while the airport name is already English ("Venice Marco Polo",
 *       "Cologne Bonn") — harmonise to the English name. */
const MARKETING_CITY_ALIAS: Record<string, string> = {
  // Italy — local-language and suburb municipalities
  MXP: 'Milan',     // Malpensa, physically in Ferno (~50 km from Milan)
  LIN: 'Milan',     // Linate — own municipality is Segrate
  BGY: 'Milan',     // Bergamo / Orio al Serio — Ryanair's main "Milan" base
  TSF: 'Venice',    // Treviso — Ryanair brand "Venice Treviso"
  VCE: 'Venice',    // Marco Polo — stored as "Venezia"
  NAP: 'Naples',    // stored as "Napoli"
  FLR: 'Florence',  // stored as "Firenze"
  GOA: 'Genoa',     // stored as "Genova"
  TRN: 'Turin',     // stored as "Caselle Torinese" (suburb)
  VRN: 'Verona',    // stored as "Caselle" (suburb)
  // France — suburb municipalities
  BVA: 'Paris',     // Beauvais (~85 km from Paris) — low-cost "Paris Beauvais"
  MRS: 'Marseille', // stored as "Marignane"
  LYS: 'Lyon',      // stored as "Colombier-Saugnieu"
  // Germany — local-language and suburb municipalities
  HHN: 'Frankfurt', // Frankfurt-Hahn — actually ~120 km from Frankfurt
  NRN: 'Düsseldorf',// Weeze / Niederrhein — branded "Düsseldorf Weeze"
  CGN: 'Cologne',   // stored as "Köln"
  // Belgium
  CRL: 'Brussels',  // Charleroi — branded "Brussels South Charleroi"
  // Spain
  GRO: 'Barcelona', // Girona — "Barcelona Girona" branding
  REU: 'Barcelona', // Reus — same pattern
  // Greece
  ATH: 'Athens',    // stored as "Spata-Artemida" (suburb)
  // Sweden
  NYO: 'Stockholm', // Skavsta (~100 km from Stockholm)
  VST: 'Stockholm', // Västerås
  // Norway
  TRF: 'Oslo',      // Sandefjord/Torp (~110 km from Oslo)
  RYG: 'Oslo',      // Rygge (~60 km from Oslo)
  // Turkey
  SAW: 'Istanbul',  // Sabiha Gökçen — municipality is Pendik (Istanbul Asian side)
  // Japan
  NRT: 'Tokyo',     // Narita (~60 km from central Tokyo)
  // UK — London "satellite" airports all branded as London by carriers
  STN: 'London',    // Stansted
  LTN: 'London',    // Luton
  SEN: 'London',    // Southend
  // Scotland
  PIK: 'Glasgow',   // Prestwick — branded "Glasgow Prestwick"
};
// Rough US longitude → timezone bucketing so coast-to-coast departure times
// aren't all shown as Eastern.
function tzForUSLng(lng: number): string {
  if (lng <= -150) return 'America/Anchorage';
  if (lng <= -115) return 'America/Los_Angeles';
  if (lng <= -100) return 'America/Denver';
  if (lng <= -85) return 'America/Chicago';
  return 'America/New_York';
}

async function main() {
  console.log(`Fetching ${OURAIRPORTS_URL} ...`);
  const res = await fetch(OURAIRPORTS_URL);
  if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);
  const csv = await res.text();
  console.log(`Got ${csv.length.toLocaleString()} bytes of CSV.`);

  const rows = parseRows(csv);
  console.log(`Parsed ${rows.length.toLocaleString()} rows from CSV.`);

  // Read existing dataset so we can preserve known-good IANA timezones for
  // overlapping IATAs (more accurate than our country-primary fallback).
  const legacyRaw: LegacyAirport[] = JSON.parse(readFileSync(LEGACY_PATH, 'utf8'));
  const legacyTz = new Map<string, string>();
  for (const a of legacyRaw) {
    if (a.iata && a.timezone) legacyTz.set(a.iata.toUpperCase(), a.timezone);
  }
  console.log(`Loaded ${legacyTz.size.toLocaleString()} legacy timezones.`);

  const commercialTypes = new Set(['large_airport', 'medium_airport', 'small_airport']);
  const filtered = rows.filter(
    (r) =>
      r.scheduled_service === 'yes' &&
      r.iata_code &&
      r.iata_code.length === 3 &&
      commercialTypes.has(r.type),
  );
  console.log(`${filtered.length.toLocaleString()} rows pass commercial-with-IATA filter.`);

  const seen = new Set<string>();
  const out: LegacyAirport[] = [];
  let tzFromLegacy = 0;
  let tzFromMap = 0;
  let tzFallback = 0;

  for (const r of filtered) {
    const iata = r.iata_code.toUpperCase();
    if (seen.has(iata)) continue;
    seen.add(iata);

    const cc = r.iso_country.toUpperCase();
    const country = (() => {
      try {
        return COUNTRY_NAMES.of(cc) ?? cc;
      } catch {
        return cc;
      }
    })();
    const lat = parseFloat(r.latitude_deg);
    const lng = parseFloat(r.longitude_deg);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    let timezone = legacyTz.get(iata);
    if (timezone) tzFromLegacy++;
    else if (cc === 'US') { timezone = tzForUSLng(lng); tzFromMap++; }
    else if (COUNTRY_PRIMARY_TZ[cc]) { timezone = COUNTRY_PRIMARY_TZ[cc]; tzFromMap++; }
    else { timezone = 'UTC'; tzFallback++; }

    const cleanedCity = cleanMunicipality(r.municipality || r.name);
    const city = MARKETING_CITY_ALIAS[iata] ?? cleanedCity;

    out.push({
      iata,
      name: r.name,
      city,
      country,
      countryCode: cc,
      lat,
      lng,
      timezone,
      keywords: (r.keywords || '').trim(),
    });
  }

  out.sort((a, b) => a.iata.localeCompare(b.iata));

  console.log(`Output: ${out.length.toLocaleString()} airports`);
  console.log(`  timezones from legacy: ${tzFromLegacy.toLocaleString()}`);
  console.log(`  timezones from map:    ${tzFromMap.toLocaleString()}`);
  console.log(`  timezones UTC fallback: ${tzFallback.toLocaleString()}`);

  writeFileSync(OUTPUT_PATH, JSON.stringify(out) + '\n');
  console.log(`Wrote ${OUTPUT_PATH}`);

  // --- Gazetteer: every airport row with a municipality (whether or not it
  //     has scheduled service). Lets us resolve "São Carlos" → coords even
  //     though QSC isn't in the commercial dataset. ---
  const placeTypes = new Set(['large_airport', 'medium_airport', 'small_airport']);
  const gazSeen = new Set<string>();
  const gaz: GazetteerEntry[] = [];
  for (const r of rows) {
    if (!placeTypes.has(r.type)) continue;
    if (!r.municipality) continue;
    const lat = parseFloat(r.latitude_deg);
    const lng = parseFloat(r.longitude_deg);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const cc = r.iso_country.toUpperCase();
    const cityClean = cleanMunicipality(r.municipality);
    const cityNorm = normalizePlaceName(cityClean);
    if (!cityNorm) continue;
    // Dedupe by (normalized city, country) — multiple airports per city only
    // need one coord entry. Keeps the file slim (~1.8 MB).
    const key = `${cityNorm}|${cc}`;
    if (gazSeen.has(key)) continue;
    gazSeen.add(key);
    gaz.push({ city: cityClean, cityNorm, lat, lng, cc });
  }
  gaz.sort((a, b) => a.cityNorm.localeCompare(b.cityNorm));
  writeFileSync(GAZETTEER_PATH, JSON.stringify(gaz) + '\n');
  console.log(`Wrote ${GAZETTEER_PATH} (${gaz.length.toLocaleString()} places)`);
}

/** Lowercase + strip diacritics so "Sao Carlos" matches "São Carlos" and
 *  "Zurich" matches "Zürich". Empty string when the input has no letters. */
function normalizePlaceName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
