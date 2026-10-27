import { useMemo, useState } from 'react';

import type { OnThisDayEmailChanges, OnThisDayEmailSettings } from '../../services/api';
import type { Diary, TranslationFunction } from '../../types';
import { browserTimeZone, timeZoneOptions } from '../../utils/timeZone';
import type { Language } from '../../utils/translations';
import SettingSwitch from '../ProfilePage/SettingSwitch';
import { useOnThisDayEmail } from './useOnThisDayEmail';
import './OnThisDayEmailSection.css';

const SECTION_ID = 'on-this-day-email';
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

interface OnThisDayEmailSectionProps {
  readonly diaries: readonly Diary[];
  readonly isDark: boolean;
  readonly language: Language;
  readonly t: TranslationFunction;
}

function formatHour(hour: number, language: Language): string {
  return new Intl.DateTimeFormat(language, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2000, 0, 1, hour)));
}

function formatNextSend(iso: string, timeZone: string, language: Language): string {
  return new Intl.DateTimeFormat(language, { dateStyle: 'full', timeStyle: 'short', timeZone }).format(new Date(iso));
}

/** The settings a save sends: what is stored, with the browser's zone until one is saved. */
function toChanges(setting: OnThisDayEmailSettings): OnThisDayEmailChanges {
  return {
    enabled: setting.enabled,
    deliveryHour: setting.deliveryHour,
    timeZone: setting.timeZone ?? browserTimeZone(),
    diaryId: setting.diaryId,
  };
}

/**
 * The profile's opt-in "On this day" email: on or off, the local hour and zone it arrives in, and the
 * diary it reads. Each change is saved at once, apart from the profile's own settings.
 */
function OnThisDayEmailSection({ diaries, isDark, language, t }: OnThisDayEmailSectionProps) {
  const { setting, save } = useOnThisDayEmail();
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const theme = isDark ? 'dark' : 'light';
  const current = setting.data ? toChanges(setting.data) : null;
  const zones = useMemo(() => timeZoneOptions(current?.timeZone ?? browserTimeZone()), [current?.timeZone]);

  const apply = async (changes: Partial<OnThisDayEmailChanges>) => {
    if (!current) return;
    setSaving(true);
    setError('');
    const result = await save({ ...current, ...changes });
    setSaving(false);
    if (!result.data) {
      setError(t(result.error ?? 'onThisDayEmailSaveFailed'));
      return;
    }
    if (changes.enabled === undefined) {
      setStatus(t('onThisDayEmailSaved'));
    } else {
      setStatus(t(result.data.enabled ? 'onThisDayEmailTurnedOn' : 'onThisDayEmailTurnedOff'));
    }
  };

  return (
    <section id={SECTION_ID} className={`profile-section on-this-day-email ${theme}`} aria-labelledby={`${SECTION_ID}-title`}>
      <div className="section-header">
        <span className="codicon codicon-mail section-icon" aria-hidden="true" />
        <h3 id={`${SECTION_ID}-title`} className="section-title">{t('onThisDayEmailTitle')}</h3>
      </div>
      <div className="section-content">
        <p className="on-this-day-email-muted">{t('onThisDayEmailIntro')}</p>
        <p className="sr-only" role="status" aria-live="polite">{status}</p>
        {error && <p className="on-this-day-email-error" role="alert">{error}</p>}

        {setting.isLoading && <p className="on-this-day-email-muted">{t('onThisDayEmailLoading')}</p>}
        {setting.isError && <p className="on-this-day-email-error" role="alert">{t('onThisDayEmailLoadFailed')}</p>}

        {setting.data && current && (
          <>
            <SettingSwitch
              name="onThisDayEmail"
              label={t('onThisDayEmailEnable')}
              description={t('onThisDayEmailEnableDescription')}
              enabled={current.enabled}
              handleChange={({ target }) => { if (!saving) void apply({ enabled: target.value === 'true' }); }}
            />
            {!setting.data.emailAvailable && (
              <p className="on-this-day-email-notice">{t('onThisDayEmailUnavailable')}</p>
            )}

            {current.enabled && (
              <div className="on-this-day-email-fields">
                <div className="setting-row">
                  <label className="setting-label" htmlFor={`${SECTION_ID}-hour`}>{t('onThisDayEmailHour')}</label>
                  <select
                    id={`${SECTION_ID}-hour`}
                    className={`setting-select ${theme}`}
                    value={current.deliveryHour}
                    disabled={saving}
                    onChange={(event) => void apply({ deliveryHour: Number(event.target.value) })}
                  >
                    {HOURS.map((hour) => <option key={hour} value={hour}>{formatHour(hour, language)}</option>)}
                  </select>
                </div>
                <div className="setting-row">
                  <label className="setting-label" htmlFor={`${SECTION_ID}-zone`}>{t('onThisDayEmailTimeZone')}</label>
                  <select
                    id={`${SECTION_ID}-zone`}
                    className={`setting-select ${theme}`}
                    value={current.timeZone}
                    disabled={saving}
                    onChange={(event) => void apply({ timeZone: event.target.value })}
                  >
                    {zones.map((zone) => <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>)}
                  </select>
                </div>
                <div className="setting-row">
                  <label className="setting-label" htmlFor={`${SECTION_ID}-diary`}>{t('onThisDayEmailDiary')}</label>
                  <select
                    id={`${SECTION_ID}-diary`}
                    className={`setting-select ${theme}`}
                    value={current.diaryId ?? ''}
                    disabled={saving}
                    onChange={(event) => void apply({ diaryId: event.target.value ? Number(event.target.value) : null })}
                  >
                    <option value="">{t('onThisDayEmailAllDiaries')}</option>
                    {diaries.map((diary) => <option key={diary.id} value={diary.id}>{diary.icon} {diary.name}</option>)}
                  </select>
                </div>
                {setting.data.nextSendAt && (
                  <p className="on-this-day-email-muted">
                    {t('onThisDayEmailNext', { date: formatNextSend(setting.data.nextSendAt, current.timeZone, language) })}
                  </p>
                )}
                <p className="on-this-day-email-muted">{t('onThisDayEmailPrivacy')}</p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default OnThisDayEmailSection;
