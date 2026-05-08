import axios from 'axios';
import { getToken, logout } from '../auth';

const baseURL = import.meta.env.VITE_API_URL ?? '/api';

const adminClient = axios.create({
  baseURL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

adminClient.interceptors.request.use((cfg) => {
  const token = getToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

adminClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) logout();
    return Promise.reject(err);
  },
);

export interface TripLegSummary {
  flightId: string;
  originIata: string;
  originCity: string;
  destinationIata: string;
  destinationCity: string;
  departureDatetime: string;
  arrivalDatetime: string;
  airlineName: string;
  stops: number;
  priceUsd: number;
  bookingUrl: string;
  isReturn: boolean;
  stopIndex: number;
}

export interface ItinerarySummary {
  origin: { iata: string; city: { name: string } };
  legs: TripLegSummary[];
  passengers: number;
}

export interface AssistanceRequestSummary {
  id: string;
  itinerary: ItinerarySummary;
  tripSlug: string;
  requestedAt: string;
}

export async function fetchAssistanceRequests(): Promise<AssistanceRequestSummary[]> {
  const { data } = await adminClient.get<AssistanceRequestSummary[]>('/assistance-requests');
  return data;
}
