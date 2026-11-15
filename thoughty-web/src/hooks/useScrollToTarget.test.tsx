import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useScrollToTarget } from './useScrollToTarget';
import { useLoadOnApproach } from './useLoadOnApproach';
import type { Entry } from '../types';

const entries = [{ id: 7 }] as Entry[];

describe('useScrollToTarget', () => {
  let scrollIntoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView as never;
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  const mountEntry = () => {
    const { container } = render(<article tabIndex={-1} data-testid="article"><div id="entry-7" /></article>);
    return container.querySelector('article')!;
  };

  it('scrolls to the entry once per jump, moves lost focus to it, and ends the highlight later', () => {
    const article = mountEntry();
    const clearTarget = vi.fn();
    const { rerender } = renderHook((props: { jump: number; loading: boolean }) => useScrollToTarget({
      targetEntryId: 7, jump: props.jump, loading: props.loading, entries, clearTarget,
    }), { initialProps: { jump: 1, loading: true } });
    expect(scrollIntoView).not.toHaveBeenCalled();

    rerender({ jump: 1, loading: false });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(article).toHaveFocus();

    // A batch loaded afterwards leaves the scroll alone
    rerender({ jump: 1, loading: false });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(4000));
    expect(clearTarget).toHaveBeenCalledTimes(1);

    // Jumping to the same entry again scrolls to it again
    rerender({ jump: 2, loading: false });
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it('leaves focus where it is when it is still on the page', () => {
    const article = mountEntry();
    const { container } = render(<button type="button">Kept</button>);
    const button = container.querySelector('button')!;
    button.focus();

    renderHook(() => useScrollToTarget({ targetEntryId: 7, jump: 1, loading: false, entries, clearTarget: vi.fn() }));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(button).toHaveFocus();
    expect(article).not.toHaveFocus();
  });

  it('waits for the entry to be drawn when the list comes after its entries', async () => {
    renderHook(() => useScrollToTarget({ targetEntryId: 7, jump: 1, loading: false, entries, clearTarget: vi.fn() }));
    expect(scrollIntoView).not.toHaveBeenCalled();

    mountEntry();
    await act(async () => { await Promise.resolve(); });

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});

describe('useLoadOnApproach', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads nothing by itself without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const load = vi.fn();
    const marker = { current: document.createElement('div') };

    renderHook(() => useLoadOnApproach(marker, true, load));

    expect(load).not.toHaveBeenCalled();
  });
});
