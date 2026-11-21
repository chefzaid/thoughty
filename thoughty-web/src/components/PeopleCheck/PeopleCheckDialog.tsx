import { useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useDialogFocus } from '../../hooks/useDialogFocus';
import type { TranslationFunction } from '../../types';
import { personInitials, type SharedPerson } from '../../utils/peopleCheck';
import { pluralPhrase } from '../../utils/pluralPhrase';
import type { Language } from '../../utils/translations';

/** What Replace changes: the text in an editor, a saved entry, or only an image card's text. */
export type PeopleCheckMode = 'editor' | 'saved' | 'card';

const NOTE_KEYS: Record<PeopleCheckMode, string> = {
  editor: 'peopleCheckNoteEditor',
  saved: 'peopleCheckNoteSaved',
  card: 'peopleCheckNoteCard',
};

interface PeopleCheckDialogProps {
  readonly people: readonly SharedPerson[];
  readonly mode: PeopleCheckMode;
  readonly theme: 'light' | 'dark';
  readonly language: Language;
  readonly t: TranslationFunction;
  readonly onCancel: () => void;
  readonly onShareAnyway: () => void;
  /** Each person to replace, to the words written in their place. */
  readonly onReplace: (replacements: ReadonlyMap<string, string>) => void;
}

/** The replacements offered for a person: their initials, then the neutral words of the language, each once. */
function replacementChoices(person: SharedPerson, t: TranslationFunction): Array<{ value: string; label: string }> {
  const initials = personInitials(person.name);
  const words = [...new Set([t('peopleCheckWordFeminine'), t('peopleCheckWordMasculine')])];
  return [
    ...(initials ? [{ value: initials, label: t('peopleCheckInitials', { initials }) }] : []),
    ...words.map((word) => ({ value: word, label: word })),
  ];
}

/**
 * Lists the people an entry names before it is shared, each with what to write in their place:
 * **Replace** writes the choices, **Share anyway** shares it as written.
 */
export default function PeopleCheckDialog({ people, mode, theme, language, t, onCancel, onShareAnyway, onReplace }: PeopleCheckDialogProps) {
  const choicesByKey = useMemo(() => new Map(people.map((person) => [person.key, replacementChoices(person, t)])), [people, t]);
  const [chosen, setChosen] = useState<Record<string, string>>(() => Object.fromEntries(
    people.map((person) => [person.key, choicesByKey.get(person.key)?.[0]?.value ?? '']),
  ));
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const isLight = theme === 'light';
  const replacements = new Map(Object.entries(chosen).filter(([, value]) => value !== ''));

  useDialogFocus({ isOpen: true, dialogRef, initialFocusRef: firstFieldRef, onClose: onCancel });

  const fieldClass = `h-9 min-w-0 rounded-lg border px-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 ${isLight
    ? 'border-gray-300 bg-gray-50 text-gray-900'
    : 'border-gray-700 bg-gray-900 text-gray-100'}`;
  const secondaryClass = `rounded-lg px-4 py-2 font-medium transition-colors ${isLight
    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`;
  const mutedClass = isLight ? 'text-gray-600' : 'text-gray-300';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop: a pointer target only; keyboard users cancel with Escape or the Cancel button. */}
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={`relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border p-6 shadow-2xl ${isLight ? 'border-gray-200 bg-white text-gray-900' : 'border-gray-700 bg-gray-800 text-gray-100'}`}
      >
        <h3 id={titleId} className="mb-2 text-lg font-semibold">{t('peopleCheckTitle')}</h3>
        <p id={descriptionId} className={`mb-4 text-sm ${mutedClass}`}>{t('peopleCheckIntro')}</p>
        <ul className="min-h-0 space-y-3 overflow-y-auto">
          {people.map((person, index) => (
            <li key={person.key} className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="privacy-text break-words font-medium">{person.name}</span>
                <span className={`ml-2 text-xs ${mutedClass}`}>{pluralPhrase(t, 'peopleCheckMentions', person.count, language)}</span>
              </span>
              <select
                ref={index === 0 ? firstFieldRef : undefined}
                value={chosen[person.key] ?? ''}
                onChange={(event) => setChosen((current) => ({ ...current, [person.key]: event.target.value }))}
                aria-label={t('peopleCheckReplaceWith', { name: person.name })}
                className={fieldClass}
              >
                {(choicesByKey.get(person.key) ?? []).map((choice) => (
                  <option key={choice.value} value={choice.value}>{choice.label}</option>
                ))}
                <option value="">{t('peopleCheckKeep')}</option>
              </select>
            </li>
          ))}
        </ul>
        <p className={`mt-4 text-xs ${mutedClass}`}>{t(NOTE_KEYS[mode])}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onCancel} className={secondaryClass}>{t('cancel')}</button>
          <button type="button" onClick={onShareAnyway} className={secondaryClass}>{t('peopleCheckShareAnyway')}</button>
          <button
            type="button"
            onClick={() => onReplace(replacements)}
            disabled={replacements.size === 0}
            className="rounded-lg bg-violet-700 px-4 py-2 font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('peopleCheckReplace')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
