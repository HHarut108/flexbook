import { create } from 'zustand';
import { Itinerary } from '@fast-travel/shared';

export interface SavedTrip {
  id: string;
  name: string;
  itinerary: Itinerary;
  savedAt: string; // ISO 8601
}

const STORAGE_KEY = 'flexbook_saved_trips';

function loadFromStorage(): SavedTrip[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(trips: SavedTrip[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

interface SavedTripsState {
  trips: SavedTrip[];
  saveTrip: (itinerary: Itinerary) => string; // returns the id
  deleteTrip: (id: string) => void;
}

export const useSavedTripsStore = create<SavedTripsState>((set, get) => ({
  trips: loadFromStorage(),

  saveTrip: (itinerary) => {
    const cities = itinerary.legs
      .filter((l) => !l.isReturn)
      .map((l) => l.destinationCity);
    const name = [itinerary.origin.city.name, ...cities].join(' → ');

    const trip: SavedTrip = {
      id: crypto.randomUUID(),
      name,
      itinerary,
      savedAt: new Date().toISOString(),
    };

    const updated = [trip, ...get().trips];
    saveToStorage(updated);
    set({ trips: updated });
    return trip.id;
  },

  deleteTrip: (id) => {
    const updated = get().trips.filter((t) => t.id !== id);
    saveToStorage(updated);
    set({ trips: updated });
  },
}));
