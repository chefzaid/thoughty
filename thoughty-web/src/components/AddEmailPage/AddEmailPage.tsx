import { useCallback, useEffect, useState, type SubmitEvent } from 'react';

import { useAuth } from '../../contexts/AuthContext';
import AuthStatusMessages from '../AuthPage/AuthStatusMessages';
import type { TranslationFunction } from '../AuthPage/types';
import '../AuthPage/AuthPage.css';
import '../AuthPage/SignUpSteps.css';

export interface AddEmailPageProps {
  readonly t: TranslationFunction;
  readonly theme?: 'light' | 'dark';
}

/**
 * What a writer whose account has no email address (the API's `emailMissing`: a placeholder stands in)
 * sees once signed in, before the journal: they give an address, then open the link emailed to it, which
 * sets it. While a link waits, the address is read again when the page opens and each time the writer
 * comes back to it, as the link is usually opened in another tab.
 */
export default function AddEmailPage({ t, theme }: AddEmailPageProps) {
  const { user, addEmail, resendVerificationEmail, refreshAccountEmail, logout } = useAuth();
  const pendingEmail = user?.pendingEmail ?? '';
  const [email, setEmail] = useState('');
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fieldClass = theme === 'light' ? 'light' : 'dark';
  const waiting = Boolean(pendingEmail) && !changing;

  useEffect(() => {
    if (!pendingEmail) return undefined;
    void refreshAccountEmail();
    const readAgain = () => {
      if (document.visibilityState === 'visible') void refreshAccountEmail();
    };
    globalThis.addEventListener('focus', readAgain);
    document.addEventListener('visibilitychange', readAgain);
    return () => {
      globalThis.removeEventListener('focus', readAgain);
      document.removeEventListener('visibilitychange', readAgain);
    };
  }, [pendingEmail, refreshAccountEmail]);

  const run = useCallback(async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } finally {
      setBusy(false);
    }
  }, []);

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void run(async () => {
      const result = await addEmail(email.trim());
      if (result.success) {
        setChanging(false);
        setEmail('');
      } else {
        setError(t(result.error || 'addEmailFailed'));
      }
    });
  };

  const resend = () => run(async () => {
    const result = await resendVerificationEmail();
    if (result.success) setNotice(t('addEmailResent'));
    else setError(t(result.error || 'addEmailFailed'));
  });

  // Still shown after the read: the link has not been opened yet
  const checkAgain = () => run(async () => {
    await refreshAccountEmail();
    setNotice(t('addEmailNotConfirmedYet'));
  });

  return (
    <main className={`auth-page ${fieldClass}`} data-testid="add-email-page">
      <section className="auth-container" aria-labelledby="add-email-title">
        <div className="auth-header">
          <img src="/thoughty-logo.svg" alt="Thoughty" className="auth-logo" />
          <h1 id="add-email-title" className="auth-title">{t('addEmailTitle')}</h1>
          {!waiting && <p className="auth-subtitle">{t('addEmailIntro')}</p>}
        </div>

        {waiting ? (
          <div className="sign-up-step">
            <AuthStatusMessages error={error} successMessage={notice} />
            <p className="sign-up-step-text">{t('addEmailCheckInbox', { email: pendingEmail })}</p>
            <div className="sign-up-step-actions">
              <button type="button" className="auth-submit-btn" disabled={busy} onClick={() => void checkAgain()}>
                {t('addEmailOpenedLink')}
              </button>
              <button type="button" className="sign-up-step-link" disabled={busy} onClick={() => void resend()}>
                {t('addEmailResend')}
              </button>
              <button type="button" className="sign-up-step-link" onClick={() => setChanging(true)}>
                {t('signUpUseAnotherEmail')}
              </button>
            </div>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <AuthStatusMessages error={error} />
            <div className="form-group">
              <label htmlFor="add-email-address">{t('email')}</label>
              <input
                id="add-email-address"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t('enterYourEmail')}
                className={fieldClass}
                autoComplete="email"
                maxLength={255}
                required
              />
            </div>
            <button type="submit" className="auth-submit-btn" disabled={busy}>
              {busy ? t('addEmailSaving') : t('addEmailSubmit')}
            </button>
          </form>
        )}

        <div className="auth-switch">
          <button type="button" className="switch-btn" onClick={() => void logout()}>
            {t('logout')}
          </button>
        </div>
      </section>
    </main>
  );
}
