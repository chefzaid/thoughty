import React from 'react';
import type { TranslationFunction } from './types';

interface LoginRegisterFormProps {
  isLogin: boolean;
  isDark: boolean;
  t: TranslationFunction;
  loading: boolean;
  identifier: string;
  setIdentifier: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  username: string;
  setUsername: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  handleForgotPassword: () => void;
}

const LoginRegisterForm: React.FC<LoginRegisterFormProps> = ({
  isLogin,
  isDark,
  t,
  loading,
  identifier,
  setIdentifier,
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  username,
  setUsername,
  showPassword,
  setShowPassword,
  handleForgotPassword
}) => {
  const submitLabel = isLogin ? t('signIn') : t('signUp');
  const passwordType = showPassword ? 'text' : 'password';

  return (
    <>
      {!isLogin && (
        <div className="form-group">
          <label htmlFor="username">{t('username')}</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t('enterUsername')}
            className={isDark ? 'dark' : 'light'}
          />
        </div>
      )}

      {isLogin ? (
        <div className="form-group">
          <label htmlFor="identifier">{t('emailOrUsername')}</label>
          <input
            id="identifier"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={t('enterEmailOrUsername')}
            className={isDark ? 'dark' : 'light'}
            required
          />
        </div>
      ) : (
        <div className="form-group">
          <label htmlFor="email">{t('email')}</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('enterEmail')}
            className={isDark ? 'dark' : 'light'}
            required
          />
        </div>
      )}

      <div className="form-group">
        <label htmlFor="password">{t('password')}</label>
        <div className="password-input-wrapper">
          <input
            id="password"
            type={passwordType}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('enterPassword')}
            className={isDark ? 'dark' : 'light'}
            required
          />
          <button
            type="button"
            className="toggle-password"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? t('hidePassword') : t('showPassword')}
          >
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        {isLogin && (
          <button type="button" className="forgot-password-link" onClick={handleForgotPassword}>
            {t('forgotPassword')}
          </button>
        )}
      </div>

      {!isLogin && (
        <div className="form-group">
          <label htmlFor="confirmPassword">{t('confirmPassword')}</label>
          <input
            id="confirmPassword"
            type={passwordType}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t('confirmPasswordPlaceholder')}
            className={isDark ? 'dark' : 'light'}
            required
          />
        </div>
      )}

      <button type="submit" className="auth-submit-btn" disabled={loading}>
        {loading ? <span className="loading-spinner"></span> : submitLabel}
      </button>
    </>
  );
};

export default LoginRegisterForm;
