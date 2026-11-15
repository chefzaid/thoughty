import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useLinkToken } from '../../hooks/useLinkToken';
import type { TranslationFunction } from '../AuthPage/types';
import '../AuthPage/AuthPage.css';
import './VerifyEmailPage.css';

interface VerifyEmailPageProps {
  readonly t: TranslationFunction;
  readonly theme?: 'light' | 'dark';
  readonly onContinue: () => void;
}

type VerificationState = 'verifying' | 'success' | 'error' | 'missing';

/** What the page's history entry keeps once the link verified the address, so a reload still says so. */
interface VerifiedEntryState {
  emailVerified?: boolean;
}

/**
 * The page the emailed verification link opens. The link's token is taken from the address and
 * removed from it (and from the history entry) at once, so it is not left in the address bar, the
 * history or a later referrer; a verification that went through is kept in the history entry's
 * state instead, so reloading the page still shows it.
 */
function VerifyEmailPage({ t, theme, onContinue }: VerifyEmailPageProps) {
  const { verifyEmail } = useAuth();
  const token = useLinkToken();
  const location = useLocation();
  const navigate = useNavigate();
  const [verifiedBefore] = useState(() => (location.state as VerifiedEntryState | null)?.emailVerified === true);
  const attemptedRef = useRef(false);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<VerificationState>(() => {
    if (verifiedBefore) return 'success';
    return token ? 'verifying' : 'missing';
  });

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
    if (!mountedRef.current) return;
    setStatus(result.success ? 'success' : 'error');
    if (result.success) {
      const verified: VerifiedEntryState = { emailVerified: true };
      // The same address (its token already gone), now carrying the outcome
      void navigate({ search: globalThis.location.search }, { replace: true, state: verified });
    }
  }, [token, verifyEmail, navigate]);

  useEffect(() => {
    if (attemptedRef.current || verifiedBefore) return;
    attemptedRef.current = true;
    void runVerification();
  }, [runVerification, verifiedBefore]);

  const messages = {
    verifying: 'verifyingEmail', success: 'emailVerificationSuccess',
    missing: 'emailVerificationMissingToken', error: 'emailVerificationInvalid',
  };
  const message = t(messages[status]);

  return (
    <main className={`auth-page verify-email-page ${theme === 'light' ? 'light' : 'dark'}`}>
      <section className="auth-container verify-email-container" aria-labelledby="verify-email-title">
        <div className="auth-header">
          <img src="/thoughty-logo.svg" alt="Thoughty" className="auth-logo" />
          <h1 id="verify-email-title" className="auth-title">
            {t('verifyEmailTitle')}
          </h1>
        </div>

        <output
          className={`verify-email-status ${status === 'error' || status === 'missing' ? 'error' : ''}`}
          role={status === 'error' || status === 'missing' ? 'alert' : undefined}
          aria-live="polite"
        >
          {message}
        </output>

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
