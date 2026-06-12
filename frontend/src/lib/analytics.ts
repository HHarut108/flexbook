/**
 * Thin wrapper around PostHog so the rest of the app never imports posthog-js
 * directly. Every function no-ops safely when VITE_POSTHOG_KEY is absent, so
 * local dev and preview builds without a key are unaffected.
 *
 * Performance: posthog-js is ~75 KB minified. To keep it off the critical
 * path we (1) dynamic-import it from `initAnalytics()`, scheduled via
 * `requestIdleCallback`, and (2) buffer any track()/capturePageview()/
 * identifyUser() calls that fire before the SDK lands, then replay them
 * once it does. From the rest of the app, the behaviour is unchanged.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- we only ever
// touch a tiny surface of the SDK (init/capture/identify/reset) and don't want
// to drag the heavy types into the synchronous import graph.
type PosthogSdk = any;

let posthog: PosthogSdk | null = null;
let enabled = false;

/** Replayed once posthog-js finishes loading. */
type QueuedCall =
  | { type: 'pageview' }
  | { type: 'capture'; event: string; properties?: Record<string, unknown> }
  | { type: 'identify'; id: string; properties?: Record<string, unknown> }
  | { type: 'reset' };
const queue: QueuedCall[] = [];

/** Event names — keep them stable; renaming breaks historical funnels. */
export const AnalyticsEvent = {
  TripSearchStarted: 'trip_search_started',
  BookingClicked: 'booking_clicked',
  TripShared: 'trip_shared',
  UrlStateRecoveryFailed: 'url_state_recovery_failed',
  // When to Go — top-of-funnel "when's it cheap?" tool.
  // Search fires once per committed input change (origin / dest / window),
  // CtaClick fires when the user clicks through to a booking deeplink,
  // WindowPreset fires when they pick one of the preset chips vs custom range.
  WhenToGoSearch: 'when_to_go_search',
  WhenToGoCtaClick: 'when_to_go_cta_click',
  WhenToGoWindowPreset: 'when_to_go_window_preset',
} as const;

type AnalyticsEventName =
  (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

/**
 * Schedule the SDK to load when the browser is idle. The dynamic `import()`
 * creates its own Rollup chunk, so posthog-js never lands in the main bundle.
 */
function scheduleSdkLoad(load: () => void) {
  if (typeof window === 'undefined') return;
  type IdleCallback = (cb: () => void, opts?: { timeout: number }) => void;
  const ric = (window as unknown as { requestIdleCallback?: IdleCallback })
    .requestIdleCallback;
  if (ric) {
    ric(load, { timeout: 2000 });
  } else {
    window.setTimeout(load, 1500);
  }
}

export function initAnalytics(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info('[analytics] VITE_POSTHOG_KEY not set — analytics disabled.');
    }
    return;
  }

  scheduleSdkLoad(async () => {
    try {
      const mod = await import('posthog-js');
      const sdk: PosthogSdk = mod.default ?? mod;
      sdk.init(key, {
        api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
        // Count anonymous guests/sessions/taps, but only create person profiles
        // once a user logs in — keeps event volume within the free tier.
        person_profiles: 'identified_only',
        // We capture pageviews manually on route change (SPA), so disable the
        // built-in handler to avoid double counting.
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: true,
        session_recording: {
          maskAllInputs: true,
        },
      });
      posthog = sdk;
      enabled = true;
      // Drain anything that fired before the SDK was ready.
      while (queue.length) {
        const call = queue.shift()!;
        try {
          if (call.type === 'pageview') sdk.capture('$pageview');
          else if (call.type === 'capture') sdk.capture(call.event, call.properties);
          else if (call.type === 'identify') sdk.identify(call.id, call.properties);
          else if (call.type === 'reset') sdk.reset();
        } catch {
          /* never let analytics break the app */
        }
      }
    } catch {
      // Network blocked, adblocker, or chunk failed to load — silent no-op.
    }
  });
}

export function capturePageview(): void {
  if (enabled && posthog) {
    posthog.capture('$pageview');
    return;
  }
  // Buffer until the SDK loads so the first pageview (often the most
  // valuable one — landing page) still gets counted.
  queue.push({ type: 'pageview' });
}

export function track(
  event: AnalyticsEventName,
  properties?: Record<string, unknown>,
): void {
  if (enabled && posthog) {
    posthog.capture(event, properties);
    return;
  }
  queue.push({ type: 'capture', event, properties });
}

export function identifyUser(
  id: string,
  properties?: Record<string, unknown>,
): void {
  if (enabled && posthog) {
    posthog.identify(id, properties);
    return;
  }
  queue.push({ type: 'identify', id, properties });
}

export function resetUser(): void {
  if (enabled && posthog) {
    posthog.reset();
    return;
  }
  queue.push({ type: 'reset' });
}
