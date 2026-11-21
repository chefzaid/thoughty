import { useEffect, useState } from 'react';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { createAccountActivityService, type AccountEvent } from '../../services/api';
import SettingSwitch from './SettingSwitch';
import { formatSessionDate } from './formatSessionDate';
import type { TranslationFunction } from './types';

interface AccountActivitySectionProps {
  readonly isDark: boolean;
  readonly t: TranslationFunction;
}

/**
 * The account's sign-ins, refused sign-ins, sign-outs and security changes of the past year, newest first,
 * a page at a time, with the switch for the email about a sign-in from a new browser (Profile › Privacy).
 */
function AccountActivitySection({ isDark, t }: AccountActivitySectionProps) {
  const service = useAuthenticatedService(createAccountActivityService);
  const [events, setEvents] = useState<AccountEvent[] | null>(null);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [newBrowserEmail, setNewBrowserEmail] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    let active = true;
    void service.list().then(({ data }) => {
      if (!active) return;
      setLoadError(!data);
      if (!data) return;
      setEvents(data.events);
      setNextBefore(data.nextBefore);
      setNewBrowserEmail(data.newBrowserEmail);
    });
    return () => {
      active = false;
    };
  }, [service]);

  const showMore = async () => {
    if (nextBefore === null) return;
    setLoadingMore(true);
    const { data } = await service.list(nextBefore);
    setLoadingMore(false);
    setLoadError(!data);
    if (!data) return;
    setEvents((current) => [...(current ?? []), ...data.events]);
    setNextBefore(data.nextBefore);
  };

  const toggleEmail = async ({ target }: { target: { value: string } }) => {
    const enabled = target.value === 'true';
    setSaveError(false);
    setNewBrowserEmail(enabled);
    const { data } = await service.setNewBrowserEmail(enabled);
    if (data) {
      setNewBrowserEmail(data.newBrowserEmail);
    } else {
      setNewBrowserEmail(!enabled);
      setSaveError(true);
    }
  };

  const from = (event: AccountEvent) =>
    t('accountActivityFromValue', {
      browser: event.browser ?? t('accountActivityUnknownBrowser'),
      system: event.system ?? t('accountActivityUnknownSystem'),
    });

  return (
    <>
      <div className="setting-row">
        <div className="setting-info">
          <span className="setting-label">{t('accountActivity')}</span>
          <span className="setting-description">{t('accountActivityDescription')}</span>
        </div>
        {events === null && !loadError && <span className="setting-description">{t('loading')}...</span>}
        {events?.length === 0 && <span className="setting-description">{t('accountActivityEmpty')}</span>}
        {events && events.length > 0 && (
          <div className="billing-history">
            <table aria-label={t('accountActivity')}>
              <thead>
                <tr>
                  <th scope="col">{t('accountActivityWhen')}</th>
                  <th scope="col">{t('accountActivityWhat')}</th>
                  <th scope="col">{t('accountActivityFrom')}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>{formatSessionDate(event.createdAt)}</td>
                    <td>{t(`accountEvent_${event.kind}`)}</td>
                    <td>{from(event)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {nextBefore !== null && (
          <button
            type="button"
            className={`btn-download-data ${isDark ? 'dark' : 'light'}`}
            disabled={loadingMore}
            onClick={() => void showMore()}
          >
            {loadingMore ? `${t('loading')}...` : t('accountActivityMore')}
          </button>
        )}
        {loadError && <div className="password-error" role="alert">{t('accountActivityLoadError')}</div>}
      </div>

      {events !== null && (
        <SettingSwitch
          name="newBrowserEmail"
          label={t('newBrowserEmail')}
          description={t('newBrowserEmailDescription')}
          enabled={newBrowserEmail}
          handleChange={(event) => void toggleEmail(event)}
        />
      )}
      {saveError && <div className="password-error" role="alert">{t('newBrowserEmailSaveError')}</div>}
    </>
  );
}

export default AccountActivitySection;
