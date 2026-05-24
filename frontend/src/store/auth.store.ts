import { create } from 'zustand';

export interface UserCitizenship {
  id: string;
  countryCode: string;
  countryName: string;
  documentNumber?: string;
  isPrimary: boolean;
}

export interface UserVisa {
  id: string;
  citizenshipId: string;
  countryCode: string;
  countryName: string;
  visaType?: string | null;
  documentNumber?: string | null;
  validUntil?: string | null;
}

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  gender?: Gender | null;
  birthday?: string;
  countryOfResidenceCode?: string | null;
  countryOfResidenceName?: string | null;
  emailVerified: boolean;
  citizenships: UserCitizenship[];
  visas: UserVisa[];
  createdAt: string;
  lastLoginAt?: string | null;
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
