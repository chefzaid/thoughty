import { useEffect, useRef, type RefObject } from 'react';

export function useRouteChangeFocus(
  routeKey: string,
  targetRef: RefObject<HTMLElement | null>,
): void {
  const previousRouteRef = useRef(routeKey);

  useEffect(() => {
    if (previousRouteRef.current !== routeKey) {
      targetRef.current?.focus();
    }
    previousRouteRef.current = routeKey;
  }, [routeKey, targetRef]);
}
