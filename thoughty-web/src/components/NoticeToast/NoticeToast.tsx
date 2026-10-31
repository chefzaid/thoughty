import { useEffect, useId, useRef, type KeyboardEvent } from 'react';

import AutoDismiss from '../AutoDismiss/AutoDismiss';
import type { NoticeAction } from '../../hooks/useAppNotice';
import { useKeyboardModality } from '../../hooks/useKeyboardModality';
import type { TransientMessage } from '../../hooks/useTransientMessage';
import { tintedTextClass } from '../../utils/tintedText';

/** How long a plain notice stays, and a notice with an action (Undo) that the reader may want to reach. */
export const NOTICE_DURATION_MS = 6000;
export const ACTION_NOTICE_DURATION_MS = 10000;

interface NoticeToastProps {
  readonly notice: TransientMessage;
  readonly text: string;
  readonly action: NoticeAction | null;
  readonly theme?: 'light' | 'dark';
  /** The toast box (border, background, padding) shared with the app's other toasts. */
  readonly className: string;
}

/** Hands focus back to the page when the toast that held it goes away. */
const focusMainContent = () => document.getElementById('main-content')?.focus();

function ActionNotice({ text, action, theme, className, onDismiss, usingKeyboard }: Readonly<{
  text: string;
  action: NoticeAction;
  theme?: 'light' | 'dark';
  className: string;
  onDismiss: () => void;
  usingKeyboard: () => boolean;
}>) {
  const boxRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const textId = useId();

  // Someone on the keyboard lands on the action: what they were on (the entry, the bulk bar) is gone
  useEffect(() => {
    if (usingKeyboard()) buttonRef.current?.focus();
  }, [usingKeyboard]);

  const dismiss = () => {
    const hadFocus = boxRef.current?.contains(document.activeElement) ?? false;
    onDismiss();
    if (hadFocus) focusMainContent();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    dismiss();
  };

  const isLight = theme === 'light';
  return (
    // Escape closes the toast while focus is on its button; the div itself takes no focus
    <div ref={boxRef} className={`${className} flex items-center justify-between gap-4`} onKeyDown={handleKeyDown}>
      <p id={textId} className="text-sm font-medium">{text}</p>
      <button
        ref={buttonRef}
        type="button"
        aria-describedby={textId}
        onClick={() => {
          dismiss();
          action.run();
        }}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${tintedTextClass('amber', theme)} ${isLight ? 'hover:bg-amber-50' : 'hover:bg-amber-400/10'}`}
      >
        {action.label}
      </button>
    </div>
  );
}

/**
 * The app's notice toast. A plain notice is an alert; one with an action (Undo after a delete) is a status
 * message, announced politely through a live region that stays in the page, and it waits while the pointer
 * or focus is on it. Escape closes it, and a keyboard user is taken to its action.
 */
function NoticeToast({ notice, text, action, theme, className }: NoticeToastProps) {
  const usingKeyboard = useKeyboardModality();

  return (
    <>
      <p role="status" className="sr-only">
        <span key={notice.showCount}>{notice.visible && action ? text : ''}</span>
      </p>
      <AutoDismiss
        message={notice}
        durationMs={action ? ACTION_NOTICE_DURATION_MS : NOTICE_DURATION_MS}
        pauseWhileEngaged
      >
        {action ? (
          <ActionNotice
            text={text}
            action={action}
            theme={theme}
            className={className}
            onDismiss={notice.hide}
            usingKeyboard={usingKeyboard}
          />
        ) : (
          <div role="alert" aria-live="assertive" className={className}>
            <p className="text-sm font-medium">{text}</p>
          </div>
        )}
      </AutoDismiss>
    </>
  );
}

export default NoticeToast;
