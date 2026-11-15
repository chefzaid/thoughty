import { useState, type SubmitEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import AuthStatusMessages from '../AuthPage/AuthStatusMessages';
import type { TranslationFunction } from '../AuthPage/types';
import '../AuthPage/AuthPage.css';
import '../AuthPage/SignUpSteps.css';

interface CompleteSignUpPageProps {
  readonly t: TranslationFunction;
  readonly theme?: 'light' | 'dark';
  /** The account exists and its session started. */
  readonly onComplete: () => void;
  readonly onSignUp: () => void;
  readonly onSignIn: () => void;
}

/** Answers after which the link cannot create the account, so only signing up again or in is left. */
const LINK_DONE_ERRORS = new Set(['apiError_AUTH_INVALID_SIGN_UP_TOKEN', 'apiError_AUTH_EMAIL_TAKEN']);
const USERNAME_TAKEN = 'apiError_AUTH_USERNAME_TAKEN';

/**
 * The page the emailed sign-up link opens. It creates the account once the writer enters the
 * password they chose on the sign-up form, so a link sent to an address someone else signed up
 * with is of no use to them. A username taken since is asked for here.
 */
function CompleteSignUpPage({ t, theme, onComplete, onSignUp, onSignIn }: CompleteSignUpPageProps) {
  const { completeSignUp } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [needsUsername, setNeedsUsername] = useState(false);
  const [linkDone, setLinkDone] = useState(false);
  const [error, setError] = useState(token ? '' : t('completeSignUpMissingToken'));
  const [loading, setLoading] = useState(false);
  const fieldClass = theme === 'light' ? 'light' : 'dark';

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError('');
    if (needsUsername && !username.trim()) {
      setError(t('enterUsername'));
      return;
    }
    if (!password) {
      setError(t('enterPassword'));
      return;
    }

    setLoading(true);
    const result = await completeSignUp(token, password, needsUsername ? username.trim() : undefined);
    setLoading(false);
    if (result.success) {
      onComplete();
      return;
    }
    if (result.error === USERNAME_TAKEN) {
      setNeedsUsername(true);
      setError(t('completeSignUpUsernameTaken'));
      return;
    }
    setLinkDone(LINK_DONE_ERRORS.has(result.error ?? ''));
    setError(t(result.error || 'completeSignUpFailed'));
  };

  const showForm = Boolean(token) && !linkDone;

  return (
    <main className={`auth-page ${fieldClass}`}>
      <section className="auth-container" aria-labelledby="complete-sign-up-title">
        <div className="auth-header">
          <img src="/thoughty-logo.svg" alt="Thoughty" className="auth-logo" />
          <h1 id="complete-sign-up-title" className="auth-title">{t('completeSignUpTitle')}</h1>
          {showForm && <p className="auth-subtitle">{t('completeSignUpIntro')}</p>}
        </div>

        {showForm ? (
          <form className="auth-form" onSubmit={handleSubmit}>
            <AuthStatusMessages error={error} />
            {needsUsername && (
              <div className="form-group">
                <label htmlFor="complete-sign-up-username">{t('username')}</label>
                <input
                  id="complete-sign-up-username"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder={t('enterUsername')}
                  className={fieldClass}
                  autoComplete="username"
                  required
                />
              </div>
            )}
            <div className="form-group">
              <label htmlFor="complete-sign-up-password">{t('password')}</label>
              <input
                id="complete-sign-up-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t('enterPassword')}
                className={fieldClass}
                autoComplete="current-password"
                required
              />
            </div>
            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? <span className="loading-spinner motion-loader animate-spin"></span> : t('completeSignUpSubmit')}
            </button>
          </form>
        ) : (
          <div className="sign-up-step">
            <AuthStatusMessages error={error} />
            <div className="sign-up-step-actions">
              <button type="button" className="auth-submit-btn" onClick={onSignUp}>{t('signUpAgain')}</button>
              <button type="button" className="sign-up-step-link" onClick={onSignIn}>{t('signIn')}</button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export default CompleteSignUpPage;
