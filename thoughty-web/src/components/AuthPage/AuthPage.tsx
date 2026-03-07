import React, { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { validateAuthForm, getAuthSubtitleText } from './types';
import type { TranslationFunction, AuthResult } from './types';
import AuthFormContent from './AuthFormContent';
import AuthStatusMessages from './AuthStatusMessages';
import AuthAuxiliary from './AuthAuxiliary';
import './AuthPage.css';

interface AuthPageProps {
  readonly t: TranslationFunction;
  readonly theme?: 'light' | 'dark';
  readonly onAuthSuccess?: () => void;
}

function AuthPage({ t, theme, onAuthSuccess }: AuthPageProps): React.ReactElement {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [showForgotPassword, setShowForgotPassword] = useState<boolean>(false);
  const [identifier, setIdentifier] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const { login, register, signInWithGoogle, forgotPassword, googleClientId } = useAuth();

  const isDark = theme !== 'light';

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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!validateForm()) return;

    setLoading(true);

    try {
      if (showForgotPassword) {
        const result = await forgotPassword(email);
        if (result.success) {
          setSuccessMessage(t('resetEmailSent'));
        } else {
          setError(result.error || t('forgotPasswordFailed'));
        }
        setLoading(false);
        return;
      }

      let result: AuthResult;
      if (isLogin) {
        result = await login(identifier, password);
      } else {
        result = await register(email, password, username);
      }

      if (result.success) {
        onAuthSuccess?.();
      } else {
        setError(result.error || t('authFailed'));
      }
    } catch (err) {
      setError((err as Error).message || t('authFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async (): Promise<void> => {
    setError('');
    setLoading(true);

    try {
      const result = await signInWithGoogle();
      if (result.success) {
        onAuthSuccess?.();
      } else {
        setError(result.error || t('googleSignInFailed'));
      }
    } catch (err) {
      setError((err as Error).message || t('googleSignInFailed'));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (): void => {
    setIsLogin(!isLogin);
    setShowForgotPassword(false);
    setError('');
    setSuccessMessage('');
    setPassword('');
    setConfirmPassword('');
    setIdentifier('');
    setEmail('');
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

  const getAuthSubtitle = (): string => getAuthSubtitleText({ showForgotPassword, isLogin, t });

  return (
    <div className={`auth-page ${isDark ? 'dark' : 'light'}`}>
      <div className="auth-container">
        <div className="auth-header">
          <img src="/thoughty-logo.svg" alt="Thoughty" className="auth-logo" />
          <h1 className="auth-title">Thoughty</h1>
          <p className="auth-subtitle">{getAuthSubtitle()}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <AuthStatusMessages error={error} successMessage={successMessage} />
          <AuthFormContent
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
          />
        </form>

        <AuthAuxiliary
          showForgotPassword={showForgotPassword}
          googleClientId={googleClientId}
          loading={loading}
          handleGoogleSignIn={handleGoogleSignIn}
          isLogin={isLogin}
          switchMode={switchMode}
          t={t}
        />

        <div id="google-signin-btn" style={{ display: 'none' }}></div>
      </div>
    </div>
  );
}

export default AuthPage;
