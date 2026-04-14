# API Switcher Setup & Usage Guide

## Overview
Your Fast-Travel-Assistant now has a unified **API Switcher** that lets you toggle between real external APIs and mock data with a single button click. Perfect for testing and development!

---

## What Changed

### 1. **Frontend Updates**
- **New UI Component**: `ApiModeSwitcher` button appears in two places:
  - 🏠 **HomeScreen**: Top-right corner next to the Explore button
  - 🗺️ **ProgressBar**: During trip planning (while searching for flights)
  
- **Button Behavior**:
  - 🟢 **Green "Live"** = Using real external APIs
  - 🟠 **Orange "Mock"** = Using mock/test data
  - Click to toggle instantly
  - Selection persists across page refreshes (saved in localStorage)

### 2. **Backend Service Updates**
All backend services now accept an `apiMode` parameter:

#### Flight Service (`/flights/search`)
```
GET /flights/search?originIata=JFK&date=2025-05-15&apiMode=mock
```
- When `apiMode=mock`: Returns mock flight data
- When `apiMode=real` or omitted: Calls Kiwi/SerpApi

#### Weather Service (`/weather/batch`)
```
POST /weather/batch
{
  "destinations": [...],
  "apiMode": "mock"
}
```
- When `apiMode=mock`: Generates realistic random weather
- When `apiMode=real` or omitted: Calls OpenWeatherMap

#### Airline Logos (`/airlines/logos`)
```
GET /airlines/logos?codes=BA,AA&apiMode=mock
```
- When `apiMode=mock`: Returns placeholder logo URLs
- When `apiMode=real` or omitted: Calls Airhex API

---

## How to Use

### For Testing/Development
1. Click the **Mock** button to switch to mock mode
2. The app will use generated test data
3. **No API keys needed** - great for offline testing!
4. Test UI with consistent sample data

### For Production Testing
1. Click the **Live** button to switch to real APIs
2. Ensure environment variables are set:
   - `KIWI_API_KEY` - Flight data
   - `OPENWEATHER_API_KEY` - Weather data
   - `AIRHEX_API_KEY` - Airline logos
3. App calls actual external APIs

### Switching Mid-Session
- Switch the toggle at any time
- Next API call will use the new mode
- Previous cached results may still appear briefly (cached responses)

---

## Mock Data Details

### Mock Flights
- 10 different European destinations with realistic pricing
- Mix of direct and 1-2 stop itineraries
- Airlines: Ryanair, EasyJet, Vueling, Wizz Air, etc.
- Prices: €30-€250 range

### Mock Weather
- Random temperature (50-90°F)
- Various conditions: Sunny, Cloudy, Rainy, Windy, etc.
- Humidity 40-90%
- Wind speed 5-30 mph

### Mock Airline Logos
- Placeholder images for major airlines (BA, AA, FR, U2, etc.)
- Via.placeholder.com service for development

---

## Architecture Changes

### Frontend
```
useApiSwitcher hook (Zustand store)
  ↓
ApiModeSwitcher component (top-right button)
  ↓
All API calls check mode before sending
  ↓
Pass apiMode parameter to backend
```

### Backend
```
Route receives apiMode parameter
  ↓
Service method accepts apiMode argument
  ↓
If apiMode='mock' → use mock logic
If apiMode='real' → call external API
```

---

## Files Modified

**Frontend:**
- `src/components/ApiModeSwitcher.tsx` - Enhanced UI
- `src/screens/HomeScreen.tsx` - Added switcher
- `src/components/ProgressBar.tsx` - Added switcher
- `src/api/flights.api.ts` - Pass apiMode to backend
- `src/api/weather.api.ts` - Pass apiMode to backend
- `src/api/airlines.api.ts` - Pass apiMode to backend

**Backend:**
- `src/services/FlightService.ts` - Accept apiMode parameter
- `src/services/WeatherService.ts` - Accept apiMode + generateMockWeather()
- `src/services/AirlineLogoService.ts` - Accept apiMode + MOCK_AIRLINES_LOGOS
- `src/routes/flights.ts` - Accept apiMode query param
- `src/routes/weather.ts` - Accept apiMode body param
- `src/routes/airlines.ts` - Accept apiMode query param

---

## Testing Checklist

- [ ] Click switcher on HomeScreen - button toggles color
- [ ] Click switcher in ProgressBar - button toggles color
- [ ] In Mock mode: Flights load instantly with test data
- [ ] In Mock mode: Weather shows random conditions
- [ ] In Real mode: Flights call external APIs (may be slower)
- [ ] Reload page - mode selection persists
- [ ] Switch mode mid-flight search - next results use new mode
- [ ] Error handling works in both modes

---

## Troubleshooting

**Problem**: Mock button doesn't appear
- Check that `ApiModeSwitcher` component is imported
- Verify it's added to HomeScreen and ProgressBar

**Problem**: Mode doesn't persist after refresh
- Check browser localStorage is enabled
- Check browser console for errors

**Problem**: Real API calls fail
- Verify environment variables are set (.env file)
- Check API keys are valid
- Check API rate limits haven't been exceeded

---

## Future Enhancements

- [ ] Add dev panel showing current mode in dev tools
- [ ] Add analytics tracking which mode users prefer
- [ ] Add "random" mode that switches between real/mock
- [ ] Add per-endpoint override (e.g., mock flights but real weather)
- [ ] Add UI indicator of data freshness (real vs cached vs mock)
