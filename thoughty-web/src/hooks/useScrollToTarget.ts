import { useEffect, useState } from 'react';
import type { Entry } from '../types';
import { scrollBehavior } from '../utils/motion';

/** How long an entry the journal jumped to stays highlighted. */
const TARGET_HIGHLIGHT_MS = 4000;

interface UseScrollToTargetParams {
  targetEntryId: number | null;
  /** The jump that opened the list at the target, so jumping to the same entry again scrolls to it again. */
  jump: number;
  loading: boolean;
  entries: readonly Entry[];
  /** Ends the highlight; kept the same between renders. */
  clearTarget: () => void;
}

/**
 * Once the entry the journal jumped to is on screen, scrolls it to the middle (smoothly when the system
 * allows motion), once per jump: batches loaded afterwards leave the scroll alone. When the jump took away
 * the element that had focus (a link in the entries shown before), focus moves to the entry, so it is not
 * lost. The highlight ends a few seconds later.
 */
export function useScrollToTarget({ targetEntryId, jump, loading, entries, clearTarget }: UseScrollToTargetParams): void {
  const [scrolledTo, setScrolledTo] = useState<string | null>(null);
  const key = targetEntryId ? `${jump}:${targetEntryId}` : null;

  useEffect(() => {
    if (!key || key === scrolledTo || loading || entries.length === 0) return undefined;

    const show = (element: HTMLElement) => {
      element.scrollIntoView?.({ behavior: scrollBehavior(), block: 'center' });
      const focused = document.activeElement;
      if (!focused || focused === document.body || !focused.isConnected) {
        (element.closest<HTMLElement>('article') ?? element).focus({ preventScroll: true });
      }
      setScrolledTo(key);
    };
    const find = () => document.getElementById(`entry-${targetEntryId}`);
    const element = find();
    if (element) {
      show(element);
      return undefined;
    }
    // The list can be drawn a moment after its entries arrive (the journal's code loading on a first visit)
    const observer = new MutationObserver(() => {
      const added = find();
      if (added) {
        observer.disconnect();
        show(added);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [entries, key, loading, scrolledTo, targetEntryId]);

  useEffect(() => {
    if (!scrolledTo || scrolledTo !== key) return undefined;
    const timeout = globalThis.setTimeout(clearTarget, TARGET_HIGHLIGHT_MS);
    return () => globalThis.clearTimeout(timeout);
  }, [clearTarget, key, scrolledTo]);
}
