import type { TranslationFunction } from '../../types';
import { weekdayName } from '../../utils/calendarNames';
import { WEEKDAYS, type MemoirLanguage } from './memoirFormat';

interface MemoirScheduleFieldsProps {
  readonly idPrefix: string;
  readonly weekday: number;
  readonly emailEnabled: boolean;
  readonly timeZone: string;
  readonly language: MemoirLanguage;
  readonly onWeekdayChange: (weekday: number) => void;
  readonly onEmailEnabledChange: (enabled: boolean) => void;
  readonly t: TranslationFunction;
}

/** The weekly delivery day and email choice, shared by the start form and the settings. */
function MemoirScheduleFields({
  idPrefix,
  weekday,
  emailEnabled,
  timeZone,
  language,
  onWeekdayChange,
  onEmailEnabledChange,
  t,
}: MemoirScheduleFieldsProps) {
  return (
    <>
      <div className="memoir-field">
        <label htmlFor={`${idPrefix}-weekday`}>{t('memoirWeekdayLabel')}</label>
        <select
          id={`${idPrefix}-weekday`}
          value={weekday}
          onChange={(event) => onWeekdayChange(Number(event.target.value))}
        >
          {WEEKDAYS.map((day) => (
            <option key={day} value={day}>{weekdayName(day, language)}</option>
          ))}
        </select>
        <p className="memoir-hint">{t('memoirDeliveryHint', { timeZone })}</p>
      </div>
      <label className="memoir-checkbox" htmlFor={`${idPrefix}-email`}>
        <input
          id={`${idPrefix}-email`}
          type="checkbox"
          checked={emailEnabled}
          onChange={(event) => onEmailEnabledChange(event.target.checked)}
        />
        {t('memoirWeeklyEmail')}
      </label>
    </>
  );
}

export default MemoirScheduleFields;
