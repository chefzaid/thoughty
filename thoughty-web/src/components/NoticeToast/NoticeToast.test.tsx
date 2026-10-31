import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import NoticeToast, { ACTION_NOTICE_DURATION_MS, NOTICE_DURATION_MS } from './NoticeToast';

const shown = (hide = vi.fn(), showCount = 1) => ({ visible: true, showCount, show: vi.fn(), hide });
const undo = () => ({ label: 'Undo', run: vi.fn() });

function renderToast(props: Partial<Parameters<typeof NoticeToast>[0]> = {}) {
  return render(
    <>
      <main id="main-content" tabIndex={-1}>Journal</main>
      <NoticeToast notice={shown()} text="Entry moved to the recycle bin" action={null} className="toast" {...props} />
    </>,
  );
}

describe('NoticeToast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows a plain notice as an alert that goes away after a while', () => {
    const hide = vi.fn();
    renderToast({ notice: shown(hide), text: 'Failed to delete entry.' });

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to delete entry.');
    expect(screen.getByRole('status').textContent).toBe('');
    act(() => vi.advanceTimersByTime(NOTICE_DURATION_MS));
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('announces a notice with an Undo politely, and gives it longer', () => {
    const hide = vi.fn();
    renderToast({ notice: shown(hide), action: undo() });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Entry moved to the recycle bin');
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveAccessibleDescription('Entry moved to the recycle bin');
    act(() => vi.advanceTimersByTime(NOTICE_DURATION_MS));
    expect(hide).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(ACTION_NOTICE_DURATION_MS - NOTICE_DURATION_MS));
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('runs the action and closes when Undo is pressed', () => {
    const hide = vi.fn();
    const action = undo();
    renderToast({ notice: shown(hide), action });

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(action.run).toHaveBeenCalledTimes(1);
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('takes a keyboard user to Undo, waits while they are there, and hands focus back to the page on Escape', () => {
    const hide = vi.fn();
    const action = undo();
    const { rerender } = renderToast();
    fireEvent.keyDown(document.body, { key: 'Enter' });

    rerender(
      <>
        <main id="main-content" tabIndex={-1}>Journal</main>
        <NoticeToast notice={shown(hide, 2)} text="3 entries moved to the recycle bin" action={action} className="toast" />
      </>,
    );
    const button = screen.getByRole('button', { name: 'Undo' });
    expect(button).toHaveFocus();
    act(() => vi.advanceTimersByTime(ACTION_NOTICE_DURATION_MS * 3));
    expect(hide).not.toHaveBeenCalled();

    fireEvent.keyDown(button, { key: 'Escape' });
    expect(hide).toHaveBeenCalledTimes(1);
    expect(action.run).not.toHaveBeenCalled();
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('leaves focus where it is for someone using a pointer', () => {
    const { rerender } = renderToast();
    fireEvent.pointerDown(document.body);

    rerender(
      <>
        <main id="main-content" tabIndex={-1}>Journal</main>
        <NoticeToast notice={shown(vi.fn(), 2)} text="Entry moved to the recycle bin" action={undo()} className="toast" />
      </>,
    );

    expect(screen.getByRole('button', { name: 'Undo' })).not.toHaveFocus();
  });

  it('ignores other keys and keeps focus on the page when closed without it', () => {
    const hide = vi.fn();
    renderToast({ notice: shown(hide), action: undo() });
    const main = screen.getByRole('main');

    fireEvent.keyDown(screen.getByRole('button', { name: 'Undo' }), { key: 'a' });
    expect(hide).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(ACTION_NOTICE_DURATION_MS));
    expect(hide).toHaveBeenCalledTimes(1);
    expect(main).not.toHaveFocus();
  });

  it('shows nothing while there is no notice', () => {
    renderToast({ notice: { visible: false, showCount: 0, show: vi.fn(), hide: vi.fn() }, action: undo() });

    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    expect(screen.getByRole('status').textContent).toBe('');
  });
});
