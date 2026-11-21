import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import type { FeedEntrySource } from '../EntriesList/entryReply';

/** The navigation state that asks the journal to take the writer to its composer (quick capture's Open in full). */
export const COMPOSER_FOCUS_STATE = { focusComposer: true } as const;

/** The navigation state that opens the journal's composer on a quote of another writer's feed entry (**Write about this**). */
export function writeAboutState(source: FeedEntrySource): { readonly writeAbout: FeedEntrySource } {
  return { writeAbout: { content: source.content, format: source.format, username: source.username } };
}

function asksForComposer(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as { focusComposer?: unknown }).focusComposer === true;
}

/** The feed entry to write about the state carries, if it is one. */
function writeAboutSource(state: unknown): FeedEntrySource | null {
  const source = typeof state === 'object' && state !== null ? (state as { writeAbout?: unknown }).writeAbout : null;
  if (typeof source !== 'object' || source === null) {
    return null;
  }
  const { content, format, username } = source as Record<string, unknown>;
  return typeof content === 'string' && typeof username === 'string' && (format === 'plain' || format === 'markdown')
    ? { content, format, username }
    : null;
}

/**
 * Scrolls to and focuses the composer when the journal was opened with `COMPOSER_FOCUS_STATE`, or fills it
 * from a feed entry when opened with `writeAboutState`, then drops that state from the history entry, so
 * Back, Forward or a reload do not do it again.
 */
export function useComposerFocusRoute(focusComposer: () => void, writeAbout?: (source: FeedEntrySource) => void): void {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = location;
  const source = useMemo(() => (writeAbout ? writeAboutSource(state) : null), [state, writeAbout]);
  const requested = source !== null || asksForComposer(state);
  const { pathname, search, hash } = location;

  useEffect(() => {
    if (!requested) {
      return;
    }
    if (source && writeAbout) {
      writeAbout(source);
    } else {
      focusComposer();
    }
    navigate({ pathname, search, hash }, { replace: true, state: null });
  }, [focusComposer, hash, navigate, pathname, requested, search, source, writeAbout]);
}
