import { useEffect, useRef } from 'react';

/**
 * Asks the browser to confirm before the page closes or reloads while `shouldWarn()` is true, as when text
 * is not saved yet. The browser shows its own message; the page's text is not used.
 */
export function useLeaveWarning(shouldWarn: () => boolean): void {
  const latest = useRef(shouldWarn);
  latest.current = shouldWarn;

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!latest.current()) return;
      event.preventDefault();
      // Older browsers still need a return value to ask
      event.returnValue = '';
    };
    globalThis.addEventListener('beforeunload', onBeforeUnload);
    return () => globalThis.removeEventListener('beforeunload', onBeforeUnload);
  }, []);
}
