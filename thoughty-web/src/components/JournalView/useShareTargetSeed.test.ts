import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SHARED_CONTENT_STORAGE_KEY } from '../../utils/shareTarget';
import { useShareTargetSeed } from './useShareTargetSeed';

describe('useShareTargetSeed', () => {
  beforeEach(() => sessionStorage.clear());

  it('waits for the draft, then fills the composer with what was shared, once', () => {
    sessionStorage.setItem(SHARED_CONTENT_STORAGE_KEY, JSON.stringify({ title: 'Tides', text: 'High tide' }));
    const shareInto = vi.fn();
    const { rerender } = renderHook(({ ready }) => useShareTargetSeed(ready, shareInto), { initialProps: { ready: false } });
    expect(shareInto).not.toHaveBeenCalled();

    rerender({ ready: true });
    expect(shareInto).toHaveBeenCalledWith({ title: 'Tides', text: 'High tide' });
    expect(sessionStorage.getItem(SHARED_CONTENT_STORAGE_KEY)).toBeNull();

    rerender({ ready: false });
    rerender({ ready: true });
    expect(shareInto).toHaveBeenCalledTimes(1);
  });

  it('leaves the composer alone when nothing was shared', () => {
    const shareInto = vi.fn();
    renderHook(() => useShareTargetSeed(true, shareInto));
    expect(shareInto).not.toHaveBeenCalled();
  });
});
