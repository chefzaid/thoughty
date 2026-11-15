import { useEffect, useState } from 'react';
import AuthStatusMessages from './AuthStatusMessages';
import type { TranslationFunction } from './types';
import './SignUpSteps.css';

/** The server sends at most one sign-up email a minute to an address. */
export const SIGN_UP_RESEND_SECONDS = 60;

interface SignUpEmailSentProps {
  readonly email: string;
  readonly t: TranslationFunction;
  readonly loading: boolean;
  readonly error: string;
  readonly successMessage: string;
  /** Changes with every email asked for, which restarts the wait before the next one. */
  readonly sentAt: number;
  readonly onResend: () => void;
  readonly onUseAnotherEmail: () => void;
}

/**
 * What a verify-first sign-up shows instead of signing in: the same words for every address, since
 * the server does not say whether it already has an account.
 */
function SignUpEmailSent({
  email,
  t,
  loading,
  error,
  successMessage,
  sentAt,
  onResend,
  onUseAnotherEmail,
}: SignUpEmailSentProps) {
  const [secondsLeft, setSecondsLeft] = useState(SIGN_UP_RESEND_SECONDS);

  useEffect(() => {
    setSecondsLeft(SIGN_UP_RESEND_SECONDS);
    const timer = setInterval(() => {
      setSecondsLeft((seconds) => {
        if (seconds <= 1) {
          clearInterval(timer);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [sentAt]);

  return (
    <section className="sign-up-step" aria-labelledby="sign-up-email-sent-title">
      <h2 id="sign-up-email-sent-title" className="sr-only">{t('signUpCheckEmailTitle')}</h2>
      <AuthStatusMessages error={error} successMessage={successMessage} />
      <p className="sign-up-step-text">{t('signUpCheckEmailBody', { email })}</p>
      <p className="sign-up-step-text">{t('signUpCheckEmailPassword')}</p>
      <div className="sign-up-step-actions">
        <button
          type="button"
          className="auth-submit-btn"
          onClick={onResend}
          disabled={loading || secondsLeft > 0}
        >
          {secondsLeft > 0 ? t('signUpResendIn', { seconds: secondsLeft }) : t('signUpResendEmail')}
        </button>
        <button type="button" className="sign-up-step-link" onClick={onUseAnotherEmail}>
          {t('signUpUseAnotherEmail')}
        </button>
      </div>
    </section>
  );
}

export default SignUpEmailSent;
