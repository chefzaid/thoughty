import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import AttachmentPreviewContent from './AttachmentPreviewContent';
import { FRAME_FOCUS_RETURN_MS } from './useFrameFocusReturn';

type Variant = 'compact' | 'detail' | 'modal';

function Composer({ variant = 'compact', showField = true, mimetype = 'application/pdf' }: Readonly<{ variant?: Variant; showField?: boolean; mimetype?: string }>) {
  return (
    <div>
      {showField && <textarea aria-label="Entry" defaultValue="Morning pages" />}
      <AttachmentPreviewContent name="scan.pdf" mimetype={mimetype} sourceUrl="blob:scan" variant={variant} t={(key) => key} />
    </div>
  );
}

/**
 * The frame takes the focus from the field. With `fromOutside`, as the PDF viewer does: from another process,
 * so the field loses it with no related target; otherwise as Tab or a click does, naming the frame.
 */
function frameTakesFocus(field: HTMLElement, frame: HTMLElement, fromOutside: boolean) {
  act(() => frame.focus());
  if (fromOutside) act(() => { field.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null })); });
}

/** The writer is in the composer when the PDF viewer, loading, takes the focus. */
async function viewerTakesFocus(fromOutside = true) {
  const field = screen.getByLabelText('Entry');
  const frame = screen.getByTitle('scan.pdf');
  act(() => field.focus());
  frameTakesFocus(field, frame, fromOutside);
  await act(async () => { await vi.runOnlyPendingTimersAsync(); });
  return { field, frame };
}

describe('useFrameFocusReturn', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(['compact', 'detail'] as const)('gives the focus back to the field a loading %s PDF preview took it from', async (variant) => {
    render(<Composer variant={variant} />);
    fireEvent.load(screen.getByTitle('scan.pdf'));

    const { field } = await viewerTakesFocus();

    expect(field).toHaveFocus();
  });

  it('leaves the focus in a preview the writer moves to once it has loaded a while', async () => {
    render(<Composer />);
    fireEvent.load(screen.getByTitle('scan.pdf'));
    vi.advanceTimersByTime(FRAME_FOCUS_RETURN_MS + 1);

    const { frame } = await viewerTakesFocus();

    expect(frame).toHaveFocus();
  });

  it('leaves the focus in a PDF preview the writer moves to with Tab or a click', async () => {
    render(<Composer />);
    fireEvent.load(screen.getByTitle('scan.pdf'));

    const { frame } = await viewerTakesFocus(false);

    expect(frame).toHaveFocus();
  });

  it('leaves the focus in a text file preview, which never takes it by itself', async () => {
    render(<Composer mimetype="text/plain" />);
    fireEvent.load(screen.getByTitle('scan.pdf'));

    const { frame } = await viewerTakesFocus();

    expect(frame).toHaveFocus();
  });

  it('leaves the focus in the preview the reader opened', async () => {
    render(<Composer variant="modal" />);

    const { frame } = await viewerTakesFocus();

    expect(frame).toHaveFocus();
  });

  it('ignores focus moving between other elements of the page', async () => {
    render(
      <>
        <Composer />
        <button type="button">Save</button>
      </>,
    );
    fireEvent.load(screen.getByTitle('scan.pdf'));
    act(() => screen.getByLabelText('Entry').focus());
    act(() => screen.getByRole('button', { name: 'Save' }).focus());
    await act(async () => { await vi.runOnlyPendingTimersAsync(); });

    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
  });

  it('keeps the focus in the preview when the field it left is gone', async () => {
    const { rerender } = render(<Composer />);
    const frame = screen.getByTitle('scan.pdf');
    const field = screen.getByLabelText('Entry');
    act(() => field.focus());
    frameTakesFocus(field, frame, true);
    rerender(<Composer showField={false} />);
    await act(async () => { await vi.runOnlyPendingTimersAsync(); });

    expect(frame).toHaveFocus();
  });
});
