/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** PostHog project API key (public, safe to ship in the client bundle). */
  readonly VITE_POSTHOG_KEY?: string;
  /** PostHog ingestion host, e.g. https://us.i.posthog.com or https://eu.i.posthog.com */
  readonly VITE_POSTHOG_HOST?: string;
  /** When '1' or 'true', render the V2 layout (hub home + new tool pages) by default. */
  readonly VITE_LAYOUT_V2?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
