import { useEffect, useRef, type RefObject } from 'react';
import { scrollBehavior } from '../../utils/motion';
import { isEditableTarget } from './useJournalKeyboardShortcuts';

/** Widgets that use the arrow keys themselves; the journal leaves the keys to them. */
const ARROW_KEY_WIDGETS = '[role="dialog"], [role="menu"], [role="menubar"], [role="listbox"], [role="grid"], '
  + '[role="radiogroup"], [role="tablist"], [role="tree"], [role="slider"], [role="toolbar"]';

const ARTICLE_SELECTOR = 'article[data-entry-id]';

interface UseFeedKeyboardParams {
  /** The element holding the feed's articles. */
  container: RefObject<HTMLElement | null>;
  /** The ids of the entries shown, in order, so a move waiting for a batch finds its place once it arrives. */
  entryIds: readonly number[];
  hasOlder: boolean;
  hasNewer: boolean;
  loadOlder: () => void;
  loadNewer: () => void;
}

function articlesIn(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(ARTICLE_SELECTOR)];
}

/** The article holding focus, or else the first one on screen. */
function currentArticle(articles: HTMLElement[]): { index: number; focused: boolean } {
  const focused = articles.findIndex((article) => article.contains(document.activeElement));
  if (focused >= 0) return { index: focused, focused: true };
  const onScreen = articles.findIndex((article) => article.getBoundingClientRect().bottom > 0);
  return { index: Math.max(0, onScreen), focused: false };
}

function showArticle(article: HTMLElement): void {
  article.focus({ preventScroll: true });
  article.scrollIntoView?.({ behavior: scrollBehavior(), block: 'start' });
}

/**
 * The journal's arrow keys: Right (or Page Down inside the list) moves focus to the next entry and Left (or
 * Page Up) to the one before, across every loaded batch. At either end of what is loaded, the next batch is
 * asked for and focus moves on once it arrives. The keys are left alone while typing, with a modifier, or
 * inside a widget that uses them (a dialog, a menu, the calendar).
 */
export function useFeedKeyboard({ container, entryIds, hasOlder, hasNewer, loadOlder, loadNewer }: UseFeedKeyboardParams): void {
  /** A move waiting for a batch: from which entry, and which way. */
  const pending = useRef<{ fromId: string; step: 1 | -1 } | null>(null);
  const latest = useRef({ hasOlder, hasNewer, loadOlder, loadNewer });
  useEffect(() => {
    latest.current = { hasOlder, hasNewer, loadOlder, loadNewer };
  }, [hasNewer, hasOlder, loadNewer, loadOlder]);

  useEffect(() => {
    const move = (step: 1 | -1): boolean => {
      const element = container.current;
      if (!element) return false;
      const articles = articlesIn(element);
      if (articles.length === 0) return false;
      const { index, focused } = currentArticle(articles);
      const target = focused ? articles[index + step] : articles[index];
      if (target) {
        showArticle(target);
        return true;
      }
      const { hasOlder: older, hasNewer: newer, loadOlder: loadNext, loadNewer: loadPrevious } = latest.current;
      if (step === 1 ? !older : !newer) return false;
      pending.current = { fromId: articles[index]!.dataset.entryId ?? '', step };
      (step === 1 ? loadNext : loadPrevious)();
      return true;
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (isEditableTarget(target) || target?.closest(ARROW_KEY_WIDGETS)) return;
      const inFeed = Boolean(target?.closest(ARTICLE_SELECTOR) && container.current?.contains(target));
      let step: 1 | -1 | null = null;
      if (event.key === 'ArrowRight' || (inFeed && event.key === 'PageDown')) step = 1;
      if (event.key === 'ArrowLeft' || (inFeed && event.key === 'PageUp')) step = -1;
      if (step !== null && move(step)) event.preventDefault();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [container]);

  // Once the batch a move waited for has arrived, focus goes on from where it was; the move is dropped
  // when its entry is gone or nothing more is left that way
  useEffect(() => {
    const waiting = pending.current;
    const element = container.current;
    if (!waiting || !element) return;
    const articles = articlesIn(element);
    const from = articles.findIndex((article) => article.dataset.entryId === waiting.fromId);
    const target = from >= 0 ? articles[from + waiting.step] : undefined;
    const exhausted = waiting.step === 1 ? !hasOlder : !hasNewer;
    if (target || from < 0 || exhausted) pending.current = null;
    if (target) showArticle(target);
  }, [container, entryIds, hasNewer, hasOlder]);
}
