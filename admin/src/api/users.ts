import axios from 'axios';
import { getToken, logout } from '../auth';

const baseURL = import.meta.env.VITE_API_URL ?? '/api';

const client = axios.create({
  baseURL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((cfg) => {
  const token = getToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) logout();
    return Promise.reject(err);
  },
);

export interface AdminCitizenship {
  id: string;
  countryCode: string;
  countryName: string;
  documentNumber: string | null;
  isPrimary: boolean;
}

export interface AdminVisa {
  id: string;
  citizenshipId: string;
  countryCode: string;
  countryName: string;
  visaType: string | null;
  documentNumber: string | null;
  validUntil: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  birthday: string | null;
  countryOfResidenceCode: string | null;
  countryOfResidenceName: string | null;
  emailVerified: boolean;
  createdAt: string;
  citizenships: AdminCitizenship[];
  visas: AdminVisa[];
}

export async function fetchUsers(): Promise<AdminUser[]> {
  const { data } = await client.get<{ users: AdminUser[] }>('/admin/users');
  return data.users;
}
