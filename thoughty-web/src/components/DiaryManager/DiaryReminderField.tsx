import { useId } from 'react';
import './DiaryGoalField.css';
import { DELIVERY_HOURS, formatDeliveryHour } from '../../utils/timeZone';

/**
 * A diary's own writing reminder hour: "As in Profile" (no hour of its own, so the Profile reminder
 * applies) or a local hour that replaces the Profile reminder for this diary. Says so when no email can
 * reach the writer yet.
 */
export default function DiaryReminderField({
    hour,
    emailAvailable,
    onChange,
    language,
    t,
}: Readonly<{
    /** The hour as the select holds it: '' for none, else 0 to 23. */
    hour: string;
    emailAvailable: boolean;
    onChange: (hour: string) => void;
    language: string;
    t: (key: string, params?: Record<string, string | number>) => string;
}>) {
    const id = useId();

    return (
        <div className="diary-goal-field">
            <label className="visibility-label" htmlFor={id}>{t('diaryReminder')}</label>
            <select
                id={id}
                className="diary-goal-select"
                value={hour}
                onChange={(event) => onChange(event.target.value)}
                title={t('diaryReminderHint')}
            >
                <option value="">{t('diaryReminderProfile')}</option>
                {DELIVERY_HOURS.map((value) => (
                    <option key={value} value={String(value)}>{formatDeliveryHour(value, language)}</option>
                ))}
            </select>
            {hour !== '' && !emailAvailable && <span className="diary-reminder-notice">{t('optInEmailUnavailable')}</span>}
        </div>
    );
}
