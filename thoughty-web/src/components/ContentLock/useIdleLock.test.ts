import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT_UNLOCK_IDLE_MS, useIdleLock } from './useIdleLock';

describe('useIdleLock', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('locks after 15 minutes without activity, counting from the last key or click', () => {
    const onIdle = vi.fn();
    const onActive = vi.fn();
    const { unmount } = renderHook(() => useIdleLock({ active: true, onIdle, onActive }));

    vi.advanceTimersByTime(CONTENT_UNLOCK_IDLE_MS - 1000);
    globalThis.dispatchEvent(new Event('keydown'));
    vi.advanceTimersByTime(CONTENT_UNLOCK_IDLE_MS - 1000);
    expect(onIdle).not.toHaveBeenCalled();
    // Activity after five minutes or more keeps the server's clock in step
    expect(onActive).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(onIdle).toHaveBeenCalledTimes(1);

    unmount();
    vi.advanceTimersByTime(CONTENT_UNLOCK_IDLE_MS);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('does nothing while nothing is unlocked', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleLock({ active: false, onIdle, onActive: vi.fn() }));
    vi.advanceTimersByTime(CONTENT_UNLOCK_IDLE_MS * 2);
    expect(onIdle).not.toHaveBeenCalled();
  });
});
