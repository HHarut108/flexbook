import type { VisaRequirement } from '../api/visa.api';

export type VisaStatus = VisaRequirement['status'];

export interface VisaTypeInfo {
  /** One-line plain-English summary of what this status means in practice. */
  whatItMeans: string;
  /** Action-oriented sentence telling the user what to actually do. */
  howToGetIt: string;
  /** Typical out-of-pocket cost band in USD. Omitted for visa-free / no-admission. */
  typicalCostUsd?: { min: number; max: number };
  /** Human-readable processing-time band. */
  typicalProcessingTime?: string;
  /** Where the visa is obtained — drives the CTA icon/copy. */
  applyFormat: 'none' | 'at-border' | 'online' | 'embassy';
}

// Conservative US-dollar bands and timeframes that hold across most country
// pairs. These are intentionally ranges — specific cost/timeline per
// passport×destination is upstream from passport-index and not free; surfacing
// rough expectations is more useful than a missing field.
export const VISA_TYPE_INFO: Record<VisaStatus, VisaTypeInfo> = {
  'visa free': {
    whatItMeans: 'Just show up with your passport.',
    howToGetIt:
      'No paperwork needed. Make sure your passport has at least 6 months validity beyond your trip.',
    applyFormat: 'none',
  },
  'visa on arrival': {
    whatItMeans: 'Visa is issued at the airport when you land.',
    howToGetIt:
      'Bring cash (often USD or EUR) and a passport photo. Allow 15–30 minutes at immigration.',
    typicalCostUsd: { min: 25, max: 60 },
    typicalProcessingTime: '15–30 min at the border',
    applyFormat: 'at-border',
  },
  eta: {
    whatItMeans: 'Online travel authorisation linked to your passport.',
    howToGetIt:
      'Apply online before flying — most ETAs are approved within minutes or a few hours.',
    typicalCostUsd: { min: 7, max: 25 },
    typicalProcessingTime: 'Minutes to 24 hours',
    applyFormat: 'online',
  },
  'e-visa': {
    whatItMeans: 'Full visa issued online — no embassy visit needed.',
    howToGetIt:
      'Upload a passport scan and photo, pay the fee, and wait for approval by email.',
    typicalCostUsd: { min: 30, max: 100 },
    typicalProcessingTime: '2–7 business days',
    applyFormat: 'online',
  },
  'visa required': {
    whatItMeans: 'Embassy or consulate visa needed before you travel.',
    howToGetIt:
      'Book an appointment at the destination country’s embassy, submit documents in person, and budget weeks of lead time.',
    typicalCostUsd: { min: 50, max: 200 },
    typicalProcessingTime: '2–4 weeks',
    applyFormat: 'embassy',
  },
  'no admission': {
    whatItMeans: 'Direct travel between these countries isn’t permitted.',
    howToGetIt:
      'Check with your foreign ministry for the current advisory and alternative routes.',
    applyFormat: 'none',
  },
};
