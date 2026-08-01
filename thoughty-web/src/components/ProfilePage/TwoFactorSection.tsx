import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  disableTwoFactor,
  enableTwoFactor,
  getTwoFactorStatus,
  startTwoFactorSetup,
  type TwoFactorStatus,
} from '../../contexts/twoFactorRequests';
import type { TranslationFunction } from './types';
import './TwoFactorSection.css';

interface TwoFactorSectionProps {
  isDark: boolean;
  t: TranslationFunction;
}

function TwoFactorSection({ isDark, t }: Readonly<TwoFactorSectionProps>) {
  const { user, authFetch } = useAuth();
  const [status, setStatus] = useState<TwoFactorStatus>({
    enabled: Boolean(user?.twoFactorEnabled),
    available: user?.authProvider === 'local',
    emailVerified: Boolean(user?.emailVerified),
  });
  const [challengeToken, setChallengeToken] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showDisable, setShowDisable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void getTwoFactorStatus(authFetch).then((data) => {
      if (active) setStatus(data);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [authFetch]);

  const runRequest = async <T,>(request: () => Promise<T>): Promise<T | null> => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      return await request();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('twoFactorRequestFailed'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const startSetup = async (): Promise<void> => {
    const challenge = await runRequest(() => startTwoFactorSetup(authFetch));
    if (challenge) {
      setChallengeToken(challenge.challengeToken);
      setCode('');
      setMessage(t('twoFactorSetupCodeSent'));
    }
  };

  const enable = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const result = await runRequest(() => enableTwoFactor(authFetch, challengeToken, code));
    if (result?.success) {
      setStatus((current) => ({ ...current, enabled: true }));
      setChallengeToken('');
      setCode('');
      setMessage(t('twoFactorEnabledSuccess'));
    }
  };

  const disable = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const result = await runRequest(() => disableTwoFactor(authFetch, password));
    if (result?.success) {
      setStatus((current) => ({ ...current, enabled: false }));
      setPassword('');
      setShowDisable(false);
      setMessage(t('twoFactorDisabledSuccess'));
    }
  };

  const unavailableMessage = !status.available
    ? t('twoFactorPasswordAccountsOnly')
    : t('twoFactorVerifyEmailFirst');

  return (
    <div className="two-factor-section">
      <div className="setting-row">
        <div className="setting-info">
          <span className="setting-label">{t('twoFactorAuthentication')}</span>
          <span className="setting-description">
            {status.enabled ? t('twoFactorEnabledDescription') : t('twoFactorDisabledDescription')}
          </span>
        </div>
        <span className={`two-factor-status ${status.enabled ? 'enabled' : ''}`}>
          {status.enabled ? t('enabled') : t('disabled')}
        </span>
      </div>

      {!status.enabled && (!status.available || !status.emailVerified) && (
        <p className="setting-description two-factor-note">{unavailableMessage}</p>
      )}

      {!status.enabled && status.available && status.emailVerified && !challengeToken && (
        <button type="button" className="btn-change-password" onClick={() => void startSetup()} disabled={busy}>
          {busy ? t('sending') : t('enableTwoFactor')}
        </button>
      )}

      {challengeToken && (
        <form className="two-factor-form" onSubmit={(event) => void enable(event)}>
          <label className="setting-label" htmlFor="profile-two-factor-code">{t('twoFactorCode')}</label>
          <input
            id="profile-two-factor-code"
            className={`setting-input ${isDark ? 'dark' : 'light'}`}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={t('twoFactorCodePlaceholder')}
            required
          />
          <button type="submit" className="btn-change-password" disabled={busy || code.length !== 6}>
            {busy ? t('verifying') : t('confirmTwoFactor')}
          </button>
        </form>
      )}

      {status.enabled && !showDisable && (
        <button type="button" className="btn-two-factor-disable" onClick={() => setShowDisable(true)}>
          {t('disableTwoFactor')}
        </button>
      )}

      {status.enabled && showDisable && (
        <form className="two-factor-form" onSubmit={(event) => void disable(event)}>
          <label className="setting-label" htmlFor="two-factor-password">{t('currentPassword')}</label>
          <input
            id="two-factor-password"
            className={`setting-input ${isDark ? 'dark' : 'light'}`}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t('enterCurrentPassword')}
            required
          />
          <div className="two-factor-form-actions">
            <button type="button" className="btn-cancel-delete" onClick={() => setShowDisable(false)}>
              {t('cancel')}
            </button>
            <button type="submit" className="btn-two-factor-disable" disabled={busy || !password}>
              {busy ? t('disabling') : t('disableTwoFactor')}
            </button>
          </div>
        </form>
      )}

      {error && <div className="password-error">{error}</div>}
      {message && <div className="password-success">{message}</div>}
    </div>
  );
}

export default TwoFactorSection;
