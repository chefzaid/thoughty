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
  const [busySessionId, setBusySessionId] = useState<number | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadSessions = useCallback(async () => {
    setError('');
    setLoading(true);

    try {
      const response = await authFetch('/api/auth/sessions', {
        headers: buildRefreshTokenHeaders(),
      });
      const data = await safeJsonParse<ActiveSession[]>(response);

      if (!response.ok || !Array.isArray(data)) {
        throw new Error('Could not load active sessions');
      }

      setSessions(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load active sessions');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const revokeSession = async (sessionId: number) => {
    setError('');
    setSuccess('');
    setBusySessionId(sessionId);

    try {
      const response = await authFetch(`/api/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: buildRefreshTokenHeaders(),
      });

      if (!response.ok) {
        throw new Error('Could not revoke session');
      }

      setSuccess('Session revoked');
      await loadSessions();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Could not revoke session');
    } finally {
      setBusySessionId(null);
    }
  };

  const revokeOtherSessions = async () => {
    setError('');
    setSuccess('');
    setRevokingOthers(true);

    try {
      const response = await authFetch('/api/auth/sessions', {
        method: 'DELETE',
        headers: buildRefreshTokenHeaders(),
      });

      if (!response.ok) {
        throw new Error('Could not revoke other sessions');
      }

      setSuccess('Other sessions revoked');
      await loadSessions();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Could not revoke other sessions');
    } finally {
      setRevokingOthers(false);
    }
  };

  return (
    <div className="setting-row">
      <div className="setting-info">
        <span className="setting-label">Active sessions</span>
        <span className="setting-description">Review signed-in devices and end sessions you no longer use.</span>
      </div>

      {loading ? (
        <span className="setting-description">{t('loading')}...</span>
      ) : (
        <>
          {sessions.length === 0 ? (
            <span className="setting-description">No active sessions found.</span>
          ) : (
            <div className="billing-history">
              <table>
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Created</th>
                    <th>Expires</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id}>
                      <td>{session.current ? 'Current session' : `Session ${session.id}`}</td>
                      <td>{formatSessionDate(session.createdAt)}</td>
                      <td>{formatSessionDate(session.expiresAt)}</td>
                      <td>
                        <button
                          type="button"
                          className={`btn-download-data ${isDark ? 'dark' : 'light'}`}
                          disabled={session.current || busySessionId === session.id}
                          onClick={() => void revokeSession(session.id)}
                        >
                          {busySessionId === session.id ? 'Revoking...' : 'Revoke'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            type="button"
            className={`btn-change-password ${isDark ? 'dark' : 'light'}`}
            disabled={revokingOthers || sessions.filter((session) => !session.current).length === 0}
            onClick={() => void revokeOtherSessions()}
          >
            {revokingOthers ? 'Revoking...' : 'Sign out other sessions'}
          </button>
        </>
      )}

      {error && <div className="password-error">{error}</div>}
      {success && <div className="password-success">{success}</div>}
    </div>
  );
}

export default ActiveSessionsSection;
