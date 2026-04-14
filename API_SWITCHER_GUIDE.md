# API Mode Switcher - Integration Guide

## Overview

The API Mode Switcher allows you to instantly toggle between **real API calls** and **mock data** without changing any code. This is perfect for development, testing, and demos.

## Features

✅ **Zero-code switching** - One click to toggle between real and mock data  
✅ **Persistent state** - Your choice is saved to localStorage  
✅ **Simulated delays** - Mock responses include realistic network delays  
✅ **Zustand-powered** - Global state management without boilerplate  
✅ **TypeScript support** - Fully typed API

## Files Created

```
src/
├── api/
│   ├── mock-data.ts              # Mock data for all APIs
│   ├── client.ts                 # Updated with mode detection
│   ├── flights.api.ts            # Updated with mock support
│   ├── airports.api.ts           # Updated with mock support
│   ├── airlines.api.ts           # Updated with mock support
│   └── weather.api.ts            # Updated with mock support
├── store/
│   └── api-switcher.ts           # Zustand store for mode state
└── components/
    └── ApiModeSwitcher.tsx       # UI toggle button
```

## Quick Start

### 1. Add the Toggle Button to Your Layout

Open your main layout or header component and import the switcher:

```tsx
import { ApiModeSwitcher } from './components/ApiModeSwitcher';

export function Header() {
  return (
    <header className="flex justify-between items-center">
      <h1>Fast Travel Assistant</h1>
      <ApiModeSwitcher />  {/* Add this! */}
    </header>
  );
}
```

The button will appear as:
- 🟢 **Real API** (green) - Using real backend
- 🟠 **Mock Data** (orange) - Using mock data

### 2. Start Using It

That's it! All your API calls will now automatically use mock data when the switcher is in "Mock Data" mode.

## How It Works

### API Functions

Every API function now checks the current mode before making a request:

```tsx
// Example: searchFlights()
export async function searchFlights(...): Promise<FlightOption[]> {
  const mode = getApiMode();  // Check current mode
  
  if (mode === 'mock') {
    await new Promise(resolve => setTimeout(resolve, 300));  // Simulate delay
    return mockFlights.slice(0, limit);  // Return mock data
  }
  
  // Otherwise, make the real API call
  const { data } = await apiClient.get(...);
  return data;
}
```

### Global State Management

The `useApiSwitcher` hook manages the global mode:

```tsx
import { useApiSwitcher } from './store/api-switcher';

function MyComponent() {
  const { mode, setMode, toggle } = useApiSwitcher();
  
  return (
    <>
      <p>Current mode: {mode}</p>
      <button onClick={() => setMode('mock')}>Use Mock</button>
      <button onClick={() => setMode('real')}>Use Real API</button>
      <button onClick={toggle}>Toggle</button>
    </>
  );
}
```

## Mock Data

All mock data is defined in `src/api/mock-data.ts`:

### Flights
```ts
mockFlights  // 3 sample flights with different prices/times
```

### Airports
```ts
mockAirports  // 5 US airports (JFK, LAX, ORD, DFW, DEN)
```

### Airlines
```ts
mockAirlines  // 4 airlines with logos
```

### Weather
```ts
mockWeather  // Sample weather data (72°F, Partly Cloudy, etc.)
```

## Customizing Mock Data

### Add More Mock Flights

```ts
// src/api/mock-data.ts
export const mockFlights: FlightOption[] = [
  {
    id: 'flight-1',
    airline: 'Your Airline',
    departure: '2024-06-15T08:00:00',
    arrival: '2024-06-15T14:30:00',
    duration: 390,
    stops: 0,
    price: 199,
    currency: 'USD',
    cabin: 'economy',
  },
  // ... add more
];
```

### Adjust Network Delay

Each API function simulates a network delay:

```ts
// src/api/flights.api.ts
await new Promise((resolve) => setTimeout(resolve, 300));  // 300ms delay
```

Change the timeout to make it faster or slower:
- **150ms** - Super fast (good for testing UI responsiveness)
- **300ms** - Realistic (typical good network)
- **1000ms** - Slow (simulate poor network)

## Testing Workflow

### Scenario 1: Fast UI Testing
1. Switch to **Mock Data**
2. Make 10 rapid requests
3. Test loading states, pagination, filters

### Scenario 2: Verify Real API
1. Switch to **Real API**
2. Test with actual backend responses
3. Check error handling with real errors

### Scenario 3: Demo Mode
1. Switch to **Mock Data**
2. Demo to stakeholders without backend dependency
3. Consistent, repeatable results

## TypeScript Support

The API switcher is fully typed:

```tsx
import { ApiMode } from './store/api-switcher';

function setApiMode(mode: ApiMode) {  // 'real' | 'mock'
  // TypeScript ensures only valid modes
}
```

## Environment Variables (Optional)

For production, you can force real API mode:

```ts
// .env
VITE_FORCE_API_MODE=real
```

Then update `api-switcher.ts`:

```ts
const getInitialMode = (): ApiMode => {
  const forceMode = import.meta.env.VITE_FORCE_API_MODE as ApiMode;
  if (forceMode) return forceMode;
  
  try {
    const stored = localStorage.getItem('api-mode');
    return (stored === 'mock' || stored === 'real') ? stored : 'real';
  } catch {
    return 'real';
  }
};
```

## Browser DevTools

### Check Current Mode
Open browser console and run:

```js
// Zustand exposes the store
localStorage.getItem('api-mode')  // 'real' or 'mock'
```

### Force Mode from Console
```js
localStorage.setItem('api-mode', 'mock');
location.reload();  // Reload to apply
```

## Performance Notes

- **Mock mode is faster** - No network latency
- **Simulated delays are realistic** - Helps test loading states
- **State persists** - Your choice survives page refreshes
- **No memory leaks** - Zustand handles cleanup

## Troubleshooting

### Mode not changing?
1. Clear browser cache: `Ctrl+Shift+Delete`
2. Hard reload: `Ctrl+Shift+R`
3. Check localStorage: `localStorage.getItem('api-mode')`

### Mock data looks wrong?
1. Check `src/api/mock-data.ts`
2. Verify types match your API schema
3. Update mock data to match your backend

### Still calling real API in mock mode?
1. Make sure you imported `getApiMode` from `./client`
2. Verify the API function checks `const mode = getApiMode()`
3. Check browser console for errors

## Advanced: Custom API Interceptor

Want to add logging or analytics?

```ts
// src/api/client.ts
export const getApiMode = () => {
  const state = useApiSwitcher.getState();
  console.log(`[API] Mode: ${state.mode}`);  // Log for debugging
  return state.mode;
};
```

## Next Steps

1. ✅ Add `ApiModeSwitcher` component to your header
2. ✅ Test with mock mode
3. ✅ Test with real API mode
4. ✅ Customize mock data as needed
5. ✅ Share the switcher with your team!

---

**Created for:** Fast Travel Assistant  
**Tech Stack:** React, TypeScript, Zustand, Axios  
**Made easy:** Zero configuration needed!
