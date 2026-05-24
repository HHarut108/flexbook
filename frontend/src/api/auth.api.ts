import { apiClient } from './client';
import type { AuthUser } from '../store/auth.store';
import { setSessionHint, clearSessionHint } from '../utils/sessionHint';

export interface CitizenshipInput {
  countryCode: string;
  countryName: string;
  documentNumber?: string | null;
  isPrimary?: boolean;
}

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export interface VisaInput {
  id?: string;
  citizenshipId?: string;
  citizenshipCountryCode?: string;
  countryCode: string;
  countryName: string;
  visaType?: string | null;
  documentNumber?: string | null;
  validUntil?: string | null;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  gender?: Gender;
  birthday?: string;
  citizenships?: CitizenshipInput[];
  visas?: VisaInput[];
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  gender?: Gender | null;
  birthday?: string | null;
  countryOfResidenceCode?: string | null;
  countryOfResidenceName?: string | null;
  citizenships?: CitizenshipInput[];
  visas?: VisaInput[];
}

export const authApi = {
  register: async (data: RegisterInput): Promise<{ message: string }> => {
    const res = await apiClient.post('/auth/register', data);
    return res.data;
  },

  verifyOtp: async (email: string, code: string): Promise<{ user: AuthUser }> => {
    const res = await apiClient.post('/auth/verify-otp', { email, code });
    setSessionHint();
    return res.data;
  },

  resendOtp: async (email: string): Promise<{ message: string }> => {
    const res = await apiClient.post('/auth/resend-otp', { email });
    return res.data;
  },

  login: async (email: string, password: string): Promise<{ user: AuthUser }> => {
    const res = await apiClient.post('/auth/login', { email, password });
    setSessionHint();
    return res.data;
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      clearSessionHint();
    }
  },

  getMe: async (signal?: AbortSignal): Promise<{ user: AuthUser }> => {
    const res = await apiClient.get('/auth/me', { signal });
    return res.data;
  },

  updateProfile: async (data: UpdateProfileInput): Promise<{ user: AuthUser }> => {
    const res = await apiClient.patch('/auth/profile', data);
    return res.data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    const res = await apiClient.patch('/auth/password', { currentPassword, newPassword });
    return res.data;
  },

  deleteAccount: async (password: string): Promise<{ message: string }> => {
    const res = await apiClient.delete('/auth/account', { data: { password } });
    clearSessionHint();
    return res.data;
  },
};
