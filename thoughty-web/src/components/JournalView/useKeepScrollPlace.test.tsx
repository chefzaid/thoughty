import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useKeepScrollPlace } from './useKeepScrollPlace';

/** An article whose place on screen the test sets. */
function article(id: number, top: number): HTMLElement {
  const element = document.createElement('article');
  element.dataset.entryId = String(id);
  element.getBoundingClientRect = () => ({ top, bottom: top + 100 }) as DOMRect;
  return element;
}

describe('useKeepScrollPlace', () => {
  afterEach(() => vi.restoreAllMocks());

  it('moves the page by what changed above the first entry on screen once a batch has come', () => {
    const container = document.createElement('div');
    container.append(article(1, -300), article(2, 40));
    const scrollBy = vi.spyOn(globalThis, 'scrollBy').mockImplementation(() => {});
    const { rerender } = renderHook((props: { loading: boolean; first: number }) => useKeepScrollPlace({ current: container }, props.loading, props.first), {
      initialProps: { loading: false, first: 1 },
    });

    rerender({ loading: true, first: 1 });
    // Newer entries came above: the entry on screen was pushed down by 500px
    container.replaceChildren(article(0, -800), article(1, 200), article(2, 540));
    rerender({ loading: false, first: 0 });

    expect(scrollBy).toHaveBeenCalledWith(0, 500);
  });

  it('leaves the page alone when nothing moved, as when the browser anchored the scroll itself', () => {
    const container = document.createElement('div');
    container.append(article(1, 40));
    const scrollBy = vi.spyOn(globalThis, 'scrollBy').mockImplementation(() => {});
    const { rerender } = renderHook((props: { loading: boolean }) => useKeepScrollPlace({ current: container }, props.loading, 1), {
      initialProps: { loading: true },
    });

    rerender({ loading: false });

    expect(scrollBy).not.toHaveBeenCalled();
  });
});
