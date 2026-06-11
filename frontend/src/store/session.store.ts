import { create } from 'zustand';
import { FlightOption, WeatherSummary } from '@fast-travel/shared';

interface SessionState {
  selectedDate: string | null;
  selectedFlight: FlightOption | null;
  weatherMap: Record<string, WeatherSummary>;
  toast: string | null;
  shareModal: { url: string } | null;
  expiredLinkModal: boolean;

  setSelectedDate: (date: string) => void;
  setSelectedFlight: (flight: FlightOption | null) => void;
  setWeather: (iata: string, weather: WeatherSummary) => void;
  showToast: (message: string) => void;
  clearToast: () => void;
  showShareModal: (url: string) => void;
  closeShareModal: () => void;
  showExpiredLinkModal: () => void;
  closeExpiredLinkModal: () => void;
  reset: () => void;
}

const initialState = {
  selectedDate: null,
  selectedFlight: null,
  weatherMap: {},
  toast: null as string | null,
  shareModal: null as { url: string } | null,
  expiredLinkModal: false,
};

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,

  setSelectedDate: (date) => set({ selectedDate: date }),
  setSelectedFlight: (flight) => set({ selectedFlight: flight }),
  setWeather: (iata, weather) =>
    set((s) => ({ weatherMap: { ...s.weatherMap, [iata]: weather } })),
  showToast: (message) => set({ toast: message }),
  clearToast: () => set({ toast: null }),
  showShareModal: (url) => set({ shareModal: { url } }),
  closeShareModal: () => set({ shareModal: null }),
  showExpiredLinkModal: () => set({ expiredLinkModal: true }),
  closeExpiredLinkModal: () => set({ expiredLinkModal: false }),
  reset: () => set(initialState),
}));
