import { useEffect, useState, type RefObject } from 'react';

import type { ReadingBook } from './readingBookTypes';

/** The open section's paragraphs, read again whenever the section changes; null while they load. */
export function useSectionText(book: ReadingBook, index: number): { paragraphs: string[] | null; failed: boolean } {
  const [state, setState] = useState<{ index: number; paragraphs: string[] | null; failed: boolean }>({ index, paragraphs: null, failed: false });

  useEffect(() => {
    let current = true;
    setState({ index, paragraphs: null, failed: false });
    book.readSection(index).then(
      (paragraphs) => { if (current) setState({ index, paragraphs, failed: false }); },
      (error: unknown) => {
        console.error('Could not read the page:', error);
        if (current) setState({ index, paragraphs: [], failed: true });
      },
    );
    return () => {
      current = false;
    };
  }, [book, index]);

  return state.index === index ? state : { paragraphs: null, failed: false };
}

/** The text the reader has selected inside `containerRef`, kept while they reach for the button that uses it. */
export function useSelectedText(containerRef: RefObject<HTMLElement | null>): string {
  const [selected, setSelected] = useState('');

  useEffect(() => {
    const update = () => {
      const selection = document.getSelection();
      const container = containerRef.current;
      const inside = selection && selection.rangeCount > 0 && container
        && container.contains(selection.anchorNode) && container.contains(selection.focusNode);
      setSelected(inside ? selection.toString().trim() : '');
    };
    document.addEventListener('selectionchange', update);
    return () => document.removeEventListener('selectionchange', update);
  }, [containerRef]);

  return selected;
}
