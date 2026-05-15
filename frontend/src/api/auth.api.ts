import { apiClient } from './client';
import type { AuthUser } from '../store/auth.store';

export interface CitizenshipInput {
  countryCode: string;
  countryName: string;
  documentNumber?: string | null;
  isPrimary?: boolean;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  birthday?: string;
  citizenships?: CitizenshipInput[];
}

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

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
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
    return res.data;
  },

  resendOtp: async (email: string): Promise<{ message: string }> => {
    const res = await apiClient.post('/auth/resend-otp', { email });
    return res.data;
  },

  login: async (email: string, password: string): Promise<{ user: AuthUser }> => {
    const res = await apiClient.post('/auth/login', { email, password });
    return res.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  getMe: async (): Promise<{ user: AuthUser }> => {
    const res = await apiClient.get('/auth/me');
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
    return res.data;
  },
};
