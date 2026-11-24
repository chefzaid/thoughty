import { useState, useEffect, useRef, type SubmitEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { SignUpPreferences } from '../../contexts/authTypes';
import type { Language } from '../../utils/translations';
import { validateAuthForm, getAuthSubtitleText } from './types';
import type { TranslationFunction, AuthResult } from './types';
import AuthFormContent from './AuthFormContent';
import AuthStatusMessages from './AuthStatusMessages';
import AuthAuxiliary from './AuthAuxiliary';
import TwoFactorLoginForm from './TwoFactorLoginForm';
import SignUpEmailSent from './SignUpEmailSent';
import { clearKeycloakSsoFailure, hasKeycloakSsoFailure, startKeycloakSso } from '../../utils/keycloakSso';
import './AuthPage.css';

interface AuthPageProps {
  readonly t: TranslationFunction;
  readonly theme?: 'light' | 'dark';
  /** The language the page is shown in, sent with the theme when signing up, for the new account. */
  readonly language?: Language;
  readonly onAuthSuccess?: () => void;
  readonly mode?: 'login' | 'register';
  readonly onModeChange?: (mode: 'login' | 'register') => void;
  readonly onBack?: () => void;
}

function AuthPage({ t, theme, language, onAuthSuccess, mode = 'login', onModeChange, onBack }: AuthPageProps) {
  const [currentMode, setCurrentMode] = useState<'login' | 'register'>(mode);
  const [showForgotPassword, setShowForgotPassword] = useState<boolean>(false);
  const [identifier, setIdentifier] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  // A failed return from Keycloak is reported once, on the sign-in page it came back to
  const [error, setError] = useState<string>(() => (hasKeycloakSsoFailure() ? t('ssoSignInFailed') : ''));
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [website, setWebsite] = useState<string>('');
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<string>('');
  const [twoFactorCode, setTwoFactorCode] = useState<string>('');
  // When the last sign-up email was asked for; set only while "check your email" is shown
  const [signUpEmailSentAt, setSignUpEmailSentAt] = useState<number | null>(null);

  const {
    login,
    register,
    signInWithGoogle,
    forgotPassword,
    verifyTwoFactor,
    resendTwoFactor,
    googleClientId,
  } = useAuth();

  const isDark = theme !== 'light';
  const isLogin = currentMode === 'login';
  // What the visitor sees now: an account created from this page (a form, Google, Keycloak) starts with it
  const signUpPreferences: SignUpPreferences = { ...(language ? { language } : {}), ...(theme ? { theme } : {}) };

  // Load Google SDK
  useEffect(() => {
    if (googleClientId && !(globalThis as { google?: unknown }).google) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, [googleClientId]);

  useEffect(() => {
    clearKeycloakSsoFailure();
  }, []);

  // The form starts in `mode`; it is reset only when the route switches modes afterwards
  const renderedMode = useRef(mode);
  useEffect(() => {
    if (renderedMode.current === mode) return;
    renderedMode.current = mode;
    setCurrentMode(mode);
    setShowForgotPassword(false);
    setError('');
    setSuccessMessage('');
    setTwoFactorChallenge('');
    setTwoFactorCode('');
    setSignUpEmailSentAt(null);
  }, [mode]);

  const validateForm = (): boolean => {
    const validationError = validateAuthForm({
      showForgotPassword,
      isLogin,
      identifier,
      email,
      username,
      password,
      confirmPassword,
      t
    });
    if (validationError) {
      setError(validationError);
      return false;
    }
    return true;
  };

  const submitTwoFactor = async (challenge: string): Promise<void> => {
    if (twoFactorCode.length !== 6) {
      setError(t('enterSixDigitCode'));
      return;
    }
    setLoading(true);
    const result = await verifyTwoFactor(challenge, twoFactorCode);
    setLoading(false);
    if (result.success) {
      onAuthSuccess?.();
    } else {
      setError(t(result.error || 'twoFactorVerificationFailed'));
    }
  };

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (twoFactorChallenge) {
      await submitTwoFactor(twoFactorChallenge);
      return;
    }

    if (!validateForm()) return;

    setLoading(true);

    try {
      if (showForgotPassword) {
        const result = await forgotPassword(email);
        if (result.success) {
          setSuccessMessage(t('resetEmailSent'));
        } else {
          setError(t(result.error || 'forgotPasswordFailed'));
        }
        setLoading(false);
        return;
      }

      let result: AuthResult;
      if (isLogin) {
        result = await login(identifier, password, website);
      } else {
        result = await register(email, password, username, website, signUpPreferences);
      }

      if (result.verificationRequired) {
        setSignUpEmailSentAt(Date.now());
      } else if (result.twoFactorRequired && result.challengeToken) {
        setTwoFactorChallenge(result.challengeToken);
        setTwoFactorCode('');
        setPassword('');
        setSuccessMessage(t('twoFactorCodeSent'));
      } else if (result.success) {
        onAuthSuccess?.();
      } else {
        setError(t(result.error || 'authFailed'));
      }
    } catch (err) {
      setError(t((err as Error).message || 'authFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async (): Promise<void> => {
    setError('');
    setLoading(true);

    try {
      const result = await signInWithGoogle(signUpPreferences);
      if (result.success) {
        onAuthSuccess?.();
      } else {
        setError(t(result.error || 'googleSignInFailed'));
      }
    } catch (err) {
      setError(t((err as Error).message || 'googleSignInFailed'));
    } finally {
      setLoading(false);
    }
  };

  const resetAuthFields = (): void => {
    setPassword('');
    setConfirmPassword('');
    setIdentifier('');
    setEmail('');
    setUsername('');
    setWebsite('');
  };

  const handleResendTwoFactor = async (): Promise<void> => {
    setLoading(true);
    setError('');
    setSuccessMessage('');
    const result = await resendTwoFactor(twoFactorChallenge);
    setLoading(false);
    if (result.success && result.challengeToken) {
      setTwoFactorChallenge(result.challengeToken);
      setTwoFactorCode('');
      setSuccessMessage(t('twoFactorCodeResent'));
    } else {
      setError(t(result.error || 'twoFactorResendFailed'));
    }
  };

  // Asks again with the same form: the server sends a new link only once a minute has passed
  const handleResendSignUp = async (): Promise<void> => {
    setLoading(true);
    setError('');
    setSuccessMessage('');
    const result = await register(email, password, username, website, signUpPreferences);
    setLoading(false);
    if (result.success) {
      setSignUpEmailSentAt(Date.now());
      setSuccessMessage(t('signUpEmailResent'));
    } else {
      setError(t(result.error || 'authFailed'));
    }
  };

  const handleUseAnotherEmail = (): void => {
    setSignUpEmailSentAt(null);
    setError('');
    setSuccessMessage('');
  };

  const handleTwoFactorBack = (): void => {
    setTwoFactorChallenge('');
    setTwoFactorCode('');
    setError('');
    setSuccessMessage('');
  };

  const switchMode = (): void => {
    const nextMode = isLogin ? 'register' : 'login';
    setShowForgotPassword(false);
    setError('');
    setSuccessMessage('');
    resetAuthFields();

    if (onModeChange) {
      onModeChange(nextMode);
      return;
    }

    setCurrentMode(nextMode);
  };

  const handleForgotPassword = (): void => {
    setShowForgotPassword(true);
    setError('');
    setSuccessMessage('');
  };

  const handleBackToLogin = (): void => {
    setShowForgotPassword(false);
    setError('');
    setSuccessMessage('');
  };

  const getAuthSubtitle = (): string => {
    if (signUpEmailSentAt !== null) return t('signUpCheckEmailTitle');
    if (twoFactorChallenge) return t('twoFactorLoginSubtitle');
    return getAuthSubtitleText({ showForgotPassword, isLogin, t });
  };

  return (
    <main className={`auth-page ${isDark ? 'dark' : 'light'}`}>
      <div className="auth-container">
        {onBack && (
          <button type="button" className="auth-back-btn" onClick={onBack}>
            {t('back')}
          </button>
        )}
        <div className="auth-header">
          <img src="/thoughty-logo.svg" alt="Thoughty" className="auth-logo" />
          <h1 className="auth-title">Thoughty</h1>
          <p className="auth-subtitle">{getAuthSubtitle()}</p>
        </div>

        {signUpEmailSentAt !== null ? (
          <SignUpEmailSent
            email={email}
            t={t}
            loading={loading}
            error={error}
            successMessage={successMessage}
            sentAt={signUpEmailSentAt}
            onResend={() => void handleResendSignUp()}
            onUseAnotherEmail={handleUseAnotherEmail}
          />
        ) : <form onSubmit={handleSubmit} className="auth-form">
          <AuthStatusMessages error={error} successMessage={successMessage} />
          <div className="auth-honeypot" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              type="text"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>
          {twoFactorChallenge ? (
            <TwoFactorLoginForm
              code={twoFactorCode}
              setCode={setTwoFactorCode}
              loading={loading}
              isDark={isDark}
              t={t}
              onResend={() => void handleResendTwoFactor()}
              onBack={handleTwoFactorBack}
            />
          ) : <AuthFormContent
            showForgotPassword={showForgotPassword}
            isLogin={isLogin}
            isDark={isDark}
            t={t}
            loading={loading}
            identifier={identifier}
            setIdentifier={setIdentifier}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            username={username}
            setUsername={setUsername}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            handleForgotPassword={handleForgotPassword}
            handleBackToLogin={handleBackToLogin}
          />}
        </form>}

        {!twoFactorChallenge && signUpEmailSentAt === null && <AuthAuxiliary
          showForgotPassword={showForgotPassword}
          googleClientId={googleClientId}
          loading={loading}
          keycloakSsoEnabled={import.meta.env.PROD}
          handleKeycloakSignIn={() => startKeycloakSso(globalThis.location.href, signUpPreferences)}
          handleGoogleSignIn={handleGoogleSignIn}
          isLogin={isLogin}
          switchMode={switchMode}
          t={t}
        />}

        <div id="google-signin-btn" style={{ display: 'none' }}></div>
      </div>
    </main>
  );
}

export default AuthPage;
