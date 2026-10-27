import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { unsubscribeOnThisDayEmail } from '../../services/api';
import type { TranslationFunction } from '../AuthPage/types';
import '../AuthPage/AuthPage.css';
import '../VerifyEmailPage/VerifyEmailPage.css';

interface UnsubscribePageProps {
  readonly t: TranslationFunction;
  readonly theme?: 'light' | 'dark';
  readonly onContinue: () => void;
}

type UnsubscribeState = 'working' | 'done' | 'failed' | 'missing';

/**
 * Where an "On this day" email's unsubscribe link lands: it turns the email off with the link's signed
 * token as soon as it opens, without signing in, and says so.
 */
function UnsubscribePage({ t, theme, onContinue }: UnsubscribePageProps) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const attemptedTokenRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<UnsubscribeState>(token ? 'working' : 'missing');
  const [error, setError] = useState('onThisDayUnsubscribeFailed');

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const unsubscribe = useCallback(async () => {
    if (!token) return;
    setStatus('working');
    const result = await unsubscribeOnThisDayEmail(token);
    if (!mountedRef.current) return;
    setError(result.error ?? 'onThisDayUnsubscribeFailed');
    setStatus(result.data ? 'done' : 'failed');
  }, [token]);

  useEffect(() => {
    if (attemptedTokenRef.current === token) return;
    attemptedTokenRef.current = token;
    void unsubscribe();
  }, [token, unsubscribe]);

  const messages: Record<UnsubscribeState, string> = {
    working: 'onThisDayUnsubscribing',
    done: 'onThisDayUnsubscribed',
    missing: 'onThisDayUnsubscribeMissing',
    failed: error,
  };
  const isError = status === 'failed' || status === 'missing';

  return (
    <main className={`auth-page verify-email-page ${theme === 'light' ? 'light' : 'dark'}`}>
      <section className="auth-container verify-email-container" aria-labelledby="unsubscribe-title">
        <div className="auth-header">
          <img src="/thoughty-logo.svg" alt="Thoughty" className="auth-logo" />
          <h1 id="unsubscribe-title" className="auth-title">{t('onThisDayUnsubscribeTitle')}</h1>
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
