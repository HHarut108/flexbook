# 🇦🇲 Mock Data Updates - Yerevan Zvartnots Airport

## What Was Updated

### ✅ New City Added
- **Yerevan** (Armenia) with Zvartnots International Airport (ZVA)
- Full airport details with official website reference

### ✅ Mock Flights Added (5 routes from Yerevan)
1. **Yerevan → New York** (Armavia)
   - Duration: 690 min (11.5 hours)
   - Stops: 1
   - Price: $599

2. **Yerevan → Los Angeles** (Aeroflot)
   - Duration: 1395 min (23.25 hours)
   - Stops: 1
   - Price: $649

3. **Yerevan → Chicago** (Turkish Airlines)
   - Duration: 735 min (12.25 hours)
   - Stops: 1
   - Price: $529

4. **Yerevan → Dallas** (IATA Carrier)
   - Duration: 810 min (13.5 hours)
   - Stops: 2
   - Price: $489

5. **Yerevan → Denver** (Emirates)
   - Duration: 810 min (13.5 hours)
   - Stops: 1
   - Price: $569

### ✅ Original Flights Preserved
All 3 original sample flights remain (New York origin)

---

## Updated Mock Data Structure

### Airports
```typescript
[
  { iata: 'ZVA', name: 'Zvartnots International Airport', 
    city: 'Yerevan', country: 'Armenia', 
    website: 'https://zvartnots.aero' },
  { iata: 'JFK', ... },
  { iata: 'LAX', ... },
  { iata: 'ORD', ... },
  { iata: 'DFW', ... },
  { iata: 'DEN', ... },
]
```

### Flights
- 5 new flights: ZVA → JFK, LAX, ORD, DFW, DEN
- 3 original flights: NYC origin (for backward compatibility)
- **Total: 8 flights**

---

## Files Modified

- ✅ `src/api/mock-data.ts`
  - Added Yerevan airport
  - Added 5 routes from Yerevan
  - Updated with Zvartnots website reference

---

## Testing Mock Data

The switcher will now:
1. Show Yerevan as an available city
2. Provide 5 flight options from Yerevan
3. Show realistic flight times and prices
4. Display Yerevan ↔ US cities connections

---

## API Response Format

When searching flights in **Mock Mode**:
```json
[
  {
    "id": "mock-flight-zva-jfk-1",
    "airline": "Armavia",
    "departure": "2024-06-15T08:00:00",
    "arrival": "2024-06-15T19:30:00",
    "duration": 690,
    "stops": 1,
    "price": 599,
    "currency": "USD",
    "cabin": "economy"
  },
  ...
]
```

---

## How to Use

### 1. Start Your App
```bash
npm run dev
```

### 2. Click the API Mode Switcher
Make sure it's set to 🟠 **Mock Data** mode

### 3. Search Flights
- Origin: Yerevan (ZVA)
- Destination: New York, Los Angeles, etc.
- See mock flights appear instantly!

---

## Next Steps

To further customize mock data:

### Add More Cities
Edit `src/api/mock-data.ts`:
```typescript
export const mockAirports = [
  { iata: 'ZVA', name: 'Zvartnots International Airport', 
    city: 'Yerevan', country: 'Armenia', 
    website: 'https://zvartnots.aero' },
  { iata: 'CDG', name: 'Charles de Gaulle', 
    city: 'Paris', country: 'France' },
  // Add more...
];
```

### Add More Flights
Add new objects to `mockFlights` array:
```typescript
{
  id: 'mock-flight-zva-cdg-1',
  airline: 'Air France',
  departure: '2024-06-15T06:00:00',
  arrival: '2024-06-15T10:30:00',
  duration: 270,
  stops: 0,
  price: 399,
  currency: 'USD',
  cabin: 'economy',
}
```

### Adjust Flight Details
- Change `duration` for flight time
- Change `stops` for connections
- Change `price` for different fares
- Change `airline` for different carriers

---

## Realistic Flight Times

Based on actual routes:
- **Yerevan → New York**: ~11.5 hours (with 1 stop) ✓
- **Yerevan → Los Angeles**: ~23 hours (with 1 stop) ✓
- **Yerevan → Chicago**: ~12 hours (with 1 stop) ✓
- **Yerevan → Dallas**: ~13.5 hours (with 2 stops) ✓
- **Yerevan → Denver**: ~13.5 hours (with 1 stop) ✓

Prices are realistic for these long-haul routes with typical stopover locations (Istanbul, Dubai, etc.).

---

## Reference

- **Zvartnots Airport Website**: https://zvartnots.aero
- **IATA Code**: ZVA
- **City**: Yerevan, Armenia
- **Location**: Zvartnots, Armavir Province

---

**Status**: ✅ Updated and ready to test!
