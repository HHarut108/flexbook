import { create } from 'zustand';

export interface UserCitizenship {
  id: string;
  countryCode: string;
  countryName: string;
  documentNumber?: string;
  isPrimary: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  birthday?: string;
  emailVerified: boolean;
  citizenships: UserCitizenship[];
  createdAt: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  logout: () => set({ user: null, loading: false }),
}));
