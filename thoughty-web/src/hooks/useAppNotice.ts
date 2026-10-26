import { useCallback, useMemo, useState } from 'react';

import type { TranslationFunction } from '../types';
import type { Language } from '../utils/translations';
import { useTransientMessage, type TransientMessage } from './useTransientMessage';

/** What the entry hooks need to tell the reader how an action went, in the reader's language. */
export interface Notifier {
  /** Shows a message that is already in the reader's language in the app's notice toast. */
  readonly notify: (message: string) => void;
  readonly t: TranslationFunction;
  readonly language: Language;
}

export interface AppNotice {
  /** The toast state, which `AutoDismiss` hides again after a while. */
  readonly toast: TransientMessage;
  /** The message the toast shows. */
  readonly text: string;
  readonly notifier: Notifier;
}

/** A toast for the outcome of an entry action (a failed save or delete, a bulk summary), shown by the app layout. */
export function useAppNotice(t: TranslationFunction, language: Language): AppNotice {
  const toast = useTransientMessage();
  const [text, setText] = useState('');
  const { show } = toast;

  const notify = useCallback((message: string) => {
    setText(message);
    show();
  }, [show]);

  const notifier = useMemo(() => ({ notify, t, language }), [language, notify, t]);

  return { toast, text, notifier };
}
