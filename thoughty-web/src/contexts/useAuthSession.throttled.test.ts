import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { readOfflineUser, rememberOfflineUser } from './offlineSession';
import { refreshWaitMs } from './refreshThrottle';
import { useAuthSession } from './useAuthSession';

const json = (body: unknown, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
});

/** What the API's throttler answers: `429 RATE_LIMITED`, with the seconds to wait in `Retry-After`. */
const tooManyRefreshes = (retryAfter?: string) => ({
    ...json({ statusCode: 429, message: 'ThrottlerException: Too Many Requests', error: 'Too Many Requests', code: 'RATE_LIMITED' }, 429),
    headers: new Headers(retryAfter === undefined ? {} : { 'Retry-After': retryAfter }),
});

const ADA = { id: 1, username: 'ada', email: 'ada@example.com', authProvider: 'local' as const, emailVerified: true, twoFactorEnabled: false };

type Answer = () => unknown;

/** Answers each URL from its own function, which a test can swap; anything else an empty 200. */
function stubApi(routes: Record<string, Answer>) {
    const fetchMock = vi.fn(async (url: string) => (routes[url] ?? (() => json({})))());
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const refreshesSent = (fetchMock: ReturnType<typeof vi.fn>) =>
    fetchMock.mock.calls.filter(([called]) => called === '/api/auth/refresh').length;

async function renderLoaded() {
    const hook = renderHook(() => useAuthSession());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    return hook;
}

/** A confirmed session whose token has since expired: every request now answers 401. */
async function renderExpiredSession() {
    const routes: Record<string, Answer> = {
        '/api/auth/refresh': () => json({ accessToken: 'access-token' }),
        '/api/auth/me': () => json(ADA),
        '/api/entries': () => json({ statusCode: 401, message: 'Unauthorized', error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401),
    };
    const fetchMock = stubApi(routes);
    const { result } = await renderLoaded();
    expect(result.current.user?.id).toBe(1);
    return { result, routes, fetchMock };
}

describe('useAuthSession › a refresh the API asks to wait for (429)', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(Math, 'random').mockReturnValue(0);
        localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('keeps the writer signed in, offline, and the writer remembered for an offline start', async () => {
        const { result, routes } = await renderExpiredSession();
        const key = result.current.sessionKey;

        routes['/api/auth/refresh'] = () => tooManyRefreshes('120');
        await act(async () => {
            expect((await result.current.authFetch('/api/entries')).status).toBe(401);
        });

        expect(result.current.user).toEqual(ADA);
        expect(result.current.offline).toBe(true);
        expect(result.current.sessionKey).toBe(key);
        expect(result.current.getAccessToken()).toBeNull();
        expect(readOfflineUser()).toEqual(ADA);
        expect(refreshWaitMs()).toBeGreaterThan(119_000);
    });

    it('sends no refresh while the wait runs, from requests, the online event, or another tab', async () => {
        const { result, routes, fetchMock } = await renderExpiredSession();
        routes['/api/auth/refresh'] = () => tooManyRefreshes('120');
        await act(async () => { await result.current.authFetch('/api/entries'); });
        const sent = refreshesSent(fetchMock);

        await act(async () => {
            await result.current.authFetch('/api/entries');
            await result.current.authFetch('/api/entries');
            globalThis.dispatchEvent(new Event('online'));
        });
        // A tab opened (or reloaded) meanwhile reads the same wait under the refresh lock
        const otherTab = await renderLoaded();

        expect(refreshesSent(fetchMock)).toBe(sent);
        expect(otherTab.result.current.user).toEqual(ADA);
        expect(otherTab.result.current.offline).toBe(true);
        otherTab.unmount();
    });

    it('opens offline on load for the writer remembered here, and gets the session back after the wait', async () => {
        rememberOfflineUser(ADA);
        const routes: Record<string, Answer> = { '/api/auth/refresh': () => tooManyRefreshes('1'), '/api/auth/me': () => json(ADA) };
        const fetchMock = stubApi(routes);

        const { result } = await renderLoaded();
        expect(result.current.user).toEqual(ADA);
        expect(result.current.offline).toBe(true);
        expect(readOfflineUser()).toEqual(ADA);

        routes['/api/auth/refresh'] = () => json({ accessToken: 'back-token' });
        await waitFor(() => expect(result.current.offline).toBe(false), { timeout: 3000 });
        expect(result.current.getAccessToken()).toBe('back-token');
        expect(refreshesSent(fetchMock)).toBe(2);
        expect(refreshWaitMs()).toBe(0);
    });

    it('waits five seconds when the API does not say how long', async () => {
        rememberOfflineUser(ADA);
        stubApi({ '/api/auth/refresh': () => tooManyRefreshes() });

        const { result } = await renderLoaded();

        expect(result.current.offline).toBe(true);
        expect(refreshWaitMs()).toBeGreaterThan(4_000);
        expect(refreshWaitMs()).toBeLessThanOrEqual(5_000);
    });

    it('shows sign-in on load when no writer is remembered here, forgetting nothing', async () => {
        stubApi({ '/api/auth/refresh': () => tooManyRefreshes('60') });

        const { result } = await renderLoaded();

        expect(result.current.user).toBeNull();
        expect(result.current.offline).toBe(false);
    });

    it.each([400, 404, 408, 409])('does not end a live session on a %i refresh', async (status) => {
        const { result, routes } = await renderExpiredSession();

        routes['/api/auth/refresh'] = () => json({ statusCode: status, message: 'x', error: 'x', code: 'VALIDATION_FAILED' }, status);
        await act(async () => { await result.current.authFetch('/api/entries'); });

        expect(result.current.user?.id).toBe(1);
        expect(readOfflineUser()).toEqual(ADA);
    });

    it('still ends the session on a refresh refused with 403', async () => {
        const { result, routes } = await renderExpiredSession();

        routes['/api/auth/refresh'] = () => json({ statusCode: 403, message: 'This account has been deleted.', error: 'Forbidden', code: 'AUTH_ACCOUNT_DELETED' }, 403);
        await act(async () => { await result.current.authFetch('/api/entries'); });

        expect(result.current.user).toBeNull();
        expect(readOfflineUser()).toBeNull();
    });
});
