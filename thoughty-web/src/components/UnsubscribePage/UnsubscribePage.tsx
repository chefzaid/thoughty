import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { unsubscribeEmail, type OptInEmailKind } from '../../services/api';
import type { TranslationFunction } from '../AuthPage/types';
import '../AuthPage/AuthPage.css';
import '../VerifyEmailPage/VerifyEmailPage.css';

interface UnsubscribePageProps {
  readonly t: TranslationFunction;
  readonly theme?: 'light' | 'dark';
  readonly onContinue: () => void;
}

type UnsubscribeState = 'working' | 'done' | 'failed' | 'missing';

/** What the page says once each email is off. */
const UNSUBSCRIBED: Record<OptInEmailKind, string> = {
  'on-this-day': 'onThisDayUnsubscribed',
  'monthly-recap': 'monthlyRecapUnsubscribed',
};

/**
 * Where an opt-in email's unsubscribe link lands: it turns off the email the link's signed token names
 * as soon as it opens, without signing in, and says which one.
 */
function UnsubscribePage({ t, theme, onContinue }: UnsubscribePageProps) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const attemptedTokenRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<UnsubscribeState>(token ? 'working' : 'missing');
  const [error, setError] = useState('emailUnsubscribeFailed');
  const [kind, setKind] = useState<OptInEmailKind>('on-this-day');

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const unsubscribe = useCallback(async () => {
    if (!token) return;
    setStatus('working');
    const result = await unsubscribeEmail(token);
    if (!mountedRef.current) return;
    setError(result.error ?? 'emailUnsubscribeFailed');
    if (result.data) setKind(result.data.kind);
    setStatus(result.data ? 'done' : 'failed');
  }, [token]);

  useEffect(() => {
    if (attemptedTokenRef.current === token) return;
    attemptedTokenRef.current = token;
    void unsubscribe();
  }, [token, unsubscribe]);

  const messages: Record<UnsubscribeState, string> = {
    working: 'emailUnsubscribing',
    done: UNSUBSCRIBED[kind],
    missing: 'emailUnsubscribeMissing',
    failed: error,
  };
  const isError = status === 'failed' || status === 'missing';

  return (
    <main className={`auth-page verify-email-page ${theme === 'light' ? 'light' : 'dark'}`}>
      <section className="auth-container verify-email-container" aria-labelledby="unsubscribe-title">
        <div className="auth-header">
          <img src="/thoughty-logo.svg" alt="Thoughty" className="auth-logo" />
          <h1 id="unsubscribe-title" className="auth-title">{t('emailUnsubscribeTitle')}</h1>
        </div>

        <output className={`verify-email-status ${isError ? 'error' : ''}`} role={isError ? 'alert' : undefined} aria-live="polite">
          {t(messages[status])}
        </output>

        {status === 'failed' && (
          <button type="button" className="auth-submit-btn" onClick={() => void unsubscribe()}>
            {t('tryAgain')}
          </button>
        )}

        {status !== 'working' && status !== 'failed' && (
          <button type="button" className="auth-submit-btn" onClick={onContinue}>
            {t('continueToThoughty')}
          </button>
        )}
      </section>
    </main>
  );
}

export default UnsubscribePage;
