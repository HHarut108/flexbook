import { apiClient } from './client';

export interface VisaRequirement {
  passport: string;
  destination: string;
  status:
    | 'visa free'
    | 'visa on arrival'
    | 'eta'
    | 'e-visa'
    | 'visa required'
    | 'no admission';
  days?: number;
  label: string;
  last_updated: string;
}

export interface VisaCountry {
  code: string;
  name: string;
}

export async function fetchVisaRequirement(
  passport: string,
  destination: string,
): Promise<VisaRequirement> {
  const { data } = await apiClient.get<VisaRequirement>('/visa/requirement', {
    params: { passport, destination },
  });
  return data;
}

export async function fetchVisaCountries(): Promise<VisaCountry[]> {
  const { data } = await apiClient.get<VisaCountry[]>('/visa/countries');
  return data;
}
