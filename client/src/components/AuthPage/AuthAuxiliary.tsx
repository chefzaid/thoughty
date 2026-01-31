import React from 'react';
import type { TranslationFunction } from './types';

interface AuthAuxiliaryProps {
  showForgotPassword: boolean;
  googleClientId?: string;
  loading: boolean;
  handleGoogleSignIn: () => void;
  isLogin: boolean;
  switchMode: () => void;
  t: TranslationFunction;
}

const AuthAuxiliary: React.FC<AuthAuxiliaryProps> = ({
  showForgotPassword,
  googleClientId,
  loading,
  handleGoogleSignIn,
  isLogin,
  switchMode,
  t
}) => {
  if (showForgotPassword) return null;

  const switchPrompt = isLogin ? t('dontHaveAccount') : t('alreadyHaveAccount');
  const switchAction = isLogin ? t('signUp') : t('signIn');

  return (
    <>
      <div className="auth-divider">
        <span>{t('orContinueWith')}</span>
      </div>

      <div className="social-buttons">
        {googleClientId && (
          <button
            type="button"
            className="social-btn google-btn"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" className="social-icon">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span>{t('continueWithGoogle')}</span>
          </button>
        )}
      </div>

      <div className="auth-switch">
        <p>
          {switchPrompt}{' '}
          <button type="button" onClick={switchMode} className="switch-btn">
            {switchAction}
          </button>
        </p>
      </div>
    </>
  );
};

export default AuthAuxiliary;
