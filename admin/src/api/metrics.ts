import axios from 'axios';
import { getToken, logout } from '../auth';

const baseURL = import.meta.env.VITE_API_URL ?? '/api';

const adminClient = axios.create({
  baseURL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the session token to every request
adminClient.interceptors.request.use((cfg) => {
  const token = getToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// On 401, clear the stale token so the login page re-appears
adminClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) logout();
    return Promise.reject(err);
  },
);

export async function adminLogin(password: string): Promise<string> {
  const { data } = await adminClient.post<{ token: string }>('/admin/login', { password });
  return data.token;
}

export interface DayMetrics {
  date: string;
  calls: Record<string, number>;
}

export interface MetricsHistoryResponse {
  from: string;
  to: string;
  history: DayMetrics[];
}

export interface SingleDayResponse extends DayMetrics {
  startedAt: string;
  persistent: boolean;
}

export interface ReportResponse {
  sent: boolean;
  type?: 'daily' | 'history';
  date?: string;
  from?: string;
  to?: string;
  error?: string;
}

/** Per-service primary vs fallback breakdown. */
export interface ServiceBreakdown {
  primary: number;
  fallback: number;
}

export interface SessionMetricsResponse {
  startedAt: string;
  calls: Record<string, ServiceBreakdown>;
}

export interface AllTimeMetricsResponse {
  calls: Record<string, ServiceBreakdown>;
}

export async function fetchMetricsHistory(from: string, to: string): Promise<MetricsHistoryResponse> {
  const { data } = await adminClient.get<MetricsHistoryResponse>('/metrics/history', {
    params: { from, to },
  });
  return data;
}

export async function fetchMetricsDay(date?: string): Promise<SingleDayResponse> {
  const { data } = await adminClient.get<SingleDayResponse>('/metrics', {
    params: date ? { date } : undefined,
  });
  return data;
}

export async function fetchSessionMetrics(): Promise<SessionMetricsResponse> {
  const { data } = await adminClient.get<SessionMetricsResponse>('/metrics/session');
  return data;
}

export async function fetchAllTimeMetrics(): Promise<AllTimeMetricsResponse> {
  const { data } = await adminClient.get<AllTimeMetricsResponse>('/metrics/alltime');
  return data;
}

export async function sendReport(payload: { date?: string; from?: string; to?: string }): Promise<ReportResponse> {
  const { data } = await adminClient.post<ReportResponse>('/metrics/report', payload);
  return data;
}

export interface AssistanceRequest {
  id: string;
  createdAt: string;
  fullName: string;
  email: string;
  phone: string;
  tripData: {
    origin?: string;
    cities: string[];
    totalPrice: number;
    legs: unknown[];
  };
}

export async function fetchAssistanceRequests(): Promise<AssistanceRequest[]> {
  const { data } = await adminClient.get<{ requests: AssistanceRequest[] }>('/assistance-requests');
  return data.requests;
}
