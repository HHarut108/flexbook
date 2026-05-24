import type { VisaRequirement, VisaStatus } from '../types/visa';

const STATUS_LABEL: Record<VisaStatus, string> = {
  'visa free': 'Visa Free',
  'visa on arrival': 'Visa on Arrival',
  eta: 'Electronic Travel Authorisation (ETA)',
  'e-visa': 'eVisa Required',
  'visa required': 'Visa Required',
  'no admission': 'No Admission',
};

export function formatLabel(req: VisaRequirement): string {
  const base = STATUS_LABEL[req.status];
  if (req.status === 'visa free' && typeof req.days === 'number') {
    return `${base} · ${req.days} days`;
  }
  if (typeof req.days === 'number') {
    return `${base} · up to ${req.days} days`;
  }
  return base;
}

export function isKnownStatus(status: string): status is VisaStatus {
  return status in STATUS_LABEL;
}
