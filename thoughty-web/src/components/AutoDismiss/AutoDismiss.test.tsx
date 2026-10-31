import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
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

  describe('while the reader is on the message', () => {
    const message = (hide: () => void) => ({ visible: true, showCount: 1, show: vi.fn(), hide });

    it('waits while the pointer is over it and starts over in full once it leaves', () => {
      const hide = vi.fn();
      render(
        <AutoDismiss message={message(hide)} durationMs={3000} pauseWhileEngaged>
          <p>Moved</p>
        </AutoDismiss>,
      );

      act(() => vi.advanceTimersByTime(2000));
      fireEvent.mouseEnter(screen.getByText('Moved'));
      act(() => vi.advanceTimersByTime(60_000));
      expect(hide).not.toHaveBeenCalled();

      fireEvent.mouseLeave(screen.getByText('Moved'));
      act(() => vi.advanceTimersByTime(2999));
      expect(hide).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));
      expect(hide).toHaveBeenCalledTimes(1);
    });

    it('waits while focus is inside it, also when focus moves between its controls', () => {
      const hide = vi.fn();
      render(
        <>
          <AutoDismiss message={message(hide)} durationMs={3000} pauseWhileEngaged>
            <button type="button">Undo</button>
            <button type="button">Details</button>
          </AutoDismiss>
          <button type="button">Elsewhere</button>
        </>,
      );

      act(() => screen.getByRole('button', { name: 'Undo' }).focus());
      act(() => screen.getByRole('button', { name: 'Details' }).focus());
      act(() => vi.advanceTimersByTime(60_000));
      expect(hide).not.toHaveBeenCalled();

      act(() => screen.getByRole('button', { name: 'Elsewhere' }).focus());
      act(() => vi.advanceTimersByTime(3000));
      expect(hide).toHaveBeenCalledTimes(1);
    });

    it('keeps counting through hover and focus unless asked to wait', () => {
      const hide = vi.fn();
      render(
        <AutoDismiss message={message(hide)} durationMs={3000}>
          <button type="button">Saved</button>
        </AutoDismiss>,
      );

      fireEvent.mouseEnter(screen.getByRole('button'));
      act(() => screen.getByRole('button').focus());
      act(() => vi.advanceTimersByTime(3000));
      expect(hide).toHaveBeenCalledTimes(1);
    });
  });
});
