import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';

import './WriterMenu.css';

type Translate = (key: string, params?: Record<string, string | number>) => string;

interface WriterMenuProps {
  readonly username: string;
  readonly disabled?: boolean;
  readonly onMute: () => void;
  readonly onBlock: () => void;
  readonly t: Translate;
}

/** **Mute** and **Block** for another writer, behind a "more" button beside their name in the feed. */
function WriterMenu({ username, disabled = false, onMute, onBlock, t }: WriterMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const label = t('writerMenu', { username });

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => document.removeEventListener('mousedown', closeOutside);
  }, [open]);

  const closeOnBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!menuRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
  };

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    items[(current + step + items.length) % items.length]?.focus();
  };

  // The item goes with the menu, so focus goes back to the button before the action (or its dialog) runs
  const choose = (action: () => void) => {
    triggerRef.current?.focus();
    setOpen(false);
    action();
  };

  return (
    <div
      className="feed-writer-menu"
      ref={menuRef}
      onKeyDown={open ? moveFocus : undefined}
      onBlur={open ? closeOnBlur : undefined}
    >
      <button
        type="button"
        ref={triggerRef}
        className="feed-writer-menu-button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="codicon codicon-ellipsis" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" aria-label={label} className="feed-writer-menu-list">
          <button type="button" role="menuitem" onClick={() => choose(onMute)}>
            <span className="codicon codicon-mute" aria-hidden="true" />
            {t('muteWriter', { username })}
          </button>
          <button type="button" role="menuitem" className="danger" onClick={() => choose(onBlock)}>
            <span className="codicon codicon-circle-slash" aria-hidden="true" />
            {t('blockWriter', { username })}
          </button>
        </div>
      )}
    </div>
  );
}

export default WriterMenu;
