const CDN = 'https://images.kiwi.com/airlines/64';

export const AIRLINE_LOGOS: Record<string, string> = {
  AA: `${CDN}/AA.png`, // American Airlines
  AC: `${CDN}/AC.png`, // Air Canada
  AF: `${CDN}/AF.png`, // Air France
  AI: `${CDN}/AI.png`, // Air India
  AS: `${CDN}/AS.png`, // Alaska Airlines
  AY: `${CDN}/AY.png`, // Finnair
  AZ: `${CDN}/AZ.png`, // ITA Airways
  B6: `${CDN}/B6.png`, // JetBlue
  BA: `${CDN}/BA.png`, // British Airways
  BR: `${CDN}/BR.png`, // EVA Air
  CA: `${CDN}/CA.png`, // Air China
  CX: `${CDN}/CX.png`, // Cathay Pacific
  CZ: `${CDN}/CZ.png`, // China Southern
  DL: `${CDN}/DL.png`, // Delta
  DY: `${CDN}/DY.png`, // Norwegian
  EI: `${CDN}/EI.png`, // Aer Lingus
  EK: `${CDN}/EK.png`, // Emirates
  ET: `${CDN}/ET.png`, // Ethiopian Airlines
  EY: `${CDN}/EY.png`, // Etihad
  F9: `${CDN}/F9.png`, // Frontier Airlines
  FI: `${CDN}/FI.png`, // Icelandair
  FR: `${CDN}/FR.png`, // Ryanair
  G4: `${CDN}/G4.png`, // Allegiant Air
  G9: `${CDN}/G9.png`, // Air Arabia
  HA: `${CDN}/HA.png`, // Hawaiian Airlines
  HU: `${CDN}/HU.png`, // Hainan Airlines
  IB: `${CDN}/IB.png`, // Iberia
  JL: `${CDN}/JL.png`, // Japan Airlines
  JP: `${CDN}/JP.png`, // Adria Airways
  KE: `${CDN}/KE.png`, // Korean Air
  KL: `${CDN}/KL.png`, // KLM
  LA: `${CDN}/LA.png`, // LATAM
  LH: `${CDN}/LH.png`, // Lufthansa
  LO: `${CDN}/LO.png`, // LOT Polish Airlines
  LX: `${CDN}/LX.png`, // SWISS
  MH: `${CDN}/MH.png`, // Malaysia Airlines
  MS: `${CDN}/MS.png`, // EgyptAir
  MU: `${CDN}/MU.png`, // China Eastern
  NH: `${CDN}/NH.png`, // ANA
  NK: `${CDN}/NK.png`, // Spirit Airlines
  OS: `${CDN}/OS.png`, // Austrian Airlines
  OZ: `${CDN}/OZ.png`, // Asiana Airlines
  PC: `${CDN}/PC.png`, // Pegasus Airlines
  PS: `${CDN}/PS.png`, // Ukraine International
  QF: `${CDN}/QF.png`, // Qantas
  QR: `${CDN}/QR.png`, // Qatar Airways
  RJ: `${CDN}/RJ.png`, // Royal Jordanian
  S7: `${CDN}/S7.png`, // S7 Airlines
  SA: `${CDN}/SA.png`, // South African Airways
  SK: `${CDN}/SK.png`, // SAS
  SN: `${CDN}/SN.png`, // Brussels Airlines
  SQ: `${CDN}/SQ.png`, // Singapore Airlines
  SU: `${CDN}/SU.png`, // Aeroflot
  SV: `${CDN}/SV.png`, // Saudi Arabian Airlines
  TG: `${CDN}/TG.png`, // Thai Airways
  TK: `${CDN}/TK.png`, // Turkish Airlines
  TP: `${CDN}/TP.png`, // TAP Air Portugal
  U2: `${CDN}/U2.png`, // easyJet
  UA: `${CDN}/UA.png`, // United Airlines
  UX: `${CDN}/UX.png`, // Air Europa
  VN: `${CDN}/VN.png`, // Vietnam Airlines
  VY: `${CDN}/VY.png`, // Vueling
  W6: `${CDN}/W6.png`, // Wizz Air
  WN: `${CDN}/WN.png`, // Southwest Airlines
  WS: `${CDN}/WS.png`, // WestJet
  XQ: `${CDN}/XQ.png`, // SunExpress
  XY: `${CDN}/XY.png`, // flynas
};

export function getAirlineLogoUrl(iataCode: string): string {
  const code = iataCode.trim().toUpperCase();
  return AIRLINE_LOGOS[code] ?? `${CDN}/${code}.png`;
}
