import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useDialogFocus } from './useDialogFocus';

function Dialog({ onClose }: Readonly<{ onClose: () => void }>) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useDialogFocus({ isOpen: true, dialogRef, initialFocusRef: closeRef, onClose });

  return (
    <div ref={dialogRef} role="dialog" aria-label="Example">
      <button ref={closeRef} type="button">Close</button>
      <button type="button">Middle</button>
      <button type="button">Last</button>
    </div>
  );
}

function MediaDialog() {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useDialogFocus({ isOpen: true, dialogRef, initialFocusRef: closeRef, onClose: vi.fn() });

  return (
    <div ref={dialogRef} role="dialog" aria-label="Preview">
      <button ref={closeRef} type="button">Close</button>
      <iframe title="Document" />
    </div>
  );
}

function StackedDialog({ name, onClose, children }: Readonly<{ name: string; onClose: () => void; children?: ReactNode }>) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useDialogFocus({ isOpen: true, dialogRef, initialFocusRef: closeRef, onClose });

  return (
    <div ref={dialogRef} role="dialog" aria-label={name}>
      <button ref={closeRef} type="button" onClick={onClose}>{`Close ${name}`}</button>
      {children}
    </div>
  );
}

function StackedPage({ onCloseLower, onCloseUpper }: Readonly<{ onCloseLower: () => void; onCloseUpper: () => void }>) {
  const [upperOpen, setUpperOpen] = useState(false);
  return (
    <StackedDialog name="Lower" onClose={onCloseLower}>
      <button type="button" onClick={() => setUpperOpen(true)}>Open upper</button>
      {upperOpen && (
        <StackedDialog name="Upper" onClose={() => { onCloseUpper(); setUpperOpen(false); }}>
          <button type="button">Upper last</button>
        </StackedDialog>
      )}
    </StackedDialog>
  );
}

function Page({ onClose = vi.fn() }: Readonly<{ onClose?: () => void }>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      <button type="button">Behind</button>
      {open && <Dialog onClose={() => { onClose(); setOpen(false); }} />}
    </>
  );
}

describe('useDialogFocus', () => {
  it('moves focus into the dialog and keeps Tab inside it', () => {
    render(<Page />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();
    fireEvent.click(trigger);

    const close = screen.getByRole('button', { name: 'Close' });
    const last = screen.getByRole('button', { name: 'Last' });
    expect(close).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(close).toHaveFocus();
  });

  it('pulls focus back in when it escaped the dialog', () => {
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    screen.getByRole('button', { name: 'Behind' }).focus();

    fireEvent.keyDown(document, { key: 'Tab' });

    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('closes on Escape and returns focus to the trigger', () => {
    const onClose = vi.fn();
    render(<Page onClose={onClose} />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();
    fireEvent.click(trigger);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('counts embedded documents as the ends of the cycle', () => {
    render(<MediaDialog />);
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

    expect(screen.getByTitle('Document')).toHaveFocus();
  });

  it('brings focus back in from the guards around the dialog, at the matching end', () => {
    render(<MediaDialog />);
    const dialog = screen.getByRole('dialog');
    const start = dialog.previousElementSibling as HTMLElement;
    const end = dialog.nextElementSibling as HTMLElement;
    expect(start).toHaveAttribute('data-dialog-focus-guard', 'start');
    expect(end).toHaveAttribute('data-dialog-focus-guard', 'end');

    // Tab out of the frame's own document lands on the guard after the dialog.
    end.focus();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    start.focus();
    expect(screen.getByTitle('Document')).toHaveFocus();
  });

  it('pulls focus moving behind the dialog straight back in', () => {
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    // Before the dialog in the page: the user went backwards, so the cycle resumes at its end.
    screen.getByRole('button', { name: 'Behind' }).focus();

    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
  });

  it('removes its guards when it closes', () => {
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(document.querySelectorAll('[data-dialog-focus-guard]')).toHaveLength(2);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(document.querySelectorAll('[data-dialog-focus-guard]')).toHaveLength(0);
  });

  it('lets only the topmost of stacked dialogs handle the keyboard and focus', () => {
    const onCloseLower = vi.fn();
    const onCloseUpper = vi.fn();
    render(<StackedPage onCloseLower={onCloseLower} onCloseUpper={onCloseUpper} />);
    const openUpper = screen.getByRole('button', { name: 'Open upper' });
    openUpper.focus();
    fireEvent.click(openUpper);

    const closeUpper = screen.getByRole('button', { name: 'Close Upper' });
    const upperLast = screen.getByRole('button', { name: 'Upper last' });
    expect(closeUpper).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(upperLast).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeUpper).toHaveFocus();
    screen.getByRole('button', { name: 'Close Lower' }).focus();
    expect(upperLast).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCloseUpper).toHaveBeenCalledTimes(1);
    expect(onCloseLower).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Upper' })).not.toBeInTheDocument();
    expect(openUpper).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCloseLower).toHaveBeenCalledTimes(1);
  });
});
