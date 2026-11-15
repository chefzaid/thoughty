import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

const ARTICLE_SELECTOR = 'article[data-entry-id]';

/** The first entry article on screen, or the first one when none is. */
function firstVisibleArticle(container: HTMLElement | null): HTMLElement | null {
  const articles = [...(container?.querySelectorAll<HTMLElement>(ARTICLE_SELECTOR) ?? [])];
  return articles.find((article) => article.getBoundingClientRect().bottom > 0) ?? articles[0] ?? null;
}

/**
 * Keeps the screen on the entries it shows while a batch comes in at either end of the list: newer entries
 * added above, or the oldest batch let go of at the other end. The first entry on screen and its place are
 * noted while the batch loads (and as the writer scrolls), and once the list has changed the page moves
 * by what changed above it. Where the browser anchors the scroll itself, nothing is left to move.
 */
export function useKeepScrollPlace(container: RefObject<HTMLElement | null>, loading: boolean, firstEntryId: number | undefined): void {
  const kept = useRef<{ id: string; top: number } | null>(null);

  useEffect(() => {
    if (!loading) return undefined;
    const remember = () => {
      const article = firstVisibleArticle(container.current);
      kept.current = article ? { id: article.dataset.entryId ?? '', top: article.getBoundingClientRect().top } : null;
    };
    remember();
    globalThis.addEventListener('scroll', remember, { passive: true });
    return () => globalThis.removeEventListener('scroll', remember);
  }, [container, loading]);

  useLayoutEffect(() => {
    const place = kept.current;
    if (!place || loading) return;
    kept.current = null;
    const article = container.current?.querySelector<HTMLElement>(`${ARTICLE_SELECTOR}[data-entry-id="${place.id}"]`);
    const moved = article ? article.getBoundingClientRect().top - place.top : 0;
    if (Math.abs(moved) > 1) globalThis.scrollBy(0, moved);
  }, [container, firstEntryId, loading]);
}
