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
  airlineName: string;
  stops: number;
  priceUsd: number;
  bookingUrl: string;
  isReturn: boolean;
  stopIndex: number;
}

export interface AssistanceRequestSummary {
  id: string;
  createdAt: string;
  fullName: string;
  email: string;
  phone: string;
  tripData: {
    origin?: string;
    cities: string[];
    legs: TripLegSummary[];
  };
  tripSlug: string;
  totalPrice: number;
  userType: 'user' | 'guest';
  userId: string | null;
}

export async function fetchAssistanceRequests(): Promise<AssistanceRequestSummary[]> {
  const { data } = await adminClient.get<{ requests: AssistanceRequestSummary[] }>('/assistance-requests');
  return data.requests;
}
