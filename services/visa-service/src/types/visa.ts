export type VisaStatus =
  | 'visa free'
  | 'visa on arrival'
  | 'eta'
  | 'e-visa'
  | 'visa required'
  | 'no admission';

export interface VisaRequirement {
  status: VisaStatus;
  days?: number;
}

export interface Country {
  code: string;
  name: string;
}

export interface VisaLookupResult {
  passport: string;
  destination: string;
  status: VisaStatus;
  days?: number;
  label: string;
}

/**
 * Pluggable data backend. The current implementation reads the passport-index
 * JSON dataset; future implementations may call Sherpa or another live API.
 */
export interface VisaDataSource {
  load(): Promise<void>;
  refresh(): Promise<void>;
  lookup(passport: string, destination: string): VisaRequirement | null;
  listCountries(): Country[];
  hasCountry(code: string): boolean;
  /**
   * Return ISO-2 destination codes whose visa status for the given passport
   * is in `statuses`. The passport's own country is always included.
   */
  listDestinationsByStatus(passport: string, statuses: VisaStatus[]): string[];
  lastUpdated(): string;
}
