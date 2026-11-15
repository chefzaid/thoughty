import { useEffect, type RefObject } from 'react';

/** How far ahead of the screen a list starts loading its next entries. */
const APPROACH_MARGIN = '600px 0px';

/**
 * Calls `load` when the marker comes near the screen, while `enabled`: the infinite scroll's trigger at
 * either end of a list. The observer starts over whenever `enabled` or `load` change (each load in
 * turn), so a marker still on screen after a batch loads asks for the next one. Without
 * IntersectionObserver nothing loads by itself, and the list's own buttons do it.
 */
export function useLoadOnApproach(marker: RefObject<HTMLElement | null>, enabled: boolean, load: () => void): void {
  useEffect(() => {
    const element = marker.current;
    if (!element || !enabled || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) load();
    }, { rootMargin: APPROACH_MARGIN });
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, load, marker]);
}
