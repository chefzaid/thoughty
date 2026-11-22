import { useState } from 'react';

import type { TranslationFunction } from '../../types';
import '../AuthPage/AuthPage.css';

interface SessionUnreachablePageProps {
  readonly t: TranslationFunction;
  readonly theme?: 'light' | 'dark';
  /** Tries to confirm the session now; it is also tried again on its own. */
  readonly onRetry: () => Promise<unknown>;
  readonly onSignOut: () => Promise<void>;
}

/**
 * Shown to a writer who is signed in (the session went on) when Thoughty could not say whose session it
 * is and no writer remembered on this device is theirs: asking them to sign in again would be wrong, and
 * the session is confirmed as soon as Thoughty answers.
 */
export default function SessionUnreachablePage({ t, theme, onRetry, onSignOut }: SessionUnreachablePageProps) {
  const [trying, setTrying] = useState(false);
  const retry = async () => {
    setTrying(true);
    try {
      await onRetry();
    } finally {
      setTrying(false);
    }
  };

  return (
    <main className={`auth-page ${theme === 'light' ? 'light' : 'dark'}`} data-testid="session-unreachable">
      <section className="auth-container" aria-labelledby="session-unreachable-title">
        <div className="auth-header">
          <img src="/thoughty-logo.svg" alt="Thoughty" className="auth-logo" />
          <h1 id="session-unreachable-title" className="auth-title">
            {t('sessionUnreachableTitle')}
          </h1>
          <p className="auth-subtitle" role="status">{t('sessionUnreachableDetail')}</p>
        </div>
        <button type="button" className="auth-submit-btn" disabled={trying} onClick={() => void retry()}>
          {t('tryAgain')}
        </button>
        <div className="auth-switch">
          <button type="button" className="switch-btn" onClick={() => void onSignOut()}>
            {t('logout')}
          </button>
        </div>
      </section>
    </main>
  );
}
