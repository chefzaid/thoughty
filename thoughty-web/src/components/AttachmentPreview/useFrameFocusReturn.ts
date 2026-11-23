import { useCallback, useEffect, useRef, type RefObject } from 'react';

/** How long after a preview frame loads focus that moves into it on its own is given back. */
export const FRAME_FOCUS_RETURN_MS = 2000;

/**
 * Chromium's PDF viewer focuses itself as it loads, so a PDF previewed beside a field takes the focus from
 * whoever is typing there: a PDF shared to the composer, or the entry just saved with one, as the writer
 * writes on. Focus that moves into the frame within a moment of its load goes back to the element that had
 * it, while that element is still on the page; after that, the frame takes focus only when it is clicked.
 * Only for an inline PDF: other frames never take focus by themselves, and a preview the reader opened
 * (the attachment dialog) may keep it.
 */
export function useFrameFocusReturn(enabled = true): { ref: RefObject<HTMLIFrameElement | null>; onLoad: () => void } {
  const ref = useRef<HTMLIFrameElement>(null);
  const loadedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    // The viewer can take focus as soon as the frame is in the page
    loadedAt.current = performance.now();
    let pending: ReturnType<typeof setTimeout> | undefined;
    const onFocusOut = (event: FocusEvent) => {
      const left = event.target;
      const frame = ref.current;
      // The viewer takes focus from outside the page, with no related target; Tab or a click into the frame names it
      if (!(left instanceof HTMLElement) || !frame || event.relatedTarget !== null) return;
      clearTimeout(pending);
      pending = setTimeout(() => {
        const justLoaded = loadedAt.current !== null && performance.now() - loadedAt.current <= FRAME_FOCUS_RETURN_MS;
        if (justLoaded && document.activeElement === frame && left.isConnected) {
          left.focus({ preventScroll: true });
        }
      }, 0);
    };
    document.addEventListener('focusout', onFocusOut);
    return () => {
      clearTimeout(pending);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, [enabled]);

  const onLoad = useCallback(() => {
    loadedAt.current = performance.now();
  }, []);

  return { ref, onLoad };
}
