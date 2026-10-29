import { useMemo, useState } from 'react';

import type { AuthFetchFunction, OptInEmailChanges, OptInEmailService, OptInEmailSettings } from '../../services/api';
import type { Diary, TranslationFunction } from '../../types';
import { browserTimeZone, timeZoneOptions } from '../../utils/timeZone';
import type { Language } from '../../utils/translations';
import SettingSwitch from '../ProfilePage/SettingSwitch';
import { useOptInEmail } from './useOptInEmail';
import './OptInEmailSection.css';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** The translation keys for what differs between opt-in emails; the hour, zone and diary fields are shared. */
export interface OptInEmailCopyKeys {
  readonly title: string;
  readonly intro: string;
  readonly enable: string;
  readonly enableDescription: string;
  /** Takes `{date}`. */
  readonly next: string;
  readonly privacy: string;
  readonly turnedOn: string;
  readonly turnedOff: string;
  readonly saved: string;
  readonly loadFailed: string;
  readonly saveFailed: string;
}

export interface OptInEmailSectionProps {
  /** The section's element ID, which also prefixes its fields'. */
  readonly sectionId: string;
  /** The switch's form name. */
  readonly switchName: string;
  readonly queryKey: readonly string[];
  readonly createService: (authFetch: AuthFetchFunction) => OptInEmailService;
  readonly copy: OptInEmailCopyKeys;
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
function toChanges(setting: OptInEmailSettings): OptInEmailChanges {
  return {
    enabled: setting.enabled,
    deliveryHour: setting.deliveryHour,
    timeZone: setting.timeZone ?? browserTimeZone(),
    diaryId: setting.diaryId,
  };
}

/**
 * A profile section for one opt-in email: on or off, the local hour and zone it arrives in, and the
 * diary it reads. Each change is saved at once, apart from the profile's own settings.
 */
function OptInEmailSection({ sectionId, switchName, queryKey, createService, copy, diaries, isDark, language, t }: OptInEmailSectionProps) {
  const { setting, save } = useOptInEmail(queryKey, createService, copy.loadFailed);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const theme = isDark ? 'dark' : 'light';
  const current = setting.data ? toChanges(setting.data) : null;
  const zones = useMemo(() => timeZoneOptions(current?.timeZone ?? browserTimeZone()), [current?.timeZone]);

  const apply = async (changes: Partial<OptInEmailChanges>) => {
    if (!current) return;
    setSaving(true);
    setError('');
    const result = await save({ ...current, ...changes });
    setSaving(false);
    if (!result.data) {
      setError(t(result.error ?? copy.saveFailed));
      return;
    }
    if (changes.enabled === undefined) {
      setStatus(t(copy.saved));
    } else {
      setStatus(t(result.data.enabled ? copy.turnedOn : copy.turnedOff));
    }
  };

  return (
    <section id={sectionId} className={`profile-section opt-in-email ${theme}`} aria-labelledby={`${sectionId}-title`}>
      <div className="section-header">
        <span className="codicon codicon-mail section-icon" aria-hidden="true" />
        <h2 id={`${sectionId}-title`} className="section-title">{t(copy.title)}</h2>
      </div>
      <div className="section-content">
        <p className="opt-in-email-muted">{t(copy.intro)}</p>
        <p className="sr-only" role="status" aria-live="polite">{status}</p>
        {error && <p className="opt-in-email-error" role="alert">{error}</p>}

        {setting.isLoading && <p className="opt-in-email-muted">{t('optInEmailLoading')}</p>}
        {setting.isError && <p className="opt-in-email-error" role="alert">{t(copy.loadFailed)}</p>}

        {setting.data && current && (
          <>
            <SettingSwitch
              name={switchName}
              label={t(copy.enable)}
              description={t(copy.enableDescription)}
              enabled={current.enabled}
              handleChange={({ target }) => { if (!saving) void apply({ enabled: target.value === 'true' }); }}
            />
            {!setting.data.emailAvailable && (
              <p className="opt-in-email-notice">{t('optInEmailUnavailable')}</p>
            )}

            {current.enabled && (
              <div className="opt-in-email-fields">
                <div className="setting-row">
                  <label className="setting-label" htmlFor={`${sectionId}-hour`}>{t('optInEmailHour')}</label>
                  <select
                    id={`${sectionId}-hour`}
                    className={`setting-select ${theme}`}
                    value={current.deliveryHour}
                    disabled={saving}
                    onChange={(event) => void apply({ deliveryHour: Number(event.target.value) })}
                  >
                    {HOURS.map((hour) => <option key={hour} value={hour}>{formatHour(hour, language)}</option>)}
                  </select>
                </div>
                <div className="setting-row">
                  <label className="setting-label" htmlFor={`${sectionId}-zone`}>{t('optInEmailTimeZone')}</label>
                  <select
                    id={`${sectionId}-zone`}
                    className={`setting-select ${theme}`}
                    value={current.timeZone}
                    disabled={saving}
                    onChange={(event) => void apply({ timeZone: event.target.value })}
                  >
                    {zones.map((zone) => <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>)}
                  </select>
                </div>
                <div className="setting-row">
                  <label className="setting-label" htmlFor={`${sectionId}-diary`}>{t('optInEmailDiary')}</label>
                  <select
                    id={`${sectionId}-diary`}
                    className={`setting-select ${theme}`}
                    value={current.diaryId ?? ''}
                    disabled={saving}
                    onChange={(event) => void apply({ diaryId: event.target.value ? Number(event.target.value) : null })}
                  >
                    <option value="">{t('optInEmailAllDiaries')}</option>
                    {diaries.map((diary) => <option key={diary.id} value={diary.id}>{diary.icon} {diary.name}</option>)}
                  </select>
                </div>
                {setting.data.nextSendAt && (
                  <p className="opt-in-email-muted">
                    {t(copy.next, { date: formatNextSend(setting.data.nextSendAt, current.timeZone, language) })}
                  </p>
                )}
                <p className="opt-in-email-muted">{t(copy.privacy)}</p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default OptInEmailSection;
