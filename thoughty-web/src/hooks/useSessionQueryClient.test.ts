import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSessionQueryClient } from './useSessionQueryClient';

describe('useSessionQueryClient', () => {
  it('keeps one cache through a session and hands out an empty one when the session ends', () => {
    const hook = renderHook(({ sessionKey }) => useSessionQueryClient(sessionKey), { initialProps: { sessionKey: 0 } });
    const first = hook.result.current;
    first.setQueryData(['app', 'config'], { theme: 'light' });
    first.setQueryData(['app', 'entries'], [{ id: 1, content: 'Ada’s entry' }]);
    const cancel = vi.spyOn(first, 'cancelQueries');

    hook.rerender({ sessionKey: 0 });
    expect(hook.result.current).toBe(first);
    expect(cancel).not.toHaveBeenCalled();

    hook.rerender({ sessionKey: 1 });
    const second = hook.result.current;
    expect(second).not.toBe(first);
    expect(second.getQueryCache().getAll()).toEqual([]);
    expect(cancel).toHaveBeenCalled();
    expect(first.getQueryCache().getAll()).toEqual([]);
    expect(second.getDefaultOptions().queries).toMatchObject({ retry: 1, refetchOnWindowFocus: false });

    // A request that outlived the session writes into the old cache, which nothing reads
    first.setQueryData(['app', 'entries'], [{ id: 1, content: 'Ada’s entry' }]);
    expect(second.getQueryData(['app', 'entries'])).toBeUndefined();
  });
});

describe('useSessionQueryClient › a session back from offline', () => {
  it('reads everything again once the session is back, and not before', () => {
    const hook = renderHook(({ offline }) => useSessionQueryClient(0, offline), { initialProps: { offline: true } });
    const invalidate = vi.spyOn(hook.result.current, 'invalidateQueries');

    hook.rerender({ offline: true });
    expect(invalidate).not.toHaveBeenCalled();

    hook.rerender({ offline: false });
    expect(invalidate).toHaveBeenCalledTimes(1);

    hook.rerender({ offline: false });
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});
