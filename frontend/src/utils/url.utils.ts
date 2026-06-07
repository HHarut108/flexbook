import LZString from 'lz-string';
import { z } from 'zod';
import { FlightOption, Itinerary } from '@fast-travel/shared';

const PARAM_KEY = 't';

// Runtime schemas for URL-borne state. The URL is user-controlled (and
// shareable), so we never trust the decoded shape — a crafted or corrupted
// `?t=` could otherwise land an unexpected object in the trip store and
// crash downstream code with a confusing TypeError. safeParse → null lets
// the caller surface a clean "expired link" path instead.
//
// Keep these in sync with packages/shared types/{city,airport,weather,flight,trip}.

const citySchema = z.object({
  id: z.string(),
  name: z.string(),
  countryCode: z.string(),
  countryName: z.string(),
  lat: z.number(),
  lng: z.number(),
  // Multi-airport metro members (e.g. Rome → ['FCO','CIA']). Only populated
  // for derived City entries from /api/airports/search; absent for the City
  // embedded inside an Airport. Optional so legacy URLs decode unchanged.
  airports: z.array(z.string()).optional(),
});

const airportSchema = z.object({
  iata: z.string(),
  name: z.string(),
  city: citySchema,
  timezone: z.string(),
  distanceKm: z.number().optional(),
});

const weatherSummarySchema = z.object({
  temperatureC: z.number(),
  condition: z.enum(['clear', 'cloudy', 'rain', 'snow', 'storm', 'unknown']),
  isForecast: z.boolean(),
  date: z.string(),
});

const priceInfoSchema = z.object({
  amount: z.number(),
  currency: z.string(),
  provider: z.string(),
  deeplink: z.string(),
  priceUpdatedAt: z.string(),
  priceStatus: z.enum(['cached', 'live', 'stale']),
});

const flightOptionSchema = z.object({
  flightId: z.string(),
  originIata: z.string(),
  originCity: z.string(),
  destinationIata: z.string(),
  destinationCity: z.string(),
  destinationCountry: z.string(),
  destinationLat: z.number(),
  destinationLng: z.number(),
  departureDatetime: z.string(),
  arrivalDatetime: z.string(),
  durationMinutes: z.number(),
  airlineName: z.string(),
  airlineCode: z.string().optional(),
  stops: z.number(),
  viaIatas: z.array(z.string()).optional(),
  viaCoords: z.array(z.object({ lat: z.number(), lng: z.number() })).optional(),
  priceUsd: z.number(),
  bookingUrl: z.string(),
  priceInfo: priceInfoSchema.optional(),
  weather: weatherSummarySchema.optional(),
});

const tripLegSchema = flightOptionSchema.extend({
  stopIndex: z.number(),
  stayDurationDays: z.number(),
  nextDepartureDate: z.string(),
  isReturn: z.boolean(),
});

const pickSchema = z.object({
  city: z.string(),
  kind: z.enum(['stay', 'do', 'eat']),
  name: z.string(),
});

const itinerarySchema = z.object({
  origin: airportSchema,
  // City id for multi-airport "Rome (city)" picks — flight searches will fan
  // out across the city's member airports. Absent for plain-airport picks.
  originCityId: z.string().optional(),
  legs: z.array(tripLegSchema),
  status: z.enum(['planning', 'complete']),
  createdAt: z.string(),
  completedAt: z.string().optional(),
  passengers: z.number(),
  picks: z.array(pickSchema).optional(),
});

const urlSessionSchema = z.object({
  selectedFlight: flightOptionSchema.nullish(),
  selectedDate: z.string().nullish(),
});

export function encodeItinerary(itinerary: Itinerary): string {
  const json = JSON.stringify(itinerary);
  return LZString.compressToEncodedURIComponent(json);
}

export function decodeItinerary(encoded: string): Itinerary | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const parsed = itinerarySchema.safeParse(JSON.parse(json));
    return parsed.success ? (parsed.data as Itinerary) : null;
  } catch {
    return null;
  }
}

export function readShareParam(): Itinerary | null {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get(PARAM_KEY);
  if (!encoded) return null;
  return decodeItinerary(encoded);
}

export function buildSlugShareUrl(slug: string): string {
  return `${window.location.origin}/share/${slug}`;
}

// Transient picker state persisted alongside the committed Itinerary so the
// user can reload mid-funnel (/stay, /flights leg 2+) without losing the flight
// they were about to commit or the date they were searching.
export interface UrlSessionState {
  selectedFlight?: FlightOption | null;
  selectedDate?: string | null;
}

export function encodeSession(session: UrlSessionState): string {
  const json = JSON.stringify(session);
  return LZString.compressToEncodedURIComponent(json);
}

export function decodeSession(encoded: string): UrlSessionState | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const parsed = urlSessionSchema.safeParse(JSON.parse(json));
    return parsed.success ? (parsed.data as UrlSessionState) : null;
  } catch {
    return null;
  }
}
