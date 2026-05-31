import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config';
import { countryNameFor } from './countryNames';
import { isKnownStatus } from './labels';
import type {
  Country,
  VisaDataSource,
  VisaRequirement,
  VisaStatus,
} from '../types/visa';

/**
 * Raw dataset shape from passport-index-data:
 *   { "AM": { "FR": { "status": "visa free", "days": 90 } } }
 *
 * Some historical mirrors of the dataset use a numeric value as shorthand
 * for "visa free for N days". We accept both shapes to stay forward-compatible.
 */
type RawEntry = number | { status?: string; days?: number } | null;
type RawDataset = Record<string, Record<string, RawEntry>>;

type NormalizedDataset = Map<string, Map<string, VisaRequirement>>;

const BUNDLED_PATH = path.join(__dirname, '..', 'data', 'passport-index.json');

function normalizeEntry(entry: RawEntry): VisaRequirement | null {
  if (entry === null || entry === undefined) return null;

  if (typeof entry === 'number') {
    if (!Number.isFinite(entry) || entry < 0) return null;
    return { status: 'visa free', days: entry };
  }

  if (typeof entry === 'object' && typeof entry.status === 'string') {
    const status = entry.status.toLowerCase();
    if (!isKnownStatus(status)) return null;
    const out: VisaRequirement = { status };
    if (typeof entry.days === 'number' && Number.isFinite(entry.days)) {
      out.days = entry.days;
    }
    return out;
  }

  return null;
}

function normalize(raw: RawDataset): NormalizedDataset {
  const out: NormalizedDataset = new Map();
  for (const [passport, destinations] of Object.entries(raw)) {
    const passportKey = passport.toUpperCase();
    const inner = new Map<string, VisaRequirement>();
    for (const [destination, entry] of Object.entries(destinations)) {
      const req = normalizeEntry(entry);
      if (req) inner.set(destination.toUpperCase(), req);
    }
    out.set(passportKey, inner);
  }
  return out;
}

export class PassportIndexSource implements VisaDataSource {
  private data: NormalizedDataset = new Map();
  private countries: Country[] = [];
  private loadedAt: string = new Date(0).toISOString();
  private loadPromise: Promise<void> | null = null;

  async load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = this.loadFromBundle()
      .catch(async (err) => {
        console.error('[visa-service] bundled load failed, falling back to remote', err);
        await this.refresh();
      })
      .finally(() => {
        this.loadPromise = null;
      });
    return this.loadPromise;
  }

  async refresh(): Promise<void> {
    const res = await fetch(config.PASSPORT_INDEX_URL);
    if (!res.ok) {
      throw new Error(`Failed to fetch passport-index.json: HTTP ${res.status}`);
    }
    const raw = (await res.json()) as RawDataset;
    this.apply(raw);
  }

  private async loadFromBundle(): Promise<void> {
    const text = await readFile(BUNDLED_PATH, 'utf8');
    const raw = JSON.parse(text) as RawDataset;
    this.apply(raw);
  }

  private apply(raw: RawDataset): void {
    this.data = normalize(raw);
    this.countries = [...this.data.keys()]
      .map((code) => ({ code, name: countryNameFor(code) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    this.loadedAt = new Date().toISOString();
  }

  lookup(passport: string, destination: string): VisaRequirement | null {
    const p = passport.toUpperCase();
    const d = destination.toUpperCase();
    if (p === d) {
      return { status: 'visa free' };
    }
    return this.data.get(p)?.get(d) ?? null;
  }

  listCountries(): Country[] {
    return this.countries;
  }

  hasCountry(code: string): boolean {
    return this.data.has(code.toUpperCase());
  }

  listDestinationsByStatus(passport: string, statuses: VisaStatus[]): string[] {
    const p = passport.toUpperCase();
    const allowed = new Set(statuses);
    const inner = this.data.get(p);
    if (!inner) return [];
    const matches: string[] = [];
    for (const [destination, req] of inner) {
      if (allowed.has(req.status)) matches.push(destination);
    }
    // Same-country trips are always visa-free; mirror lookup()'s behavior.
    if (allowed.has('visa free') && this.data.has(p) && !matches.includes(p)) {
      matches.push(p);
    }
    return matches.sort();
  }

  lastUpdated(): string {
    return this.loadedAt;
  }
}
