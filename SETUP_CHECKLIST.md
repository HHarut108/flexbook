# API Mode Switcher - Setup Checklist ✅

## What Was Created

### Core Files (Ready to Use)
- ✅ `src/api/mock-data.ts` - Mock data for all APIs
- ✅ `src/store/api-switcher.ts` - Zustand state management
- ✅ `src/components/ApiModeSwitcher.tsx` - Toggle button UI
- ✅ `src/api/client.ts` - Updated with mode detection
- ✅ `src/api/flights.api.ts` - Flight search with mock support
- ✅ `src/api/airports.api.ts` - Airport search with mock support
- ✅ `src/api/airlines.api.ts` - Airline logos with mock support
- ✅ `src/api/weather.api.ts` - Weather batch with mock support

### Documentation
- ✅ `API_SWITCHER_GUIDE.md` - Complete feature guide
- ✅ `INTEGRATION_EXAMPLE.md` - Multiple integration options
- ✅ `SETUP_CHECKLIST.md` - This file!

## Quick Setup (5 Minutes)

### Step 1: Add the Toggle to Your App
Choose one option from `INTEGRATION_EXAMPLE.md`:

**Option A: Top-right corner (simplest)**
```tsx
// src/App.tsx
import { ApiModeSwitcher } from './components/ApiModeSwitcher';

export default function App() {
  return (
    <div className="relative">
      <div className="absolute top-4 right-4">
        <ApiModeSwitcher />
      </div>
      {/* Your app */}
    </div>
  );
}
```

**Option B: Header component**
```tsx
// src/components/Header.tsx
import { ApiModeSwitcher } from './ApiModeSwitcher';

export function Header() {
  return (
    <header className="flex justify-between items-center p-4">
      <h1>Fast Travel</h1>
      <ApiModeSwitcher />
    </header>
  );
}
```

### Step 2: Test It
1. Run your app: `npm run dev`
2. Click the button in the top-right (or wherever you placed it)
3. Watch it toggle between 🟢 Real API and 🟠 Mock Data
4. Try searching for flights - should use mock data when toggled

### Step 3: Done! 🎉
That's all you need to do. All API calls automatically respect the mode.

## Verification Checklist

- [ ] Can see the toggle button in your app
- [ ] Button changes color when clicked (green ↔ orange)
- [ ] Mock data appears when button is orange
- [ ] Real API is called when button is green
- [ ] Toggling persists after page refresh
- [ ] No console errors in browser DevTools

## File-by-File Overview

### `src/api/mock-data.ts`
**Purpose:** Stores sample data for development
**Contains:**
- 3 mock flights
- 5 mock airports
- 4 mock airlines
- 1 mock weather object

**Customize by:** Adding/editing objects in this file

### `src/store/api-switcher.ts`
**Purpose:** Global state management using Zustand
**Exports:**
- `useApiSwitcher` hook
- `ApiMode` type
- `getApiMode()` function

**Use in components:** `const { mode, toggle } = useApiSwitcher()`

### `src/components/ApiModeSwitcher.tsx`
**Purpose:** Visual toggle button
**Features:**
- Shows current mode with icon
- Changes color based on mode
- Tooltip on hover
- Uses lucide-react icons

**Styling:** Fully customizable Tailwind classes

### `src/api/client.ts`
**Updates:**
- Added `getApiMode()` export
- Added `createMockableClient()` helper (optional)
- Maintains all existing error handling

**No breaking changes** - existing code still works

### `src/api/*.api.ts` (flights, airports, airlines, weather)
**Updates:** Each file now checks the API mode:
1. Gets current mode: `const mode = getApiMode()`
2. If mock mode: returns mock data with simulated delay
3. If real mode: makes actual API call

**Network delay:** 150-300ms to simulate realistic behavior

## Usage Examples

### In Components
```tsx
import { useApiSwitcher } from '../store/api-switcher';

function MyComponent() {
  const { mode } = useApiSwitcher();
  
  if (mode === 'mock') {
    return <div>Using mock data 📊</div>;
  }
  
  return <div>Using real API ⚡</div>;
}
```

### In API Functions
```tsx
import { getApiMode } from '../api/client';

async function searchFlights(...) {
  const mode = getApiMode();
  
  if (mode === 'mock') {
    // Return mock data
    return mockFlights;
  }
  
  // Make real API call
  return await apiClient.get(...);
}
```

### In Tests
```tsx
import { useApiSwitcher } from '../store/api-switcher';

it('should work with mock data', () => {
  // Force mock mode for this test
  useApiSwitcher.getState().setMode('mock');
  
  // Your test...
});
```

## Troubleshooting

### Button not visible?
- Check if you added it to App.tsx
- Verify imports are correct
- Check CSS is loading (DevTools > Elements)

### Mode not changing?
- Hard refresh browser: `Ctrl+Shift+R`
- Clear localStorage: Open DevTools > Application > Clear Storage
- Check console for errors: `Ctrl+Shift+J`

### Still calling real API?
- Verify `getApiMode()` is called in the API function
- Check mode in console: `localStorage.getItem('api-mode')`
- Inspect Network tab to see actual requests

### Mock data looks wrong?
- Edit `src/api/mock-data.ts`
- Make sure types match your schema
- Restart dev server after changes

## Next Steps

### For Development
1. Use mock mode during development
2. Fast iterations without backend dependency
3. Test edge cases with mock data

### For Testing
1. Test with both modes
2. Verify real API error handling
3. Check loading states with mock delays

### For Demos
1. Switch to mock mode
2. Repeatable results
3. No dependency on backend availability

### Customization
1. Add more mock data
2. Adjust simulated network delays
3. Customize toggle UI appearance
4. Force mode by environment

## Performance Impact

- **Mock mode is faster** - No network requests
- **Memory:** Minimal (just state object)
- **Bundle size:** ~5KB (Zustand is tiny)
- **No runtime cost** when not used

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ⚠️ IE11 (not supported - uses modern JS)

## Known Limitations

1. **Mock data is static** - Not updated by user actions
2. **No validation** - Mock data doesn't validate inputs
3. **Simulated delays** - Not perfectly realistic network behavior
4. **localStorage fallback** - Degrades to in-memory if unavailable

## Advanced: Connecting More APIs

### To add another API to the switcher:

1. **Add mock data** to `src/api/mock-data.ts`:
   ```ts
   export const mockNewApi = { ... };
   ```

2. **Update your API function** to check mode:
   ```ts
   import { getApiMode } from './client';
   import { mockNewApi } from './mock-data';
   
   export async function newApiCall() {
     const mode = getApiMode();
     
     if (mode === 'mock') {
       await new Promise(r => setTimeout(r, 200));
       return mockNewApi;
     }
     
     return await apiClient.get(...);
   }
   ```

That's it! The toggle automatically works for the new API.

## Tips & Tricks

### Enable/Disable for Specific Users
```ts
// Force real API for production users
if (!isDevelopment && !isAdmin) {
  useApiSwitcher.getState().setMode('real');
}
```

### Log API Mode Changes
```ts
// In your store or main app
useApiSwitcher.subscribe((state) => {
  console.log(`[API] Switched to: ${state.mode}`);
});
```

### Add Visual Indicator
```tsx
// In your layout
<div className={`
  fixed bottom-1 right-1 w-2 h-2 rounded-full
  ${mode === 'mock' ? 'bg-orange-500' : 'bg-green-500'}
`} />
```

## Getting Help

### Check These First
1. Read `API_SWITCHER_GUIDE.md` for detailed info
2. Check `INTEGRATION_EXAMPLE.md` for placement options
3. Review console errors (DevTools: F12)
4. Check Network tab to see actual requests

### Common Questions

**Q: Can I use this in production?**  
A: Yes, but disable the toggle in production builds.

**Q: Does this work with GraphQL?**  
A: Yes, apply same pattern to your GraphQL client.

**Q: Can I share mock data with backend team?**  
A: Yes, export from `mock-data.ts` and share fixtures.

**Q: How do I update mock data for new features?**  
A: Edit `src/api/mock-data.ts` and restart dev server.

---

## Status: Ready to Use! ✅

All files are created and functional. Just add the `ApiModeSwitcher` component to your app layout and you're done!

**Next action:** Pick an integration option from `INTEGRATION_EXAMPLE.md` and add it to your App! 🚀
