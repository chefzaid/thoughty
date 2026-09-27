import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
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
});
