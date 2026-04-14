# Integration Example - How to Add ApiModeSwitcher to Your App

## Option 1: Add to Header (Recommended)

If you have a header component, add it there for easy access:

```tsx
// src/components/Header.tsx
import { ApiModeSwitcher } from './ApiModeSwitcher';

export function Header() {
  return (
    <header className="flex justify-between items-center p-4 bg-white border-b">
      <h1 className="text-xl font-bold">Fast Travel Assistant</h1>
      <ApiModeSwitcher />
    </header>
  );
}
```

Then use it in your App:

```tsx
// src/App.tsx
import { Header } from './components/Header';

export default function App() {
  return (
    <>
      <Header />
      {/* Rest of your app */}
    </>
  );
}
```

## Option 2: Add to Navigation/Navbar

```tsx
// src/components/Navigation.tsx
import { useLocation } from 'react-router-dom';
import { ApiModeSwitcher } from './ApiModeSwitcher';

export function Navigation() {
  const location = useLocation();

  return (
    <nav className="flex items-center justify-between p-4">
      <div className="flex items-center gap-4">
        {/* Navigation items */}
      </div>
      <ApiModeSwitcher />
    </nav>
  );
}
```

## Option 3: Add to Settings/Debug Panel

```tsx
// src/components/DebugPanel.tsx
import { ApiModeSwitcher } from './ApiModeSwitcher';
import { useApiSwitcher } from '../store/api-switcher';

export function DebugPanel() {
  const { mode } = useApiSwitcher();

  return (
    <div className="p-4 bg-gray-100 rounded">
      <h3 className="font-bold mb-4">Debug Panel</h3>
      <div className="flex items-center gap-4">
        <div>
          <label className="text-sm text-gray-600">API Mode</label>
          <ApiModeSwitcher />
        </div>
        <div className="text-sm">
          <p className="text-gray-600">Current: <span className="font-mono">{mode}</span></p>
        </div>
      </div>
    </div>
  );
}
```

Then conditionally show it in dev mode:

```tsx
// src/App.tsx
export default function App() {
  const isDev = import.meta.env.DEV;

  return (
    <>
      {isDev && <DebugPanel />}
      {/* Rest of your app */}
    </>
  );
}
```

## Option 4: Floating Button (Always Visible)

```tsx
// src/components/FloatingApiSwitcher.tsx
import { ApiModeSwitcher } from './ApiModeSwitcher';

export function FloatingApiSwitcher() {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <ApiModeSwitcher />
    </div>
  );
}
```

Add to App:

```tsx
// src/App.tsx
export default function App() {
  return (
    <>
      <FloatingApiSwitcher />
      {/* Rest of your app */}
    </>
  );
}
```

## Option 5: Top-Right Corner (Clean Design)

```tsx
// src/App.tsx
import { ApiModeSwitcher } from './components/ApiModeSwitcher';

export default function App() {
  return (
    <div className="relative min-h-screen">
      {/* Absolute positioned button */}
      <div className="absolute top-4 right-4 z-10">
        <ApiModeSwitcher />
      </div>
      
      {/* Your app content */}
      <main className="max-w-[448px] mx-auto">
        {/* Screens and components */}
      </main>
    </div>
  );
}
```

## Styling Customization

The `ApiModeSwitcher` component uses Tailwind classes. Customize it:

```tsx
// src/components/ApiModeSwitcher.tsx
export function ApiModeSwitcher() {
  const { mode, toggle } = useApiSwitcher();
  const isMockMode = mode === 'mock';

  return (
    <button
      onClick={toggle}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg font-medium
        transition-all duration-300 transform hover:scale-105
        shadow-md hover:shadow-lg
        ${
          isMockMode
            ? 'bg-gradient-to-r from-orange-400 to-orange-500 text-white'
            : 'bg-gradient-to-r from-green-400 to-green-500 text-white'
        }
      `}
      title={`Click to switch to ${isMockMode ? 'Real' : 'Mock'} API`}
    >
      {isMockMode ? (
        <>
          <Database size={18} />
          <span className="text-sm font-semibold">Mock</span>
        </>
      ) : (
        <>
          <Zap size={18} />
          <span className="text-sm font-semibold">Real</span>
        </>
      )}
    </button>
  );
}
```

## Usage in Components

Once integrated, use the switcher state anywhere:

```tsx
// src/screens/FlightResultsScreen.tsx
import { useApiSwitcher } from '../store/api-switcher';
import { searchFlights } from '../api/flights.api';

export function FlightResultsScreen() {
  const { mode } = useApiSwitcher();
  const [flights, setFlights] = useState([]);

  async function loadFlights() {
    const results = await searchFlights('JFK', '2024-06-15');
    setFlights(results);
  }

  return (
    <div>
      <p className="text-xs text-gray-500">
        Using: {mode === 'mock' ? '📊 Mock Data' : '⚡ Real API'}
      </p>
      {/* Rest of your screen */}
    </div>
  );
}
```

## Testing with Different Modes

```tsx
// src/__tests__/flights.test.tsx
import { useApiSwitcher } from '../store/api-switcher';
import { searchFlights } from '../api/flights.api';

describe('Flight Search', () => {
  it('should work with mock data', async () => {
    // Force mock mode for this test
    const { setMode } = useApiSwitcher.getState();
    setMode('mock');

    const flights = await searchFlights('JFK', '2024-06-15');
    expect(flights).toHaveLength(3);  // mockFlights has 3 items
  });

  it('should handle real API errors', async () => {
    // Force real mode for this test
    const { setMode } = useApiSwitcher.getState();
    setMode('real');

    // Your test...
  });
});
```

## Environment-Based Initial Mode

For production, force real API mode:

```tsx
// src/store/api-switcher.ts
const getInitialMode = (): ApiMode => {
  // Force real API in production
  if (!import.meta.env.DEV) {
    return 'real';
  }

  // In dev, check localStorage
  try {
    const stored = localStorage.getItem('api-mode');
    return (stored === 'mock' || stored === 'real') ? stored : 'real';
  } catch {
    return 'real';
  }
};
```

## Full App Example

```tsx
// src/App.tsx
import { useSessionStore } from './store/session.store';
import { useUrlSync } from './hooks/useUrlSync';
import { ProgressBar } from './components/ProgressBar';
import { ApiModeSwitcher } from './components/ApiModeSwitcher';
import { HomeScreen } from './screens/HomeScreen';
import { FlightResultsScreen } from './screens/FlightResultsScreen';
// ... other imports

export default function App() {
  const screen = useSessionStore((s) => s.screen);
  useUrlSync();

  const appClassName =
    screen === 'flight-results'
      ? 'h-screen bg-bg max-w-[448px] mx-auto flex flex-col overflow-hidden'
      : 'min-h-screen bg-bg max-w-[448px] mx-auto relative';

  return (
    <div className={appClassName}>
      {/* Switcher in top-right corner */}
      <div className="absolute top-4 right-4 z-10">
        <ApiModeSwitcher />
      </div>

      <ProgressBar />
      {screen === 'home' && <HomeScreen />}
      {screen === 'flight-results' && <FlightResultsScreen />}
      {screen === 'stay-duration' && <StayDurationScreen />}
      {screen === 'decision' && <DecisionScreen />}
      {screen === 'return-flights' && <ReturnFlightsScreen />}
      {screen === 'itinerary' && <ItineraryScreen />}
      {screen === 'booking-review' && <BookingReviewScreen />}
    </div>
  );
}
```

## Summary

| Option | Best For | Pros | Cons |
|--------|----------|------|------|
| **Header** | Most apps | Professional, accessible | Needs header component |
| **Navbar** | Navigation apps | Consistent with UI | Not always visible |
| **Settings Panel** | Dev tools | Hidden from users | Extra clicks |
| **Floating Button** | Always accessible | Always visible | Can feel intrusive |
| **Fixed Corner** | Minimal design | Clean, out of the way | Small area |

Pick whichever fits your design best! 🚀
