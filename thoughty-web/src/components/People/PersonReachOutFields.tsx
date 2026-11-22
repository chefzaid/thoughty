import { useId, type Ref } from 'react';

import type { TranslationFunction } from '../../types';
import { REACH_OUT_DAYS, type ReachOutDraft } from '../../utils/personReachOut';
import { mutedTextClass } from '../../utils/tintedText';

interface PersonReachOutFieldsProps {
  readonly name: string;
  readonly draft: ReachOutDraft;
  readonly onChange: (draft: ReachOutDraft) => void;
  /** The writer's day, the latest last contact the field offers. */
  readonly today: string;
  readonly isDark: boolean;
  readonly t: TranslationFunction;
  /** The id of the message about these fields to announce with them, when there is one. */
  readonly errorId?: string;
  readonly lastContactRef?: Ref<HTMLInputElement>;
}

/**
 * A person's reach-out reminder in the People page editor: how long without contact before Highlights reminds
 * the writer, and the last day they were in touch, which **Contacted today** in Highlights also sets.
 */
export default function PersonReachOutFields({ name, draft, onChange, today, isDark, t, errorId, lastContactRef }: PersonReachOutFieldsProps) {
  const ids = { help: useId(), after: useId(), lastContact: useId(), lastContactHelp: useId() };
  const field = `h-10 rounded-lg border px-3 text-sm outline-none focus:ring-1 focus:ring-blue-500 ${isDark
    ? 'border-gray-700 bg-gray-900 text-gray-100 [color-scheme:dark]'
    : 'border-gray-300 bg-gray-50 text-gray-900'}`;
  const label = `mb-1 block text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`;
  const muted = `text-xs ${mutedTextClass(isDark)}`;

  return (
    <fieldset className="mt-3 grid gap-2" aria-describedby={ids.help}>
      <legend className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('reachOutLegend')}</legend>
      <p id={ids.help} className={muted}>{t('reachOutHelp', { name })}</p>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor={ids.after} className={label}>{t('reachOutAfterLabel')}</label>
          <select id={ids.after} value={draft.after} onChange={(event) => onChange({ ...draft, after: event.target.value })} className={field}>
            <option value="">{t('reachOutNever')}</option>
            {REACH_OUT_DAYS.map((days) => <option key={days} value={String(days)}>{t(`reachOutAfter_${days}`)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={ids.lastContact} className={label}>{t('reachOutLastContactLabel')}</label>
          <input
            ref={lastContactRef}
            id={ids.lastContact}
            type="date"
            max={today}
            value={draft.lastContactOn}
            onChange={(event) => onChange({ ...draft, lastContactOn: event.target.value })}
            aria-invalid={errorId ? true : undefined}
            aria-describedby={[ids.lastContactHelp, errorId].filter(Boolean).join(' ')}
            className={field}
          />
        </div>
      </div>
      <p id={ids.lastContactHelp} className={muted}>{t('reachOutLastContactHelp')}</p>
    </fieldset>
  );
}
