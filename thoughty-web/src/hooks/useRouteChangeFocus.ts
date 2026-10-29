import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * On a route change the new page opens at its top, as a page load would, whatever its height, and
 * keyboard and screen-reader focus moves to its content without scrolling there. A link to a place
 * in a page (`/profile#life-eras`, an entry permalink, a memoir question) still lands on it: those
 * pages scroll in their own effects, which run after this layout effect.
 */
export function useRouteChangeFocus(
  routeKey: string,
  targetRef: RefObject<HTMLElement | null>,
): void {
  const previousRouteRef = useRef(routeKey);

  useLayoutEffect(() => {
    if (previousRouteRef.current !== routeKey) {
      if (!globalThis.location.hash) {
        globalThis.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
      targetRef.current?.focus({ preventScroll: true });
    }
    previousRouteRef.current = routeKey;
  }, [routeKey, targetRef]);
}
