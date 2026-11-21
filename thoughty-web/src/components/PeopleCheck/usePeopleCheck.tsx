import { useCallback, useState, type ReactNode } from 'react';

import type { Person } from '../../services/api/peopleService';
import type { TranslationFunction } from '../../types';
import { findSharedPeople, rewriteSharedTexts, type SharedPerson, type SharedText } from '../../utils/peopleCheck';
import type { Language } from '../../utils/translations';
import PeopleCheckDialog, { type PeopleCheckMode } from './PeopleCheckDialog';

/** Something about to be shared, and what to do once the writer has chosen. */
export interface PeopleCheckRequest {
  readonly texts: readonly SharedText[];
  /** What Replace changes, which the dialog says. */
  readonly mode: PeopleCheckMode;
  /** Shares it as written: at once when it names no one, or on **Share anyway**. */
  readonly share: () => void;
  /** Receives the texts **Replace** changed, with their new words; nothing is shared then. */
  readonly replace: (rewritten: SharedText[]) => void;
  /** Hears that the writer closed the dialog without sharing or replacing. */
  readonly cancel?: () => void;
}

interface PeopleCheckOptions {
  /** The writer's People list, the only one read. */
  readonly people: readonly Person[];
  readonly theme: 'light' | 'dark';
  readonly language: Language;
  readonly t: TranslationFunction;
}

/**
 * Checks the people a text names before it is shared: `check` shares at once when it names no one, and
 * otherwise opens the dialog that `dialog` renders, to replace them or share anyway. Nothing about the
 * check is stored or sent.
 */
export function usePeopleCheck({ people, theme, language, t }: PeopleCheckOptions): {
  check: (request: PeopleCheckRequest) => void;
  dialog: ReactNode;
} {
  const [pending, setPending] = useState<{ request: PeopleCheckRequest; found: SharedPerson[] } | null>(null);

  const check = useCallback((request: PeopleCheckRequest) => {
    const found = findSharedPeople(request.texts, people);
    if (found.length === 0) {
      request.share();
      return;
    }
    setPending({ request, found });
  }, [people]);

  const dialog = pending && (
    <PeopleCheckDialog
      people={pending.found}
      mode={pending.request.mode}
      theme={theme}
      language={language}
      t={t}
      onCancel={() => {
        setPending(null);
        pending.request.cancel?.();
      }}
      onShareAnyway={() => {
        setPending(null);
        pending.request.share();
      }}
      onReplace={(replacements) => {
        setPending(null);
        pending.request.replace(rewriteSharedTexts(pending.request.texts, people, replacements));
      }}
    />
  );

  return { check, dialog };
}
