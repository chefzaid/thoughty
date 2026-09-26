import { useCallback, useEffect, useState } from 'react';
import { safeJsonParse } from '../../services/api/base';
import { useAuth } from '../../contexts/AuthContext';
import type { TranslationFunction } from './types';

interface ActiveSession {
  id: number;
  current: boolean;
  createdAt: string;
  expiresAt: string;
}

interface ActiveSessionsSectionProps {
  isDark: boolean;
  t: TranslationFunction;
}

const getRefreshToken = (): string => localStorage.getItem('refreshToken') ?? '';

function formatSessionDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function buildRefreshTokenHeaders(): HeadersInit {
  const refreshToken = getRefreshToken();
  return refreshToken ? { 'X-Refresh-Token': refreshToken } : {};
}

function ActiveSessionsSection({ isDark, t }: Readonly<ActiveSessionsSectionProps>) {
  const { authFetch } = useAuth();
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busySessionId, setBusySessionId] = useState<number | 'others' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch('/api/auth/sessions', {
        headers: buildRefreshTokenHeaders(),
      });
      const data = await safeJsonParse<ActiveSession[]>(response);
      if (!response.ok || !Array.isArray(data)) {
        throw new Error('Unexpected sessions response');
      }
      setSessions(data);
    } catch {
      setError(t('sessionsLoadError'));
    } finally {
      setLoading(false);
    }
  }, [authFetch, t]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const revoke = async (target: number | 'others') => {
    setError('');
    setSuccess('');
    setBusySessionId(target);
    try {
      const url = target === 'others' ? '/api/auth/sessions' : `/api/auth/sessions/${target}`;
      const response = await authFetch(url, { method: 'DELETE', headers: buildRefreshTokenHeaders() });
      if (!response.ok) {
        throw new Error('Session revocation failed');
      }
      setSuccess(t(target === 'others' ? 'otherSessionsRevoked' : 'sessionRevoked'));
      await loadSessions();
    } catch {
      setError(t('sessionRevokeError'));
    } finally {
      setBusySessionId(null);
    }
  };

  const hasOtherSessions = sessions.some((session) => !session.current);

  return (
    <div className="setting-row">
      <div className="setting-info">
        <span className="setting-label">{t('activeSessions')}</span>
        <span className="setting-description">{t('activeSessionsDescription')}</span>
      </div>

      {loading && <span className="setting-description">{t('loading')}...</span>}
      {!loading && !error && sessions.length === 0 && (
        <span className="setting-description">{t('noActiveSessions')}</span>
      )}
      {!loading && sessions.length > 0 && (
        <>
          <div className="billing-history">
            <table>
              <thead>
                <tr>
                  <th>{t('session')}</th>
                  <th>{t('sessionCreated')}</th>
                  <th>{t('sessionExpires')}</th>
                  <th>{t('sessionAction')}</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td>{session.current ? t('currentSession') : t('sessionNumber', { id: session.id })}</td>
                    <td>{formatSessionDate(session.createdAt)}</td>
                    <td>{formatSessionDate(session.expiresAt)}</td>
                    <td>
                      <button
                        type="button"
                        className={`btn-download-data ${isDark ? 'dark' : 'light'}`}
                        disabled={session.current || busySessionId !== null}
                        onClick={() => void revoke(session.id)}
                      >
                        {busySessionId === session.id ? t('revoking') : t('revoke')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            className={`btn-change-password ${isDark ? 'dark' : 'light'}`}
            disabled={busySessionId !== null || !hasOtherSessions}
            onClick={() => void revoke('others')}
          >
            {busySessionId === 'others' ? t('revoking') : t('signOutOtherSessions')}
          </button>
        </>
      )}

      {error && <div className="password-error">{error}</div>}
      {success && <div className="password-success">{success}</div>}
    </div>
  );
}

export default ActiveSessionsSection;
