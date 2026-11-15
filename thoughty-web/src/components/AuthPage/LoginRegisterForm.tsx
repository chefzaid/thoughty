import PasswordVisibilityToggle from './PasswordVisibilityToggle';
import { PASSWORD_SYMBOLS, type TranslationFunction } from './types';

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

function LoginRegisterForm({
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
}: Readonly<LoginRegisterFormProps>) {
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
            autoComplete="username"
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
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            aria-describedby={isLogin ? undefined : 'password-requirements'}
            required
          />
          <PasswordVisibilityToggle shown={showPassword} onToggle={() => setShowPassword(!showPassword)} t={t} />
        </div>
        {!isLogin && (
          <p id="password-requirements" className="auth-field-hint">
            {t('passwordRequirements', { symbols: PASSWORD_SYMBOLS })}
          </p>
        )}
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
            autoComplete="new-password"
            required
          />
        </div>
      )}

      <button type="submit" className="auth-submit-btn" disabled={loading}>
        {loading ? <span className="loading-spinner motion-loader animate-spin"></span> : submitLabel}
      </button>
    </>
  );
}

export default LoginRegisterForm;
