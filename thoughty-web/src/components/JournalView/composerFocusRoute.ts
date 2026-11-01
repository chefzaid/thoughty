import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/** The navigation state that asks the journal to take the writer to its composer (quick capture's Open in full). */
export const COMPOSER_FOCUS_STATE = { focusComposer: true } as const;

function asksForComposer(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as { focusComposer?: unknown }).focusComposer === true;
}

/**
 * Scrolls to and focuses the composer when the journal was opened with `COMPOSER_FOCUS_STATE`, then
 * drops that state from the history entry, so Back, Forward or a reload do not move focus again.
 */
export function useComposerFocusRoute(focusComposer: () => void): void {
  const location = useLocation();
  const navigate = useNavigate();
  const requested = asksForComposer(location.state);
  const { pathname, search, hash } = location;

  useEffect(() => {
    if (!requested) {
      return;
    }
    focusComposer();
    navigate({ pathname, search, hash }, { replace: true, state: null });
  }, [focusComposer, hash, navigate, pathname, requested, search]);
}
