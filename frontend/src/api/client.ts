import axios from 'axios';
import { useApiSwitcher } from '../store/api-switcher';
import { useAuthStore } from '../store/auth.store';

const getBaseURL = () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  return apiUrl ? `${apiUrl}` : '/api';
};

export const apiClient = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Unwrap the { success, data } envelope
apiClient.interceptors.response.use(
  (response) => {
    if (response.data?.success === true) {
      response.data = response.data.data;
    }
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const url: string = error.config?.url ?? '';
    // If an authenticated endpoint rejects us (cookie missing/expired), drop the
    // stale local user state. The AccountScreen useEffect will then redirect to /login.
    // We exclude /auth/me — its 401 is expected for unauth visitors and is handled in App.tsx.
    if (status === 401 && !url.endsWith('/auth/me') && !url.endsWith('/auth/login')) {
      try { useAuthStore.getState().logout(); } catch { /* ignore */ }
    }
    if (status === 429) {
      const retryAfter = error.response?.headers?.['retry-after'];
      const wait = retryAfter ? ` Please wait ${retryAfter}s.` : '';
      return Promise.reject(new Error(`Too many requests.${wait} Try again shortly.`));
    }
    if (status === 503) {
      return Promise.reject(new Error('Flight search is temporarily unavailable. Please try again shortly.'));
    }
    const msg = error.response?.data?.error?.message ?? error.message ?? 'Unknown error';
    return Promise.reject(new Error(msg));
  },
);

/**
 * Gets the current API mode (real or mock)
 */
export const getApiMode = () => {
  return useApiSwitcher.getState().mode;
};

/**
 * Wrapper for API calls that respects the current mode
 * Returns mock data if in mock mode, otherwise makes real API call
 */
export const createMockableClient = (realFetch: () => Promise<any>, mockData: any) => {
  return async () => {
    const mode = getApiMode();
    if (mode === 'mock') {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 300));
      return mockData;
    }
    return realFetch();
  };
};
