import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { useViewTransitionNavigate } from '../hooks/useViewTransitionNavigate';

/**
 * Drop-in `<Link>` replacement that runs the navigation through
 * `document.startViewTransition()` where supported. Same prop shape as
 * react-router-dom's `<Link>`, so it's safe to swap in for the highest-
 * leverage CTAs without changing surrounding JSX.
 *
 * Why not just patch `useNavigate`? `<Link>` clicks don't go through the
 * `useNavigate` hook — they call `history.push` inside react-router. We
 * intercept the click before react-router sees it, prevent the default
 * navigation, and route through our view-transition wrapper instead.
 *
 * Modifier-clicks (cmd/ctrl/middle-click, right-click for "open in new
 * tab", etc.) fall through to the native anchor behaviour unchanged.
 */
export const ViewTransitionLink = forwardRef<
  HTMLAnchorElement,
  LinkProps & AnchorHTMLAttributes<HTMLAnchorElement>
>(function ViewTransitionLink({ to, replace, state, onClick, ...rest }, ref) {
  const navigate = useViewTransitionNavigate();

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented) return;
    // Let the browser handle anything that isn't a plain left-click.
    if (
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      (rest.target && rest.target !== '_self')
    ) {
      return;
    }
    e.preventDefault();
    navigate(to, { replace, state });
  }

  return <Link ref={ref} to={to} onClick={handleClick} {...rest} />;
});
