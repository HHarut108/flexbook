import posthog from 'posthog-js';

/**
 * Thin wrapper around PostHog so the rest of the app never imports posthog-js
 * directly. Every function no-ops safely when VITE_POSTHOG_KEY is absent, so
 * local dev and preview builds without a key are unaffected.
 */

let enabled = false;

/** Event names — keep them stable; renaming breaks historical funnels. */
export const AnalyticsEvent = {
  TripSearchStarted: 'trip_search_started',
  BookingClicked: 'booking_clicked',
  TripShared: 'trip_shared',
  UrlStateRecoveryFailed: 'url_state_recovery_failed',
  // When To Go — top-of-funnel "when's it cheap?" tool.
  // Search fires once per committed input change (origin / dest / window),
  // CtaClick fires when the user clicks through to a booking deeplink,
  // WindowPreset fires when they pick one of the preset chips vs custom range.
  WhenToGoSearch: 'when_to_go_search',
  WhenToGoCtaClick: 'when_to_go_cta_click',
  WhenToGoWindowPreset: 'when_to_go_window_preset',
} as const;

type AnalyticsEventName =
  (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

export function initAnalytics(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info('[analytics] VITE_POSTHOG_KEY not set — analytics disabled.');
    }
    return;
  }

  posthog.init(key, {
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
  enabled = true;
}

export function capturePageview(): void {
  if (!enabled) return;
  posthog.capture('$pageview');
}

export function track(
  event: AnalyticsEventName,
  properties?: Record<string, unknown>,
): void {
  if (!enabled) return;
  posthog.capture(event, properties);
}

export function identifyUser(
  id: string,
  properties?: Record<string, unknown>,
): void {
  if (!enabled) return;
  posthog.identify(id, properties);
}

export function resetUser(): void {
  if (!enabled) return;
  posthog.reset();
}
