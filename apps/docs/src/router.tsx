import { useCallback, useEffect, useState } from 'react';

/**
 * A ~50 line History-API router.
 *
 * A docs site needs three things from routing: read the path, change it without
 * a reload, and react to the back button. React Router would do all of that and
 * bring 20 kB of matchers, loaders and data APIs this site will never use.
 */

export interface Route {
  /** Path without a trailing slash, always starting with `/`. */
  path: string;
  /** The `#fragment`, without the hash. Empty string when absent. */
  hash: string;
}

function read(): Route {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return { path, hash: window.location.hash.replace(/^#/, '') };
}

const listeners = new Set<() => void>();

function announce() {
  for (const listener of listeners) listener();
}

/** Navigate without reloading. Ignored when the target is the current URL. */
export function navigate(to: string, options: { replace?: boolean } = {}): void {
  const url = new URL(to, window.location.origin);
  const same =
    url.pathname === window.location.pathname && url.hash === window.location.hash;
  if (same) return;

  if (options.replace) {
    window.history.replaceState({}, '', url);
  } else {
    window.history.pushState({}, '', url);
  }
  announce();
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => read());

  useEffect(() => {
    const update = () => setRoute(read());
    listeners.add(update);
    window.addEventListener('popstate', update);
    return () => {
      listeners.delete(update);
      window.removeEventListener('popstate', update);
    };
  }, []);

  return route;
}

/**
 * An internal link that routes client-side.
 *
 * Modifier clicks, middle clicks and `target` are left to the browser, so
 * "open in new tab" keeps working — the most commonly broken thing in
 * hand-rolled SPA links.
 */
export function Link({
  href,
  children,
  className,
  onNavigate,
  ...rest
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onNavigate?: () => void;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        rest.target
      ) {
        return;
      }
      event.preventDefault();
      navigate(href);
      onNavigate?.();
    },
    [href, onNavigate, rest.target],
  );

  return (
    <a href={href} className={className} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
