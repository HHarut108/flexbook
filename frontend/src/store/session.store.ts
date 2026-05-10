import { create } from 'zustand';
import { FlightOption, WeatherSummary } from '@fast-travel/shared';

interface SessionState {
  selectedDate: string | null;
  pendingFlights: FlightOption[];
  selectedFlight: FlightOption | null;
  weatherMap: Record<string, WeatherSummary>;
  isSearchingFlights: boolean;
  flightError: string | null;
  toast: string | null;
  shareModal: { url: string } | null;
  expiredLinkModal: boolean;

  setSelectedDate: (date: string) => void;
  setPendingFlights: (flights: FlightOption[]) => void;
  setSelectedFlight: (flight: FlightOption) => void;
  setWeather: (iata: string, weather: WeatherSummary) => void;
  setFlightLoading: (loading: boolean) => void;
  setFlightError: (error: string | null) => void;
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
  pendingFlights: [],
  selectedFlight: null,
  weatherMap: {},
  isSearchingFlights: false,
  flightError: null,
  toast: null as string | null,
  shareModal: null as { url: string } | null,
  expiredLinkModal: false,
};

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,

  setSelectedDate: (date) => set({ selectedDate: date }),
  setPendingFlights: (flights) => set({ pendingFlights: flights }),
  setSelectedFlight: (flight) => set({ selectedFlight: flight }),
  setWeather: (iata, weather) =>
    set((s) => ({ weatherMap: { ...s.weatherMap, [iata]: weather } })),
  setFlightLoading: (loading) => set({ isSearchingFlights: loading }),
  setFlightError: (error) => set({ flightError: error }),
  showToast: (message) => set({ toast: message }),
  clearToast: () => set({ toast: null }),
  showShareModal: (url) => set({ shareModal: { url } }),
  closeShareModal: () => set({ shareModal: null }),
  showExpiredLinkModal: () => set({ expiredLinkModal: true }),
  closeExpiredLinkModal: () => set({ expiredLinkModal: false }),
  reset: () => set(initialState),
}));
