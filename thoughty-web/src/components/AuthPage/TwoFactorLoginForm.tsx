import type { TranslationFunction } from './types';

interface TwoFactorLoginFormProps {
  code: string;
  setCode: (value: string) => void;
  loading: boolean;
  isDark: boolean;
  t: TranslationFunction;
  onResend: () => void;
  onBack: () => void;
}

function TwoFactorLoginForm({
  code,
  setCode,
  loading,
  isDark,
  t,
  onResend,
  onBack,
}: Readonly<TwoFactorLoginFormProps>) {
  return (
    <>
      <div className="form-group">
        <label htmlFor="two-factor-code">{t('twoFactorCode')}</label>
        <input
          id="two-factor-code"
          className={isDark ? 'dark' : 'light'}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder={t('twoFactorCodePlaceholder')}
          autoFocus
          required
        />
      </div>
      <button type="submit" className="auth-submit-btn" disabled={loading || code.length !== 6}>
        {loading ? <span className="loading-spinner" /> : t('verifyAndSignIn')}
      </button>
      <div className="two-factor-actions">
        <button type="button" className="back-to-login-btn" onClick={onBack} disabled={loading}>
          {t('backToLogin')}
        </button>
        <button type="button" className="forgot-password-link" onClick={onResend} disabled={loading}>
          {t('resendCode')}
        </button>
      </div>
    </>
  );
}

export default TwoFactorLoginForm;
