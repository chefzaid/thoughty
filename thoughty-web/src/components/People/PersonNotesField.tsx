import { useId, type Ref } from 'react';

import type { TranslationFunction } from '../../types';
import { mutedTextClass } from '../../utils/tintedText';
import type { Language } from '../../utils/translations';

/** The longest notes the server saves on a person. */
export const PERSON_NOTES_MAX_LENGTH = 2000;

interface PersonNotesFieldProps {
  readonly name: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly isDark: boolean;
  readonly language: Language;
  readonly t: TranslationFunction;
  /** The id of the message about the notes to announce with them, when there is one. */
  readonly errorId?: string;
  readonly textareaRef?: Ref<HTMLTextAreaElement>;
}

/**
 * The writer's own notes on a person in the People page editor, blurred with the privacy blur like entry text.
 * Notes joined by a merge can be longer than a save accepts: the field then keeps them for the writer to shorten.
 */
export default function PersonNotesField({ name, value, onChange, isDark, language, t, errorId, textareaRef }: PersonNotesFieldProps) {
  const ids = { field: useId(), help: useId(), length: useId() };
  const format = (count: number) => count.toLocaleString(language);
  const tooLong = value.trim().length > PERSON_NOTES_MAX_LENGTH;

  return (
    <div className="mt-3">
      <label htmlFor={ids.field} className={`mb-1 block text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
        {t('personNotesLabel')}
      </label>
      <p id={ids.help} className={`mb-1 text-xs ${mutedTextClass(isDark)}`}>{t('personNotesHelp', { name })}</p>
      <textarea
        ref={textareaRef}
        id={ids.field}
        value={value}
        rows={4}
        maxLength={Math.max(PERSON_NOTES_MAX_LENGTH, value.length)}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={errorId ? true : undefined}
        aria-describedby={[ids.help, ids.length, errorId].filter(Boolean).join(' ')}
        className={`privacy-text w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 ${isDark
          ? 'border-gray-700 bg-gray-900 text-gray-100'
          : 'border-gray-300 bg-gray-50 text-gray-900'}`}
      />
      <p id={ids.length} className={`text-right text-xs ${tooLong ? (isDark ? 'text-red-300' : 'text-red-700') : mutedTextClass(isDark)}`}>
        {t('personNotesLength', { count: format(value.trim().length), max: format(PERSON_NOTES_MAX_LENGTH) })}
      </p>
    </div>
  );
}
