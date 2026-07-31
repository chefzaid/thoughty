import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import type { TranslationFunction } from '../AuthPage/types';
import '../AuthPage/AuthPage.css';
import './VerifyEmailPage.css';

interface VerifyEmailPageProps {
  readonly t: TranslationFunction;
  readonly theme?: 'light' | 'dark';
  readonly onContinue: () => void;
}

type VerificationState = 'verifying' | 'success' | 'error' | 'missing';

function VerifyEmailPage({ t, theme, onContinue }: VerifyEmailPageProps) {
  const { verifyEmail } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const attemptedTokenRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<VerificationState>(token ? 'verifying' : 'missing');

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runVerification = useCallback(async () => {
    if (!token) {
      setStatus('missing');
      return;
    }

    setStatus('verifying');
    const result = await verifyEmail(token);
    if (mountedRef.current) {
      setStatus(result.success ? 'success' : 'error');
    }
  }, [token, verifyEmail]);

  useEffect(() => {
    if (attemptedTokenRef.current === token) return;
    attemptedTokenRef.current = token;
    void runVerification();
  }, [runVerification, token]);

  const message =
    status === 'verifying'
      ? t('verifyingEmail')
      : status === 'success'
        ? t('emailVerificationSuccess')
        : status === 'missing'
          ? t('emailVerificationMissingToken')
          : t('emailVerificationInvalid');

  return (
    <main className={`auth-page verify-email-page ${theme === 'light' ? 'light' : 'dark'}`}>
      <section className="auth-container verify-email-container" aria-labelledby="verify-email-title">
        <div className="auth-header">
          <img src="/thoughty-logo.svg" alt="Thoughty" className="auth-logo" />
          <h1 id="verify-email-title" className="auth-title">
            {t('verifyEmailTitle')}
          </h1>
        </div>

        <p
          className={`verify-email-status ${status === 'error' || status === 'missing' ? 'error' : ''}`}
          role={status === 'error' || status === 'missing' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {message}
        </p>

        {status === 'error' && (
          <button type="button" className="auth-submit-btn" onClick={() => void runVerification()}>
            {t('tryAgain')}
          </button>
        )}

        {(status === 'success' || status === 'missing') && (
          <button type="button" className="auth-submit-btn" onClick={onContinue}>
            {t('continueToThoughty')}
          </button>
        )}
      </section>
    </main>
  );
}

export default VerifyEmailPage;
