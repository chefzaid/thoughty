import { useId, type Ref } from 'react';

import type { TranslationFunction } from '../../types';
import { monthName } from '../../utils/calendarNames';
import { mutedTextClass } from '../../utils/tintedText';
import { daysInMonth, PERSON_DATE_KINDS, type PersonDateDraft, type PersonDateKind } from '../../utils/personDates';
import type { Language } from '../../utils/translations';

interface PersonDateFieldsProps {
  readonly name: string;
  readonly draft: PersonDateDraft;
  readonly onChange: (draft: PersonDateDraft) => void;
  readonly isDark: boolean;
  readonly language: Language;
  readonly t: TranslationFunction;
  /** The id of the message about the date to announce with the fields, when there is one. */
  readonly errorId?: string;
  readonly kindRef?: Ref<HTMLSelectElement>;
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

/**
 * A person's birthday or anniversary in the People page editor: what it marks, the month and day, and
 * the year when the writer knows it. The days offered follow the month (29 for February, which the
 * API refuses only in a known year without a 29th, `PERSON_DATE_INVALID`).
 */
export default function PersonDateFields({ name, draft, onChange, isDark, language, t, errorId, kindRef }: PersonDateFieldsProps) {
  const ids = { help: useId(), kind: useId(), month: useId(), day: useId(), year: useId(), yearHelp: useId() };
  const field = `h-10 rounded-lg border px-3 text-sm outline-none focus:ring-1 focus:ring-blue-500 ${isDark
    ? 'border-gray-700 bg-gray-900 text-gray-100'
    : 'border-gray-300 bg-gray-50 text-gray-900'}`;
  const label = `mb-1 block text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`;
  const muted = `text-xs ${mutedTextClass(isDark)}`;
  // A day the month can have in some year: 29 February is refused only in a known year without one
  const lastDay = draft.month ? daysInMonth(Number(draft.month), null) : 31;
  const describedBy = [ids.help, errorId].filter(Boolean).join(' ');

  const changeMonth = (month: string) => {
    const keepDay = !draft.day || !month || Number(draft.day) <= daysInMonth(Number(month), null);
    onChange({ ...draft, month, day: keepDay ? draft.day : '' });
  };

  return (
    <fieldset className="mt-3 grid gap-2" aria-describedby={describedBy}>
      <legend className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('personDateLegend')}</legend>
      <p id={ids.help} className={muted}>{t('personDateHelp', { name })}</p>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor={ids.kind} className={label}>{t('personDateKindLabel')}</label>
          <select
            ref={kindRef}
            id={ids.kind}
            value={draft.kind}
            onChange={(event) => onChange({ ...draft, kind: event.target.value as PersonDateKind | '' })}
            className={field}
          >
            <option value="">{t('personDateKindNone')}</option>
            {PERSON_DATE_KINDS.map((kind) => <option key={kind} value={kind}>{t(`personDateKind_${kind}`)}</option>)}
          </select>
        </div>
        {draft.kind !== '' && (
          <>
            <div>
              <label htmlFor={ids.month} className={label}>{t('personDateMonthLabel')}</label>
              <select id={ids.month} value={draft.month} onChange={(event) => changeMonth(event.target.value)} className={field} aria-required="true">
                <option value="">{t('personDateChoose')}</option>
                {MONTHS.map((month) => <option key={month} value={String(month)}>{monthName(month, language)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={ids.day} className={label}>{t('personDateDayLabel')}</label>
              <select id={ids.day} value={draft.day} onChange={(event) => onChange({ ...draft, day: event.target.value })} className={field} aria-required="true">
                <option value="">{t('personDateChoose')}</option>
                {Array.from({ length: lastDay }, (_, index) => index + 1).map((day) => (
                  <option key={day} value={String(day)}>{day}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={ids.year} className={label}>{t('personDateYearLabel')}</label>
              <input
                id={ids.year}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                value={draft.year}
                onChange={(event) => onChange({ ...draft, year: event.target.value })}
                aria-describedby={ids.yearHelp}
                className={`${field} w-24`}
              />
            </div>
          </>
        )}
      </div>
      {draft.kind !== '' && <p id={ids.yearHelp} className={muted}>{t('personDateYearHelp')}</p>}
    </fieldset>
  );
}
