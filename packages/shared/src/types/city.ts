export interface City {
  id: string;
  name: string;
  countryCode: string;
  countryName: string;
  lat: number;
  lng: number;
  /** Member airport IATAs for multi-airport metropolitan areas (e.g. Rome →
   *  ['FCO','CIA'], London → ['LHR','LGW','STN','LCY','LTN','SEN']). Only
   *  populated for City entries returned from /api/airports/search; the City
   *  embedded inside an Airport.city field leaves this undefined. */
  airports?: string[];
}
