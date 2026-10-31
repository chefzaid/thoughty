import { useCallback, useMemo, useState } from 'react';

import type { TranslationFunction } from '../types';
import type { Language } from '../utils/translations';
import { useTransientMessage, type TransientMessage } from './useTransientMessage';

/** A button the notice offers next to its message, such as Undo after a delete. */
export interface NoticeAction {
  readonly label: string;
  readonly run: () => void;
}

/** What the entry hooks need to tell the reader how an action went, in the reader's language. */
export interface Notifier {
  /** Shows a message that is already in the reader's language in the app's notice toast, with an optional action. */
  readonly notify: (message: string, action?: NoticeAction) => void;
  readonly t: TranslationFunction;
  readonly language: Language;
}

export interface AppNotice {
  /** The toast state, which `AutoDismiss` hides again after a while. */
  readonly toast: TransientMessage;
  /** The message the toast shows. */
  readonly text: string;
  /** The button the toast shows with the message, if any. */
  readonly action: NoticeAction | null;
  readonly notifier: Notifier;
}

/** A toast for the outcome of an entry action (a failed save or delete, a bulk summary, an undo), shown by the app layout. */
export function useAppNotice(t: TranslationFunction, language: Language): AppNotice {
  const toast = useTransientMessage();
  const [text, setText] = useState('');
  const [action, setAction] = useState<NoticeAction | null>(null);
  const { show } = toast;

  const notify = useCallback((message: string, nextAction?: NoticeAction) => {
    setText(message);
    setAction(nextAction ?? null);
    show();
  }, [show]);

  const notifier = useMemo(() => ({ notify, t, language }), [language, notify, t]);

  return { toast, text, action, notifier };
}
