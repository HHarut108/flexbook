import { Airport } from '@fast-travel/shared';

/**
 * Mock Airport Data - Real Zvartnots Airport & Destinations
 * Source: https://www.zvartnots.aero/
 */
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
