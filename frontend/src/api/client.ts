import axios from 'axios';
import { useApiSwitcher } from '../store/api-switcher';

export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
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
