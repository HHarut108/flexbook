import axios from 'axios';
import { useApiSwitcher } from '../store/api-switcher';

const getBaseURL = () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  return apiUrl ? `${apiUrl}` : '/api';
};

export const apiClient = axios.create({
  baseURL: getBaseURL(),
  // 45s default: gives the backend room to fail over from Kiwi (30s timeout)
  // to SerpAPI on slow indirect-route searches before the user sees a timeout.
  timeout: 45000,
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
    // Preserve cancellations so callers can ignore them silently.
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }
    const status = error.response?.status;
    if (status === 429) {
      const retryAfter = error.response?.headers?.['retry-after'];
      const wait = retryAfter ? ` Please wait ${retryAfter}s.` : '';
      return Promise.reject(new Error(`Too many requests.${wait} Try again shortly.`));
    }
    if (status === 503) {
      return Promise.reject(new Error('Flight search is temporarily unavailable. Please try again shortly.'));
    }
    // Network / timeout — likely a cold backend or offline user.
    if (error.code === 'ECONNABORTED' || error.message === 'Network Error') {
      return Promise.reject(
        new Error('Server is taking longer than usual to respond. Please try again in a moment.'),
      );
    }
    const errorEnvelope = error.response?.data?.error;
    const msg = errorEnvelope?.message ?? error.message ?? 'Unknown error';
    const wrapped = new Error(msg) as Error & {
      status?: number;
      code?: string;
      retryable?: boolean;
      isCanceled?: boolean;
    };
    if (typeof status === 'number') wrapped.status = status;
    if (typeof errorEnvelope?.code === 'string') wrapped.code = errorEnvelope.code;
    if (typeof errorEnvelope?.retryable === 'boolean') wrapped.retryable = errorEnvelope.retryable;
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') wrapped.isCanceled = true;
    return Promise.reject(wrapped);
  },
);

/**
 * Gets the current API mode (real or mock)
 */
export const getApiMode = () => {
  return useApiSwitcher.getState().mode;
};
