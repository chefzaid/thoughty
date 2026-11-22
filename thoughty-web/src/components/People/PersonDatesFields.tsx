import { useEffect, useId, useState, type RefObject } from 'react';

import type { TranslationFunction } from '../../types';
import { mutedTextClass } from '../../utils/tintedText';
import { newPersonDateDraft, PERSON_DATES_MAX, type PersonDateDraft } from '../../utils/personDates';
import type { Language } from '../../utils/translations';
import PersonDateRow from './PersonDateRow';

interface PersonDatesFieldsProps {
  readonly name: string;
  readonly drafts: readonly PersonDateDraft[];
  readonly onChange: (drafts: PersonDateDraft[]) => void;
  readonly isDark: boolean;
  readonly language: Language;
  readonly t: TranslationFunction;
  /** The message about a date to announce with it, and that date's place, when there is one. */
  readonly error?: { readonly id: string; readonly index: number };
  /** The dates' fieldset, which also finds the field to focus. */
  readonly fieldsetRef: RefObject<HTMLFieldSetElement | null>;
}

/**
 * A person's important dates in the People page editor: a birthday and any anniversaries, each with what it marks,
 * added and removed in place, at most `PERSON_DATES_MAX` (dates a merge joined past it stay until changed). Adding
 * a date moves the focus to it, and removing one moves it to **Add a date**.
 */
export default function PersonDatesFields({ name, drafts, onChange, isDark, language, t, error, fieldsetRef }: PersonDatesFieldsProps) {
  const ids = { help: useId(), full: useId() };
  const [focusing, setFocusing] = useState<number | 'add' | null>(null);
  const full = drafts.length >= PERSON_DATES_MAX;
  const muted = `text-xs ${mutedTextClass(isDark)}`;

  useEffect(() => {
    const container = fieldsetRef.current;
    if (focusing === null || !container) return;
    const addButton = container.querySelector<HTMLButtonElement>('[data-person-date-add]');
    const kinds = container.querySelectorAll<HTMLElement>('[data-person-date-kind]');
    // Removing one of more dates than a save keeps leaves Add a date unavailable: the last date takes the focus
    const target = focusing === 'add'
      ? (addButton?.disabled ? kinds[kinds.length - 1] : addButton)
      : container.querySelector<HTMLElement>(`[data-person-date="${focusing}"] [data-person-date-kind]`);
    target?.focus();
    setFocusing(null);
  }, [focusing, fieldsetRef]);

  const add = () => {
    const draft = newPersonDateDraft(drafts);
    onChange([...drafts, draft]);
    setFocusing(draft.key);
  };

  const remove = (key: number) => {
    onChange(drafts.filter((draft) => draft.key !== key));
    setFocusing('add');
  };

  return (
    <fieldset ref={fieldsetRef} className="mt-3 grid gap-2" aria-describedby={ids.help}>
      <legend className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('personDatesLegend')}</legend>
      <p id={ids.help} className={muted}>{t('personDatesHelp', { name })}</p>
      {drafts.length === 0 && <p className={`text-sm ${mutedTextClass(isDark)}`}>{t('personDatesNone')}</p>}
      {drafts.map((draft, index) => (
        <PersonDateRow
          key={draft.key}
          number={index + 1}
          draft={draft}
          birthdayTaken={drafts.some((other) => other.key !== draft.key && other.kind === 'birthday')}
          onChange={(changed) => onChange(drafts.map((other) => (other.key === draft.key ? changed : other)))}
          onRemove={() => remove(draft.key)}
          isDark={isDark}
          language={language}
          t={t}
          errorId={error?.index === index ? error.id : undefined}
        />
      ))}
      <div>
        <button
          type="button"
          onClick={add}
          disabled={full}
          aria-describedby={full ? ids.full : undefined}
          data-person-date-add
          className={`h-10 rounded-lg border px-4 text-sm font-medium disabled:opacity-60 ${isDark
            ? 'border-gray-600 text-gray-200 hover:bg-gray-800'
            : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
        >
          {t('personDateAdd')}
        </button>
        {full && <p id={ids.full} className={`mt-1 ${muted}`}>{t('personDatesFull', { name, max: PERSON_DATES_MAX })}</p>}
      </div>
    </fieldset>
  );
}
