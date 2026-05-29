/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_FRONTEND_URL?: string;
  /** Link target for the "Open in PostHog" button (defaults to https://us.posthog.com). */
  readonly VITE_POSTHOG_PROJECT_URL?: string;
  /** PostHog shared-embed URLs, one per Analytics tab. Unset = setup hint shown. */
  readonly VITE_POSTHOG_EMBED_FUNNEL?: string;
  readonly VITE_POSTHOG_EMBED_TRAFFIC?: string;
  readonly VITE_POSTHOG_EMBED_EVENTS?: string;
  readonly VITE_POSTHOG_EMBED_ACQUISITION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
