import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAccountActions } from './useAccountActions';
import { useSignInActions } from './useSignInActions';
import type { GoogleApi, GoogleCredentialResponse } from './googleAuth';

const json = (body: unknown, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
});

const session = {
    accessToken: 'access-token',
    user: { id: 1, username: 'ada', email: 'ada@example.com', isNewUser: true },
};

/** Installs a Google Identity Services stub that answers the prompt with `credential`. */
function stubGoogle(credential: string) {
    let callback: ((response: GoogleCredentialResponse) => void) | undefined;
    const google: GoogleApi = {
        accounts: {
            id: {
                initialize: ({ callback: onCredential }) => {
                    callback = onCredential;
                },
                prompt: () => callback?.({ credential }),
                renderButton: vi.fn(),
            },
        },
    };
    vi.stubGlobal('google', google);
}

describe('useSignInActions', () => {
    const setError = vi.fn();
    const startSession = vi.fn();
    const renderSignIn = () => renderHook(() => useSignInActions({
        googleClientId: 'client-id',
        setError,
        startSession,
    })).result;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it.each([
        ['login', (actions: ReturnType<typeof renderSignIn>['current']) => actions.login('ada', 'pw'), 'authFailed'],
        ['verifyTwoFactor', (actions: ReturnType<typeof renderSignIn>['current']) => actions.verifyTwoFactor('challenge', '123456'), 'twoFactorVerificationFailed'],
        ['resendTwoFactor', (actions: ReturnType<typeof renderSignIn>['current']) => actions.resendTwoFactor('challenge'), 'twoFactorResendFailed'],
    ])('%s falls back to its error key when the request fails without an Error', async (_name, call, fallback) => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue('offline'));
        const actions = renderSignIn();

        let result;
        await act(async () => {
            result = await call(actions.current);
        });

        expect(result).toEqual({ success: false, error: fallback });
        expect(setError).toHaveBeenLastCalledWith(fallback);
        expect(startSession).not.toHaveBeenCalled();
    });

    it('signs in with the Google credential and reports a new account', async () => {
        stubGoogle('google-id-token');
        const fetchMock = vi.fn().mockResolvedValue(json(session));
        vi.stubGlobal('fetch', fetchMock);
        const actions = renderSignIn();

        let result;
        await act(async () => {
            result = await actions.current.signInWithGoogle();
        });

        expect(fetchMock).toHaveBeenCalledWith('/api/auth/oauth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: 'google', credential: 'google-id-token' }),
        });
        expect(startSession).toHaveBeenCalledWith(session);
        expect(result).toEqual({ success: true, isNewUser: true });
        expect(setError).toHaveBeenCalledWith(null);
    });

    it('reports the API message when Google sign-in is refused', async () => {
        stubGoogle('google-id-token');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ message: 'Google account is not verified' }, 401)));
        const actions = renderSignIn();

        let result;
        await act(async () => {
            result = await actions.current.signInWithGoogle();
        });

        expect(result).toEqual({ success: false, error: 'Google account is not verified' });
        expect(setError).toHaveBeenLastCalledWith('Google account is not verified');
        expect(startSession).not.toHaveBeenCalled();
    });

    it('reports an unavailable server when Google sign-in returns no session', async () => {
        stubGoogle('google-id-token');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => null }));
        const actions = renderSignIn();

        let result;
        await act(async () => {
            result = await actions.current.signInWithGoogle();
        });

        expect(result).toEqual({ success: false, error: 'serverUnavailable' });
    });

    it('falls back to googleSignInFailed when the Google request fails without an Error', async () => {
        stubGoogle('google-id-token');
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue('offline'));
        const actions = renderSignIn();

        let result;
        await act(async () => {
            result = await actions.current.signInWithGoogle();
        });

        expect(result).toEqual({ success: false, error: 'googleSignInFailed' });
    });
});

describe('useAccountActions', () => {
    const setError = vi.fn();
    const setUser = vi.fn();
    const clearSession = vi.fn();
    const authFetch = vi.fn();
    const renderAccount = () => renderHook(() => useAccountActions({
        authFetch,
        clearSession,
        setError,
        setUser,
    })).result;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it.each([
        ['resetPassword', (actions: ReturnType<typeof renderAccount>['current']) => actions.resetPassword('token', 'new-password'), 'Failed to reset password'],
        ['verifyEmail', (actions: ReturnType<typeof renderAccount>['current']) => actions.verifyEmail('token'), 'Email verification failed'],
    ])('%s reports the fallback when the API refuses without a message', async (_name, call, fallback) => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({}), text: async () => '' }));
        const actions = renderAccount();

        let result;
        await act(async () => {
            result = await call(actions.current);
        });

        expect(result).toEqual({ success: false, error: fallback });
        expect(setError).toHaveBeenLastCalledWith(fallback);
        expect(setUser).not.toHaveBeenCalled();
    });

    it.each([
        ['resetPassword', (actions: ReturnType<typeof renderAccount>['current']) => actions.resetPassword('token', 'new-password'), 'Failed to reset password'],
        ['verifyEmail', (actions: ReturnType<typeof renderAccount>['current']) => actions.verifyEmail('token'), 'Email verification failed'],
    ])('%s falls back to its message when the request fails without an Error', async (_name, call, fallback) => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue('offline'));
        const actions = renderAccount();

        let result;
        await act(async () => {
            result = await call(actions.current);
        });

        expect(result).toEqual({ success: false, error: fallback });
    });

    it('marks the signed-in user verified after verifying the email', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ message: 'Email verified' })));
        const actions = renderAccount();

        let result;
        await act(async () => {
            result = await actions.current.verifyEmail('token');
        });

        expect(result).toEqual({ success: true, message: 'Email verified' });
        const update = setUser.mock.calls[0]?.[0] as (user: unknown) => unknown;
        expect(update({ id: 1, emailVerified: false })).toEqual({ id: 1, emailVerified: true });
        expect(update(null)).toBeNull();
    });

    it('reports a refused verification email resend', async () => {
        authFetch.mockResolvedValue({ ok: false, status: 429, json: async () => ({}), text: async () => '' });
        const actions = renderAccount();

        let result;
        await act(async () => {
            result = await actions.current.resendVerificationEmail();
        });

        expect(authFetch).toHaveBeenCalledWith('/api/auth/resend-verification-email', { method: 'POST' });
        expect(result).toEqual({ success: false, error: 'Failed to resend verification email' });
    });

    it('falls back when the verification email resend fails without an Error', async () => {
        authFetch.mockRejectedValue('offline');
        const actions = renderAccount();

        let result;
        await act(async () => {
            result = await actions.current.resendVerificationEmail();
        });

        expect(result).toEqual({ success: false, error: 'Failed to resend verification email' });
    });
});
