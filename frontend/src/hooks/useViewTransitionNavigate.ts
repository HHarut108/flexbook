import { useCallback } from 'react';
import { useNavigate, type NavigateOptions, type To } from 'react-router-dom';

/**
 * Drop-in replacement for `useNavigate()` that wraps the route change in
 * `document.startViewTransition()` on browsers that support it (Chromium 111+,
 * Safari 18+). The browser takes a screenshot, runs the navigation, then
 * cross-fades to the new DOM — no animation code, no extra bytes, native paint.
 *
 *   const navigate = useViewTransitionNavigate();
 *   navigate('/flights');
 *
 * Falls back to a plain `navigate()` on browsers without the API, so the
 * behaviour is identical and safe to roll out without feature-flagging.
 *
 * Caveats:
 *  - Skips the transition if `prefers-reduced-motion: reduce` is set. The
 *    browser-native flag does this too, but it's nice to be explicit so
 *    devtools don't show stalls on motion-sensitive users.
 *  - Doesn't try to define `::view-transition-*` CSS — the default
 *    `cross-fade(0.25)` looks great everywhere we use it. Per-route
 *    polish (e.g. shared-element transitions on the FlightCard → Booking
 *    flow) can layer on top later via `view-transition-name` CSS.
 */
type DocumentWithViewTransition = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => {
    finished: Promise<void>;
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
    skipTransition: () => void;
  };
};

export function useViewTransitionNavigate() {
  const navigate = useNavigate();

  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      const doc = typeof document !== 'undefined' ? (document as DocumentWithViewTransition) : null;
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const run = () => {
        if (typeof to === 'number') navigate(to);
        else navigate(to as To, options);
      };

      if (!doc?.startViewTransition || prefersReducedMotion) {
        run();
        return;
      }

      doc.startViewTransition(run);
    },
    [navigate],
  );
}
