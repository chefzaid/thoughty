import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAccountActions } from './useAccountActions';
import type { User } from './authTypes';

const json = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  clone() { return this; },
  text: async () => JSON.stringify(body),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

const ADA: User = {
  id: 1,
  username: 'ada',
  email: 'user-1@invalid',
  authProvider: 'local',
  emailVerified: false,
  emailMissing: true,
  twoFactorEnabled: false,
  isNewUser: false,
};
const me = (overrides: Record<string, unknown>) => ({ ...ADA, createdAt: '2026-01-01T00:00:00.000Z', ...overrides });

describe('useAccountActions: an account without an email address', () => {
  const setError = vi.fn();
  const setUser = vi.fn();
  const authFetch = vi.fn();
  const renderAccount = () => renderHook(() => useAccountActions({
    authFetch,
    signOutLocally: vi.fn(),
    setError,
    setUser,
  })).result;
  /** What the last `setUser` call makes of `current`. */
  const updated = (current: User | null) => (setUser.mock.calls.at(-1)?.[0] as (user: User | null) => User | null)(current);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gives the address and keeps what the API says of it, the session’s own fields included', async () => {
    authFetch.mockResolvedValue(json(me({ pendingEmail: 'ada@example.com' })));
    const actions = renderAccount();

    let result;
    await act(async () => {
      result = await actions.current.addEmail('ada@example.com');
    });

    expect(result).toEqual({ success: true });
    expect(authFetch).toHaveBeenCalledWith('/api/auth/add-email', {
      method: 'POST',
      body: JSON.stringify({ email: 'ada@example.com' }),
    });
    expect(updated(ADA)).toEqual({ ...ADA, pendingEmail: 'ada@example.com' });
    // Another writer's session is left as it is
    expect(updated({ ...ADA, id: 2 })).toEqual({ ...ADA, id: 2 });
    expect(updated(null)).toBeNull();
  });

  it('reports a refusal by its code, and falls back when the request fails without one', async () => {
    authFetch.mockResolvedValue(json({ statusCode: 409, code: 'AUTH_EMAIL_TAKEN', message: 'Email already registered' }, 409));
    const actions = renderAccount();

    let result;
    await act(async () => {
      result = await actions.current.addEmail('taken@example.com');
    });
    expect(result).toEqual({ success: false, error: 'apiError_AUTH_EMAIL_TAKEN' });

    authFetch.mockRejectedValue('offline');
    await act(async () => {
      result = await actions.current.addEmail('ada@example.com');
    });
    expect(result).toEqual({ success: false, error: 'addEmailFailed' });
    expect(setUser).not.toHaveBeenCalled();
  });

  it('reads the address again and drops the waiting one once its link was opened', async () => {
    authFetch.mockResolvedValue(json(me({ email: 'ada@example.com', emailMissing: false, emailVerified: true })));
    const actions = renderAccount();

    await act(async () => {
      await actions.current.refreshAccountEmail();
    });

    expect(authFetch).toHaveBeenCalledWith('/api/auth/me');
    expect(updated({ ...ADA, pendingEmail: 'ada@example.com' })).toEqual({
      ...ADA,
      email: 'ada@example.com',
      emailMissing: false,
      emailVerified: true,
    });
  });

  it('changes nothing when the address cannot be read again', async () => {
    const actions = renderAccount();
    authFetch.mockResolvedValueOnce(json({}, 503)).mockRejectedValueOnce(new Error('offline'));

    await act(async () => {
      await actions.current.refreshAccountEmail();
      await actions.current.refreshAccountEmail();
    });

    expect(setUser).not.toHaveBeenCalled();
  });
});
