import { act, render, renderHook, screen } from '@testing-library/react';
import { Suspense, lazy, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTransientMessage } from '../../hooks/useTransientMessage';
import AutoDismiss from './AutoDismiss';

describe('AutoDismiss', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('hides the message once the duration has passed since it appeared', () => {
    const { result } = renderHook(() => useTransientMessage());
    const view = () => (
      <AutoDismiss message={result.current} durationMs={3000}>
        <p>Saved</p>
      </AutoDismiss>
    );
    const { rerender } = render(view());
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();

    act(() => result.current.show());
    rerender(view());
    expect(screen.getByText('Saved')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2999));
    rerender(view());
    expect(screen.getByText('Saved')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    rerender(view());
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('restarts the countdown when the message is shown again', () => {
    const { result } = renderHook(() => useTransientMessage());
    const view = () => (
      <AutoDismiss message={result.current} durationMs={3000}>
        <p>Saved</p>
      </AutoDismiss>
    );
    const { rerender } = render(view());

    act(() => result.current.show());
    rerender(view());
    act(() => vi.advanceTimersByTime(2000));
    act(() => result.current.show());
    rerender(view());
    act(() => vi.advanceTimersByTime(2000));
    rerender(view());
    expect(screen.getByText('Saved')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    rerender(view());
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('only starts counting when the message is actually on screen', async () => {
    let resolveChunk: (module: { default: () => ReactElement }) => void = () => undefined;
    const SlowChunk = lazy(() => new Promise<{ default: () => ReactElement }>((resolve) => { resolveChunk = resolve; }));
    const hide = vi.fn();
    const message = { visible: true, showCount: 1, show: vi.fn(), hide };

    render(
      <Suspense fallback={<p>Loading</p>}>
        <SlowChunk />
        <AutoDismiss message={message} durationMs={3000}>
          <p>Not found</p>
        </AutoDismiss>
      </Suspense>,
    );
    act(() => vi.advanceTimersByTime(5000));
    expect(hide).not.toHaveBeenCalled();

    await act(async () => resolveChunk({ default: () => <p>Journal</p> }));
    expect(screen.getByText('Not found')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    expect(hide).toHaveBeenCalledTimes(1);
  });
});
