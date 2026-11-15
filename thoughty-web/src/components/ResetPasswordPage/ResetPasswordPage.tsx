import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import AuthStatusMessages from '../AuthPage/AuthStatusMessages';
import ForgotPasswordForm from '../AuthPage/ForgotPasswordForm';
import PasswordVisibilityToggle from '../AuthPage/PasswordVisibilityToggle';
import {
  PASSWORD_SYMBOLS,
  validateForgotPassword,
  validateNewPassword,
  type TranslationFunction,
} from '../AuthPage/types';
import '../AuthPage/AuthPage.css';
import '../AuthPage/SignUpSteps.css';
import './ResetPasswordPage.css';

interface ResetPasswordPageProps {
  readonly t: TranslationFunction;
  readonly theme?: 'light' | 'dark';
  readonly onSignIn: () => void;
}

/** The new password form, the link that cannot work (with a form for a new one), or done. */
type Step = 'password' | 'newLink' | 'done';

const INVALID_LINK = 'apiError_AUTH_INVALID_RESET_TOKEN';

/**
 * The page the emailed password reset link opens. The link's token is taken from the address and
 * removed from it (and from the history entry) at once, so it is not left in the address bar, the
 * history or a later referrer. The reset signs every session out and signs nobody in: the writer
 * then signs in with the new password, two-factor code included.
 */
function ResetPasswordPage({ t, theme, onSignIn }: ResetPasswordPageProps) {
  const { resetPassword, forgotPassword, isAuthenticated, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [token] = useState(() => searchParams.get('token')?.trim() ?? '');
  const [step, setStep] = useState<Step>(token ? 'password' : 'newLink');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState(token ? '' : t('resetPasswordMissingToken'));
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const isDark = theme !== 'light';
  const fieldClass = isDark ? 'dark' : 'light';
  const passwordType = showPassword ? 'text' : 'password';

  useEffect(() => {
    if (searchParams.has('token')) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const goTo = (next: Step): void => {
    setStep(next);
    // The form the focus was in is gone: start again from the page's title
    requestAnimationFrame(() => titleRef.current?.focus());
  };

  const handleReset = async (event: SubmitEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError('');
    const invalid = validateNewPassword({ password, confirmPassword, t });
    if (invalid) {
      setError(invalid);
      return;
    }

    setLoading(true);
    const result = await resetPassword(token, password);
    if (result.success) {
      // Every session of the account was revoked; this browser signs in again too
      if (isAuthenticated) await logout();
      setLoading(false);
      setPassword('');
      setConfirmPassword('');
      setSuccessMessage(t('resetPasswordDone'));
      goTo('done');
      return;
    }
    setLoading(false);
    setError(t(result.error || 'resetPasswordFailed'));
    if (result.error === INVALID_LINK) goTo('newLink');
  };

  const handleNewLink = async (event: SubmitEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    const invalid = validateForgotPassword({ email, t });
    if (invalid) {
      setError(invalid);
      return;
    }

    setLoading(true);
    const result = await forgotPassword(email);
    setLoading(false);
    if (result.success) {
      setSuccessMessage(t('resetEmailSent'));
    } else {
      setError(t(result.error || 'forgotPasswordFailed'));
    }
  };

  return (
    <main className={`auth-page ${fieldClass}`}>
      <section className="auth-container" aria-labelledby="reset-password-title">
        <div className="auth-header">
          <img src="/thoughty-logo.svg" alt="Thoughty" className="auth-logo" />
          <h1 id="reset-password-title" className="auth-title" ref={titleRef} tabIndex={-1}>
            {step === 'newLink' ? t('resetYourPassword') : t('resetPasswordTitle')}
          </h1>
          {step === 'password' && <p className="auth-subtitle">{t('resetPasswordIntro')}</p>}
        </div>

        {step === 'password' && (
          <form className="auth-form" onSubmit={handleReset} noValidate>
            <AuthStatusMessages error={error} />
            <div className="form-group">
              <label htmlFor="reset-password-new">{t('newPassword')}</label>
              <div className="password-input-wrapper">
                <input
                  id="reset-password-new"
                  type={passwordType}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t('enterNewPassword')}
                  className={fieldClass}
                  autoComplete="new-password"
                  aria-describedby="reset-password-requirements"
                  required
                />
                <PasswordVisibilityToggle shown={showPassword} onToggle={() => setShowPassword(!showPassword)} t={t} />
              </div>
              <p id="reset-password-requirements" className="auth-field-hint">
                {t('passwordRequirements', { symbols: PASSWORD_SYMBOLS })}
              </p>
            </div>
            <div className="form-group">
              <label htmlFor="reset-password-confirm">{t('confirmPassword')}</label>
              <input
                id="reset-password-confirm"
                type={passwordType}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder={t('confirmPasswordPlaceholder')}
                className={fieldClass}
                autoComplete="new-password"
                required
              />
            </div>
            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? <span className="loading-spinner motion-loader animate-spin"></span> : t('resetPasswordSubmit')}
            </button>
          </form>
        )}

        {step === 'newLink' && (
          <form className="auth-form" onSubmit={handleNewLink} noValidate>
            <AuthStatusMessages error={error} successMessage={successMessage} />
            <p className="sign-up-step-text">{t('resetPasswordNewLinkIntro')}</p>
            <ForgotPasswordForm
              email={email}
              setEmail={setEmail}
              isDark={isDark}
              t={t}
              loading={loading}
              handleBackToLogin={onSignIn}
            />
          </form>
        )}

        {step === 'done' && (
          <div className="sign-up-step">
            <AuthStatusMessages successMessage={successMessage} />
            <div className="sign-up-step-actions">
              <button type="button" className="auth-submit-btn" onClick={onSignIn}>{t('signIn')}</button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export default ResetPasswordPage;
