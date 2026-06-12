import { useEffect } from 'react';

/**
 * Minimal native replacement for `<Helmet><title>...</title></Helmet>`.
 *
 * - Writes `document.title` whenever `title` changes.
 * - On unmount, restores the previous title so popping back from a deep
 *   route doesn't leave the browser tab showing yesterday's screen title.
 * - SSR-safe: bails out when `document` isn't defined (matters for tests
 *   that run under jsdom but ssr-mode imports).
 *
 * Usage:
 *   useDocumentTitle(`Stay in ${destinationCity} · Flexbook`);
 *
 * Why not Helmet? `react-helmet-async` ships ~12 KB and pulls in
 * `react-fast-compare` + its own context. For this app — which only ever
 * writes <title> and a single <meta name="description"> on a handful of
 * screens — that's pure overhead. A 5-line hook covers 100 % of the use
 * cases without the runtime cost.
 */
export function useDocumentTitle(title: string | undefined | null): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!title) return;
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

/**
 * Generic `<meta>` updater keyed by either `name` (HTML standard meta) or
 * `property` (Open Graph and friends). Creates the tag lazily and restores
 * the previous content on unmount.
 *
 * Pass `null`/`undefined` content to skip the effect entirely.
 */
export function useDocumentMeta(
  key: { name: string } | { property: string },
  content: string | undefined | null,
): void {
  const attr = 'name' in key ? 'name' : 'property';
  const value = 'name' in key ? key.name : key.property;
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!content) return;
    const selector = `meta[${attr}="${value}"]`;
    let tag = document.querySelector<HTMLMetaElement>(selector);
    let created = false;
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute(attr, value);
      document.head.appendChild(tag);
      created = true;
    }
    const previous = tag.getAttribute('content') ?? '';
    tag.setAttribute('content', content);
    return () => {
      if (created) {
        tag?.remove();
      } else {
        tag?.setAttribute('content', previous);
      }
    };
  }, [attr, value, content]);
}

/** Convenience wrapper for the by-far-most-common meta tag. */
export function useMetaDescription(description: string | undefined | null): void {
  useDocumentMeta({ name: 'description' }, description);
}
