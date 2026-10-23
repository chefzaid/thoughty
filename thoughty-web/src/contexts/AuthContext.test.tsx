import { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { AuthProvider, exchangeKeycloakSession, takeLegacyRefreshToken, useAuth } from './AuthContext';

type AuthContextValue = ReturnType<typeof useAuth>;

interface ContextSpyProps {
    onReady: (ctx: AuthContextValue) => void;
}

function ContextSpy({ onReady }: ContextSpyProps): null {
    const ctx = useAuth();
    useEffect(() => {
        onReady(ctx);
    }, [ctx, onReady]);
    return null;
}

function requireContext(ctx: AuthContextValue | undefined): AuthContextValue {
    if (!ctx) {
        throw new Error('Auth context was not ready');
    }
    return ctx;
}

interface MockResponse {
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
}

const json = (body: unknown, status = 200): MockResponse => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
});

/**
 * Routes fetch calls by URL. Each URL answers from its queue of responses, repeating the last;
 * an unlisted refresh answers 401 (no refresh token cookie), anything else an empty 200.
 */
function routeFetch(routes: Record<string, MockResponse[]> = {}): Mock {
    const queues = new Map(Object.entries(routes).map(([url, responses]) => [url, [...responses]]));
    const fetchMock = vi.fn(async (url: string) => {
        const queue = queues.get(url);
        if (queue && queue.length > 0) {
            return queue.length > 1 ? queue.shift() : queue[0];
        }
        if (url === '/api/auth/refresh') {
            return json({ message: 'Refresh token is missing' }, 401);
        }
        return json({});
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
}

const callsTo = (fetchMock: Mock, url: string) =>
    fetchMock.mock.calls.filter(([calledUrl]) => calledUrl === url);

function renderAuth(): { current: () => AuthContextValue } {
    let ctx: AuthContextValue | undefined;
    render(
        <AuthProvider>
            <ContextSpy onReady={(value) => { ctx = value; }} />
        </AuthProvider>
    );
    return { current: () => requireContext(ctx) };
}

async function renderSignedOut(): Promise<{ current: () => AuthContextValue }> {
    const auth = renderAuth();
    await waitFor(() => expect(auth.current().loading).toBe(false));
    return auth;
}

describe('AuthContext', () => {
    beforeEach(() => {
        routeFetch();
        localStorage.clear();
        sessionStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
    });

    it('throws when useAuth is used outside provider', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const Bad = (): null => {
            useAuth();
            return null;
        };
        expect(() => render(<Bad />)).toThrow('useAuth must be used within an AuthProvider');
        consoleSpy.mockRestore();
    });

    it('asks for an access token through the refresh cookie and stays signed out without one', async () => {
        const fetchMock = routeFetch();

        const auth = await renderSignedOut();

        expect(auth.current().user).toBeNull();
        expect(auth.current().getAccessToken()).toBeNull();
        expect(fetchMock).toHaveBeenCalledWith('/api/auth/refresh', {
            method: 'POST',
            credentials: 'same-origin',
        });
        expect(callsTo(fetchMock, '/api/auth/me')).toHaveLength(0);
    });

    it('restores the session on load from the refresh cookie, keeping the access token in memory', async () => {
        const fetchMock = routeFetch({
            '/api/auth/refresh': [json({ accessToken: 'fresh-access' })],
            '/api/auth/me': [json({ id: 1, email: 'user@example.com' })],
        });

        const auth = renderAuth();

        await waitFor(() => expect(auth.current().user?.email).toBe('user@example.com'));
        expect(auth.current().getAccessToken()).toBe('fresh-access');
        expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({
            headers: expect.objectContaining({ Authorization: 'Bearer fresh-access' }),
        }));
        expect(localStorage.length).toBe(0);
    });

    it('removes tokens an older version left in localStorage, exchanging the refresh token once', async () => {
        localStorage.setItem('accessToken', 'legacy-access');
        localStorage.setItem('refreshToken', 'legacy-refresh');
        localStorage.setItem('theme', 'dark');
        const fetchMock = routeFetch({
            '/api/auth/refresh': [json({ accessToken: 'fresh-access' })],
            '/api/auth/me': [json({ id: 1, email: 'legacy@example.com' })],
        });

        const auth = renderAuth();

        await waitFor(() => expect(auth.current().user?.email).toBe('legacy@example.com'));
        expect(localStorage.getItem('accessToken')).toBeNull();
        expect(localStorage.getItem('refreshToken')).toBeNull();
        expect(localStorage.getItem('theme')).toBe('dark');
        expect(callsTo(fetchMock, '/api/auth/refresh')).toEqual([[
            '/api/auth/refresh',
            expect.objectContaining({ body: JSON.stringify({ refreshToken: 'legacy-refresh' }) }),
        ]]);
        expect(takeLegacyRefreshToken()).toBeNull();
    });

    it('exchanges a production Keycloak session when there is no refresh cookie', async () => {
        vi.stubEnv('PROD', true);
        sessionStorage.setItem('thoughty.keycloak-sso-attempt', 'pending');
        routeFetch({
            '/api/auth/sso': [json({
                accessToken: 'sso-access',
                user: { id: 7, email: 'zaid@swirlit.dev', authProvider: 'keycloak' }
            })],
        });

        const auth = renderAuth();

        await waitFor(() => expect(auth.current().user?.email).toBe('zaid@swirlit.dev'));
        expect(auth.current().getAccessToken()).toBe('sso-access');
        expect(localStorage.getItem('accessToken')).toBeNull();
    });

    it('handles rejected, empty, and unavailable Keycloak exchanges without a session', async () => {
        const onSession = vi.fn();
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        (globalThis.fetch as Mock)
            .mockResolvedValueOnce({ ok: false })
            .mockResolvedValueOnce({ ok: true, json: async () => null })
            .mockRejectedValueOnce(new Error('offline'));

        await exchangeKeycloakSession(onSession);
        await exchangeKeycloakSession(onSession);
        await exchangeKeycloakSession(onSession);

        expect(onSession).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledOnce();
    });

    it('registers user successfully and keeps tokens out of storage', async () => {
        const fetchMock = routeFetch({
            '/api/auth/register': [json({
                accessToken: 'access',
                user: { id: 1, email: 'new@example.com' }
            })],
        });
        const auth = await renderSignedOut();

        let result: { success: boolean } | undefined;
        await act(async () => {
            result = await auth.current().register('new@example.com', 'pass123', 'newuser', '');
        });
        expect(result!.success).toBe(true);
        expect(fetchMock).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({
            body: JSON.stringify({
                email: 'new@example.com',
                password: 'pass123',
                username: 'newuser',
                website: '',
            }),
        }));
        expect(localStorage.length).toBe(0);
        await waitFor(() => {
            expect(auth.current().user?.email).toBe('new@example.com');
        });
        expect(auth.current().getAccessToken()).toBe('access');
    });

    it('handles register failure and sets error', async () => {
        routeFetch({
            '/api/auth/register': [json({ error: 'Registration failed' }, 400)],
        });
        const auth = await renderSignedOut();

        let result: { success: boolean } | undefined;
        await act(async () => {
            result = await auth.current().register('bad@example.com', 'pass', 'bad');
        });
        expect(result!.success).toBe(false);
        await waitFor(() => {
            expect(auth.current().error).toBe('Registration failed');
        });
    });

    it('logs in successfully with the access token in memory only', async () => {
        const fetchMock = routeFetch({
            '/api/auth/login': [json({
                accessToken: 'access',
                user: { id: 2, email: 'login@example.com' }
            })],
        });
        const auth = await renderSignedOut();

        let result: { success: boolean } | undefined;
        await act(async () => {
            result = await auth.current().login('login@example.com', 'pass', 'https://spam.example');
        });
        expect(result!.success).toBe(true);
        expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
            body: JSON.stringify({
                identifier: 'login@example.com',
                password: 'pass',
                website: 'https://spam.example',
            }),
        }));
        expect(localStorage.getItem('accessToken')).toBeNull();
        expect(localStorage.getItem('refreshToken')).toBeNull();
        await waitFor(() => {
            expect(auth.current().user?.email).toBe('login@example.com');
        });
        expect(auth.current().getAccessToken()).toBe('access');
    });

    it('refreshes token on 401 during authFetch', async () => {
        let callCount = 0;
        const fetchMock = routeFetch({
            '/api/auth/refresh': [
                json({ accessToken: 'first' }),
                json({ accessToken: 'newtoken' }),
            ],
            '/api/auth/me': [json({ id: 1, email: 'refresh@example.com' })],
        });
        const route = fetchMock.getMockImplementation()!;
        fetchMock.mockImplementation((url: string, init?: RequestInit) => {
            if (url === '/api/protected') {
                callCount++;
                return Promise.resolve(callCount === 1 ? json({}, 401) : json({}));
            }
            return route(url, init);
        });

        const auth = renderAuth();
        await waitFor(() => expect(auth.current().user?.email).toBe('refresh@example.com'));

        let response: Response | undefined;
        await act(async () => {
            response = await auth.current().authFetch('/api/protected');
        });
        expect(response!.ok).toBe(true);
        expect(callCount).toBe(2);
        expect(fetchMock).toHaveBeenLastCalledWith('/api/protected', expect.objectContaining({
            headers: expect.objectContaining({ Authorization: 'Bearer newtoken' }),
        }));
    });

    it('shares one refresh between concurrent 401s, since each refresh token works once', async () => {
        const fetchMock = routeFetch({
            '/api/auth/refresh': [json({ accessToken: 'first' }), json({ accessToken: 'second' })],
            '/api/auth/me': [json({ id: 1, email: 'user@example.com' })],
        });
        const route = fetchMock.getMockImplementation()!;
        fetchMock.mockImplementation((url: string, init?: RequestInit) => {
            if (url.startsWith('/api/protected')) {
                const authorization = (init?.headers as Record<string, string>).Authorization;
                return Promise.resolve(authorization === 'Bearer second' ? json({}) : json({}, 401));
            }
            return route(url, init);
        });
        const auth = renderAuth();
        await waitFor(() => expect(auth.current().user).not.toBeNull());

        await act(async () => {
            await Promise.all([
                auth.current().authFetch('/api/protected/a'),
                auth.current().authFetch('/api/protected/b'),
            ]);
        });

        expect(callsTo(fetchMock, '/api/auth/refresh')).toHaveLength(2);
    });

    it('logs out through the cookie and forgets the access token', async () => {
        const fetchMock = routeFetch({
            '/api/auth/login': [json({
                accessToken: 'access',
                user: { id: 3, email: 'logout@example.com' }
            })],
        });
        const auth = await renderSignedOut();

        await act(async () => {
            await auth.current().login('logout@example.com', 'pass');
        });
        await act(async () => {
            await auth.current().logout();
        });

        expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', {
            method: 'POST',
            credentials: 'same-origin',
        });
        expect(auth.current().getAccessToken()).toBeNull();
        await waitFor(() => {
            expect(auth.current().user).toBeNull();
        });
    });

    it('supports password and account flows', async () => {
        routeFetch({
            '/api/auth/forgot-password': [json({ message: 'sent' })],
            '/api/auth/reset-password': [json({ message: 'reset' })],
            '/api/auth/change-password': [json({ message: 'changed' })],
            '/api/auth/delete-account': [json({ message: 'deleted' })],
        });
        const auth = await renderSignedOut();

        let forgot: { success: boolean } | undefined;
        await act(async () => {
            forgot = await auth.current().forgotPassword('a@b.com');
        });
        expect(forgot!.success).toBe(true);

        let reset: { success: boolean } | undefined;
        await act(async () => {
            reset = await auth.current().resetPassword('token', 'newpass');
        });
        expect(reset!.success).toBe(true);

        let change: { success: boolean } | undefined;
        await act(async () => {
            change = await auth.current().changePassword('old', 'new');
        });
        expect(change!.success).toBe(true);

        let del: { success: boolean } | undefined;
        await act(async () => {
            del = await auth.current().deleteAccount('pass');
        });
        expect(del!.success).toBe(true);
        expect(auth.current().getAccessToken()).toBeNull();
    });

    it('completes a two-factor login without storing a partial session', async () => {
        const fetchMock = routeFetch({
            '/api/auth/login': [json({
                twoFactorRequired: true,
                challengeToken: 'challenge-one',
                expiresInSeconds: 600,
            })],
            '/api/auth/two-factor/resend': [json({
                twoFactorRequired: true,
                challengeToken: 'challenge-two',
                expiresInSeconds: 600,
            })],
            '/api/auth/two-factor/verify': [json({
                accessToken: 'access',
                user: { id: 2, email: 'protected@example.com', twoFactorEnabled: true },
            })],
        });
        const auth = await renderSignedOut();

        let loginResult;
        await act(async () => {
            loginResult = await auth.current().login('protected@example.com', 'password');
        });
        expect(loginResult).toEqual(expect.objectContaining({
            success: true,
            twoFactorRequired: true,
            challengeToken: 'challenge-one',
        }));
        expect(auth.current().getAccessToken()).toBeNull();

        let resendResult;
        await act(async () => {
            resendResult = await auth.current().resendTwoFactor('challenge-one');
        });
        expect(resendResult).toEqual(expect.objectContaining({ challengeToken: 'challenge-two' }));

        await act(async () => {
            await auth.current().verifyTwoFactor('challenge-two', '123456');
        });
        expect(fetchMock).toHaveBeenLastCalledWith(
            '/api/auth/two-factor/verify',
            expect.objectContaining({ body: JSON.stringify({ challengeToken: 'challenge-two', code: '123456' }) }),
        );
        expect(auth.current().getAccessToken()).toBe('access');
        expect(localStorage.length).toBe(0);
        expect(auth.current().user?.twoFactorEnabled).toBe(true);
    });

    it('verifies an email and updates the authenticated user', async () => {
        const fetchMock = routeFetch({
            '/api/auth/refresh': [json({ accessToken: 'token' })],
            '/api/auth/me': [json({ id: 1, email: 'user@example.com', emailVerified: false })],
            '/api/auth/verify-email': [json({ message: 'verified' })],
        });
        const auth = renderAuth();

        await waitFor(() => expect(auth.current().user).not.toBeNull());

        let result: { success: boolean } | undefined;
        await act(async () => {
            result = await auth.current().verifyEmail('verification-token');
        });

        expect(result?.success).toBe(true);
        expect(fetchMock).toHaveBeenLastCalledWith('/api/auth/verify-email', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ token: 'verification-token' }),
        }));
        expect(auth.current().user?.emailVerified).toBe(true);
    });

    it('resends verification through the authenticated request path', async () => {
        const fetchMock = routeFetch({
            '/api/auth/resend-verification-email': [json({ message: 'sent' })],
        });
        const auth = await renderSignedOut();

        let result: { success: boolean } | undefined;
        await act(async () => {
            result = await auth.current().resendVerificationEmail();
        });

        expect(result?.success).toBe(true);
        expect(fetchMock).toHaveBeenCalledWith('/api/auth/resend-verification-email', expect.objectContaining({
            method: 'POST',
        }));
    });

    it('rejects Google sign-in when not configured', async () => {
        const auth = await renderSignedOut();

        let error: unknown;
        await act(async () => {
            try {
                await auth.current().signInWithGoogle();
            } catch (caughtError) {
                error = caughtError;
            }
        });

        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Google Sign-In not configured');
    });
});
