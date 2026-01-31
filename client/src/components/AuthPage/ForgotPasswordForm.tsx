import React from 'react';
import type { TranslationFunction } from './types';

interface ForgotPasswordFormProps {
  email: string;
  setEmail: (email: string) => void;
  isDark: boolean;
  t: TranslationFunction;
  loading: boolean;
  handleBackToLogin: () => void;
}

const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  email,
  setEmail,
  isDark,
  t,
  loading,
  handleBackToLogin
}) => (
  <>
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

    <button type="submit" className="auth-submit-btn" disabled={loading}>
      {loading ? <span className="loading-spinner"></span> : t('sendResetLink')}
    </button>

    <button type="button" className="back-to-login-btn" onClick={handleBackToLogin}>
      {t('backToLogin')}
    </button>
  </>
);

export default ForgotPasswordForm;
