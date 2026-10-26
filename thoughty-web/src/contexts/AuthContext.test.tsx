import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { exchangeKeycloakSession, takeLegacyRefreshToken, useAuth } from './AuthContext';
import { callsTo, json, locationRestorers, renderAuth, renderSignedOut, routeFetch, stubLocationAssign } from './AuthContext.test-helpers';

describe('AuthContext', () => {
    beforeEach(() => {
        routeFetch();
        localStorage.clear();
        sessionStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
        locationRestorers.splice(0).forEach((restore) => restore());
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

    it('never sends a production visitor to Keycloak unasked', async () => {
        vi.stubEnv('PROD', true);
        const assign = stubLocationAssign();
        const fetchMock = routeFetch();

        const auth = await renderSignedOut();

        expect(auth.current().user).toBeNull();
        expect(callsTo(fetchMock, '/api/auth/sso')).toHaveLength(0);
        expect(assign).not.toHaveBeenCalled();
    });

    it('reports a Keycloak sign-in that did not complete and stays signed out', async () => {
        vi.stubEnv('PROD', true);
        const assign = stubLocationAssign();
        sessionStorage.setItem('thoughty.keycloak-sso-attempt', 'pending');
        routeFetch({ '/api/auth/sso': [json({ message: 'Unauthorized' }, 401)] });

        const auth = await renderSignedOut();

        expect(auth.current().user).toBeNull();
        expect(sessionStorage.getItem('thoughty.keycloak-sso-attempt')).toBeNull();
        expect(sessionStorage.getItem('thoughty.keycloak-sso-failed')).toBe('true');
        expect(assign).not.toHaveBeenCalled();
    });

    it('ends the Keycloak session on logout only for a Keycloak account', async () => {
        vi.stubEnv('PROD', true);
        const assign = stubLocationAssign();
        routeFetch({
            '/api/auth/login': [json({ accessToken: 'access', user: { id: 3, email: 'local@example.com', authProvider: 'local' } })],
            '/api/auth/sso': [json({ accessToken: 'sso', user: { id: 7, email: 'sso@example.com', authProvider: 'keycloak' } })],
        });
        const auth = await renderSignedOut();

        await act(async () => {
            await auth.current().login('local@example.com', 'pass');
        });
        await act(async () => {
            await auth.current().logout();
        });
        expect(assign).not.toHaveBeenCalled();

        sessionStorage.setItem('thoughty.keycloak-sso-attempt', 'pending');
        const ssoAuth = renderAuth();
        await waitFor(() => expect(ssoAuth.current().user?.email).toBe('sso@example.com'));
        await act(async () => {
            await ssoAuth.current().logout();
        });
        expect(assign).toHaveBeenCalledWith(expect.stringContaining('https://keycloak.swirlit.dev/oauth2/sign_out?rd='));
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

});
