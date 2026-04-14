import { FlightOption } from '@fast-travel/shared';

/**
 * Mock Flight Data - Based on Real Zvartnots Airport Destinations
 * Source: https://www.zvartnots.aero/
 * Last Updated: April 2026
 */
export const mockFlights: FlightOption[] = [
  // Yerevan to Istanbul (Turkish Airlines - Primary Route)
  {
    id: 'mock-flight-evn-ist-1',
    airline: 'Turkish Airlines',
    departure: '2024-06-15T07:45:00',
    arrival: '2024-06-15T10:30:00',
    duration: 165,
    stops: 0,
    price: 89,
    currency: 'USD',
    cabin: 'economy',
  },
  // Yerevan to Amsterdam (FLYONE ARMENIA)
  {
    id: 'mock-flight-evn-ams-1',
    airline: 'FLYONE ARMENIA',
    departure: '2024-06-15T08:00:00',
    arrival: '2024-06-15T12:30:00',
    duration: 270,
    stops: 0,
    price: 145,
    currency: 'USD',
    cabin: 'economy',
  },
  // Yerevan to Vienna (FLYONE ARMENIA)
  {
    id: 'mock-flight-evn-vie-1',
    airline: 'FLYONE ARMENIA',
    departure: '2024-06-15T09:30:00',
    arrival: '2024-06-15T13:45:00',
    duration: 255,
    stops: 0,
    price: 139,
    currency: 'USD',
    cabin: 'economy',
  },
  // Yerevan to Rhodes (Wizz Air)
  {
    id: 'mock-flight-evn-rho-1',
    airline: 'Wizz Air',
    departure: '2024-06-15T10:00:00',
    arrival: '2024-06-15T14:00:00',
    duration: 240,
    stops: 0,
    price: 59,
    currency: 'USD',
    cabin: 'economy',
  },
  // Yerevan to London (Wizz Air)
  {
    id: 'mock-flight-evn-lon-1',
    airline: 'Wizz Air',
    departure: '2024-06-15T11:00:00',
    arrival: '2024-06-15T14:45:00',
    duration: 345,
    stops: 0,
    price: 79,
    currency: 'USD',
    cabin: 'economy',
  },
  // Yerevan to Tehran (Fly Kish)
  {
    id: 'mock-flight-evn-thr-1',
    airline: 'Fly Kish',
    departure: '2024-06-15T06:00:00',
    arrival: '2024-06-15T07:30:00',
    duration: 90,
    stops: 0,
    price: 45,
    currency: 'USD',
    cabin: 'economy',
  },
  // Yerevan to Istanbul (Budget - Wizz Air Alternative)
  {
    id: 'mock-flight-evn-ist-2',
    airline: 'Wizz Air',
    departure: '2024-06-15T14:30:00',
    arrival: '2024-06-15T17:15:00',
    duration: 165,
    stops: 0,
    price: 49,
    currency: 'USD',
    cabin: 'economy',
  },
  // Yerevan to Amsterdam via Istanbul (Turkish Airlines)
  {
    id: 'mock-flight-evn-ams-2',
    airline: 'Turkish Airlines',
    departure: '2024-06-15T12:00:00',
    arrival: '2024-06-15T18:30:00',
    duration: 390,
    stops: 1,
    price: 159,
    currency: 'USD',
    cabin: 'economy',
  },
  // Original sample flights (New York origin) - for backward compatibility
  {
    id: 'mock-flight-1',
    airline: 'Delta Airlines',
    departure: '2024-06-15T08:00:00',
    arrival: '2024-06-15T14:30:00',
    duration: 390,
    stops: 0,
    price: 245,
    currency: 'USD',
    cabin: 'economy',
  },
  {
    id: 'mock-flight-2',
    airline: 'United Airlines',
    departure: '2024-06-15T10:15:00',
    arrival: '2024-06-15T18:45:00',
    duration: 510,
    stops: 1,
    price: 189,
    currency: 'USD',
    cabin: 'economy',
  },
];

/**
 * Mock Airport Data - Real Zvartnots Airport & Destinations
 * Source: https://www.zvartnots.aero/
 */
import { Airport } from '@fast-travel/shared';

export const mockAirports: Airport[] = [
  // Primary Hub
  {
    iata: 'EVN', name: 'Zvartnots International Airport', timezone: 'Asia/Yerevan',
    city: { id: 'EVN', name: 'Yerevan', countryCode: 'AM', countryName: 'Armenia', lat: 40.1473, lng: 44.3959 },
  },
  // Primary Destinations from Zvartnots
  {
    iata: 'IST', name: 'Istanbul Airport', timezone: 'Europe/Istanbul',
    city: { id: 'IST', name: 'Istanbul', countryCode: 'TR', countryName: 'Turkey', lat: 41.2753, lng: 28.7519 },
  },
  {
    iata: 'AMS', name: 'Amsterdam Airport Schiphol', timezone: 'Europe/Amsterdam',
    city: { id: 'AMS', name: 'Amsterdam', countryCode: 'NL', countryName: 'Netherlands', lat: 52.3086, lng: 4.7639 },
  },
  {
    iata: 'VIE', name: 'Vienna International Airport', timezone: 'Europe/Vienna',
    city: { id: 'VIE', name: 'Vienna', countryCode: 'AT', countryName: 'Austria', lat: 48.1103, lng: 16.5697 },
  },
  {
    iata: 'RHO', name: 'Rhodes International Airport', timezone: 'Europe/Athens',
    city: { id: 'RHO', name: 'Rhodes', countryCode: 'GR', countryName: 'Greece', lat: 36.4054, lng: 28.0862 },
  },
  {
    iata: 'LHR', name: 'London Heathrow Airport', timezone: 'Europe/London',
    city: { id: 'LHR', name: 'London', countryCode: 'GB', countryName: 'United Kingdom', lat: 51.4775, lng: -0.4614 },
  },
  {
    iata: 'IKA', name: 'Imam Khomeini International Airport', timezone: 'Asia/Tehran',
    city: { id: 'IKA', name: 'Tehran', countryCode: 'IR', countryName: 'Iran', lat: 35.4161, lng: 51.1522 },
  },
  // Secondary Hub
  {
    iata: 'LWN', name: 'Shirak Airport', timezone: 'Asia/Yerevan',
    city: { id: 'LWN', name: 'Gyumri', countryCode: 'AM', countryName: 'Armenia', lat: 40.7503, lng: 43.8593 },
  },
];

/**
 * Mock Airline Data - Real Carriers Operating at Zvartnots
 * Source: https://www.zvartnots.aero/ (as of April 2026)
 */
export const mockAirlines = [
  { code: 'TK', name: 'Turkish Airlines', logo: 'https://via.placeholder.com/50?text=TK' },
  { code: 'W6', name: 'Wizz Air', logo: 'https://via.placeholder.com/50?text=W6' },
  { code: 'F3', name: 'FLYONE ARMENIA', logo: 'https://via.placeholder.com/50?text=F3' },
  { code: 'IK', name: 'Fly Kish', logo: 'https://via.placeholder.com/50?text=IK' },
];

/**
 * Mock Weather Data - Yerevan Climate
 */
export const mockWeather = {
  temperature: 24,
  description: 'Sunny',
  humidity: 45,
  windSpeed: 8,
  feelsLike: 23,
};

/**
 * Mock Stay Recommendations - Yerevan Hotels
 */
export const mockStayRecommendations = [
  {
    id: 'stay-1',
    name: 'Armenia Marriott Hotel',
    rating: 4.7,
    reviews: 312,
    price: 189,
    currency: 'USD',
    description: 'Luxury 5-star hotel in central Yerevan with panoramic city views',
  },
  {
    id: 'stay-2',
    name: 'Metropol Hotel',
    rating: 4.5,
    reviews: 267,
    price: 129,
    currency: 'USD',
    description: 'Modern 4-star hotel near Republic Square with excellent amenities',
  },
  {
    id: 'stay-3',
    name: 'Hayern Ayak Hotel',
    rating: 4.6,
    reviews: 289,
    price: 99,
    currency: 'USD',
    description: 'Charming boutique hotel with traditional Armenian hospitality',
  },
  {
    id: 'stay-4',
    name: 'Guesthouse Yerevan',
    rating: 4.3,
    reviews: 156,
    price: 49,
    currency: 'USD',
    description: 'Cozy budget-friendly guesthouse with local charm and personal service',
  },
];
