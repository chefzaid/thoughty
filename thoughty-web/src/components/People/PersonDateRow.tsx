import { useId } from 'react';

import type { TranslationFunction } from '../../types';
import { monthName } from '../../utils/calendarNames';
import { daysInMonth, PERSON_DATE_KINDS, PERSON_DATE_LABEL_MAX_LENGTH, type PersonDateDraft, type PersonDateKind } from '../../utils/personDates';
import type { Language } from '../../utils/translations';

interface PersonDateRowProps {
  readonly number: number;
  readonly draft: PersonDateDraft;
  /** Whether another of the person's dates is their birthday, so this one cannot be. */
  readonly birthdayTaken: boolean;
  readonly onChange: (draft: PersonDateDraft) => void;
  readonly onRemove: () => void;
  readonly isDark: boolean;
  readonly language: Language;
  readonly t: TranslationFunction;
  /** The id of the message about this date to announce with it, when there is one. */
  readonly errorId?: string;
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

/**
 * One of a person's dates in the People page editor: a birthday or an anniversary, what it marks, the month and day,
 * and the year when the writer knows it. The days offered follow the month (29 for February, which the API refuses
 * only in a known year without a 29th, `PERSON_DATE_INVALID`).
 */
export default function PersonDateRow({ number, draft, birthdayTaken, onChange, onRemove, isDark, language, t, errorId }: PersonDateRowProps) {
  const ids = { kind: useId(), label: useId(), month: useId(), day: useId(), year: useId() };
  const field = `h-10 rounded-lg border px-3 text-sm outline-none focus:ring-1 focus:ring-blue-500 ${isDark
    ? 'border-gray-700 bg-gray-900 text-gray-100'
    : 'border-gray-300 bg-gray-50 text-gray-900'}`;
  const label = `mb-1 block text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`;
  // A day the month can have in some year: 29 February is refused only in a known year without one
  const lastDay = draft.month ? daysInMonth(Number(draft.month), null) : 31;
  const legend = t('personDateNumber', { number });

  const changeMonth = (month: string) => {
    const keepDay = !draft.day || !month || Number(draft.day) <= daysInMonth(Number(month), null);
    onChange({ ...draft, month, day: keepDay ? draft.day : '' });
  };

  return (
    <fieldset
      className={`rounded-lg border px-3 pb-3 pt-1 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
      aria-describedby={errorId}
      data-person-date={draft.key}
    >
      <legend className={`px-1 text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{legend}</legend>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor={ids.kind} className={label}>{t('personDateKindLabel')}</label>
          <select
            id={ids.kind}
            value={draft.kind}
            onChange={(event) => onChange({ ...draft, kind: event.target.value as PersonDateKind })}
            className={field}
            data-person-date-kind
          >
            {PERSON_DATE_KINDS.map((kind) => (
              <option key={kind} value={kind} disabled={kind === 'birthday' && birthdayTaken}>{t(`personDateKind_${kind}`)}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[10rem] flex-1">
          <label htmlFor={ids.label} className={label}>{t('personDateLabelLabel')}</label>
          <input
            id={ids.label}
            type="text"
            value={draft.label}
            maxLength={PERSON_DATE_LABEL_MAX_LENGTH}
            onChange={(event) => onChange({ ...draft, label: event.target.value })}
            autoComplete="off"
            className={`${field} w-full`}
          />
        </div>
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
            className={`${field} w-24`}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('personDateRemove', { number })}
          title={t('personDateRemove', { number })}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${isDark
            ? 'border-gray-600 text-red-300 hover:bg-gray-800'
            : 'border-gray-300 text-red-700 hover:bg-gray-100'}`}
        >
          <span className="codicon codicon-trash" aria-hidden="true" />
        </button>
      </div>
    </fieldset>
  );
}
