import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { readOfflineUser, rememberOfflineUser } from './offlineSession';
import { sessionUserWaitMs } from './refreshThrottle';
import { useAuthSession } from './useAuthSession';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
});

/** An access token shaped as the API signs it: a JWT whose payload names the account (`userId`). */
const tokenFor = (userId: number, n = 1) =>
    `h.${btoa(JSON.stringify({ userId, n })).replace(/=+$/, '')}.s`;

const ADA = { id: 1, username: 'ada', email: 'ada@example.com', authProvider: 'local' as const, emailVerified: true, emailMissing: false, twoFactorEnabled: false };
const tooManyReads = (retryAfter?: string) => json(
    { statusCode: 429, message: 'ThrottlerException: Too Many Requests', error: 'Too Many Requests', code: 'RATE_LIMITED' },
    429,
    retryAfter === undefined ? {} : { 'Retry-After': retryAfter },
);
const unreachable = () => Promise.reject(new TypeError('Failed to fetch'));

type Answer = () => unknown;

/** Answers each URL from its own function, which a test can swap; anything else an empty 200. */
function stubApi(routes: Record<string, Answer>) {
    const fetchMock = vi.fn(async (url: string) => (routes[url] ?? (() => json({})))());
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const callsTo = (fetchMock: ReturnType<typeof vi.fn>, url: string) =>
    fetchMock.mock.calls.filter(([called]) => called === url).length;

async function renderLoaded() {
    const hook = renderHook(() => useAuthSession());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    return hook;
}

describe('useAuthSession › a session `/me` cannot confirm yet', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(Math, 'random').mockReturnValue(0);
        localStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('opens offline on a 429 for the writer remembered here, waits as asked, then confirms with the same token', async () => {
        rememberOfflineUser(ADA);
        const token = tokenFor(1);
        const routes: Record<string, Answer> = { '/api/auth/refresh': () => json({ accessToken: token }), '/api/auth/me': () => tooManyReads('1') };
        const fetchMock = stubApi(routes);

        const { result } = await renderLoaded();
        expect(result.current.user).toEqual(ADA);
        expect(result.current.offline).toBe(true);
        expect(result.current.getAccessToken()).toBe(token);
        expect(readOfflineUser()).toEqual(ADA);
        expect(sessionUserWaitMs()).toBeGreaterThan(900);

        routes['/api/auth/me'] = () => json({ ...ADA, username: 'ada.l' });
        await waitFor(() => expect(result.current.offline).toBe(false), { timeout: 3000 });
        expect(result.current.user?.username).toBe('ada.l');
        expect(result.current.getAccessToken()).toBe(token);
        // The token the load refreshed stood all along: no second refresh for it
        expect(callsTo(fetchMock, '/api/auth/refresh')).toBe(1);
        expect(callsTo(fetchMock, '/api/auth/me')).toBe(2);
        expect(sessionUserWaitMs()).toBe(0);
    });

    it('waits five seconds on a 429 without Retry-After, sending no `/me` meanwhile, even from a reload', async () => {
        rememberOfflineUser(ADA);
        const fetchMock = stubApi({ '/api/auth/refresh': () => json({ accessToken: tokenFor(1) }), '/api/auth/me': () => tooManyReads() });

        const first = await renderLoaded();
        expect(first.result.current.offline).toBe(true);
        expect(sessionUserWaitMs()).toBeGreaterThan(4_000);
        expect(sessionUserWaitMs()).toBeLessThanOrEqual(5_000);

        const reload = await renderLoaded();
        expect(reload.result.current.user).toEqual(ADA);
        expect(reload.result.current.offline).toBe(true);
        expect(callsTo(fetchMock, '/api/auth/me')).toBe(1);
        reload.unmount();
    });

    it.each([
        ['a server that is down (503)', () => json({ message: 'Service Unavailable' }, 503)],
        ['no answer', unreachable],
        ['an answer it cannot read', () => ({ ok: true, status: 200, headers: new Headers(), json: async () => { throw new SyntaxError('x'); } })],
    ])('keeps the session through %s, and confirms it when the API answers again', async (_label, answer) => {
        rememberOfflineUser(ADA);
        const token = tokenFor(1);
        const routes: Record<string, Answer> = { '/api/auth/refresh': () => json({ accessToken: token }), '/api/auth/me': answer };
        stubApi(routes);

        const { result } = await renderLoaded();
        expect(result.current.user).toEqual(ADA);
        expect(result.current.offline).toBe(true);
        expect(readOfflineUser()).toEqual(ADA);

        routes['/api/auth/me'] = () => json(ADA);
        await act(async () => { globalThis.dispatchEvent(new Event('online')); });
        await waitFor(() => expect(result.current.offline).toBe(false));
        expect(result.current.getAccessToken()).toBe(token);
    });

    it('tries `/me` again on its own, waiting longer after each failure', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        rememberOfflineUser(ADA);
        const routes: Record<string, Answer> = { '/api/auth/refresh': () => json({ accessToken: tokenFor(1) }), '/api/auth/me': () => json({}, 502) };
        const fetchMock = stubApi(routes);
        const { result } = await renderLoaded();
        expect(callsTo(fetchMock, '/api/auth/me')).toBe(1);

        await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
        expect(callsTo(fetchMock, '/api/auth/me')).toBe(2);
        // The next try waits ten seconds
        await act(async () => { await vi.advanceTimersByTimeAsync(9_000); });
        expect(callsTo(fetchMock, '/api/auth/me')).toBe(2);

        routes['/api/auth/me'] = () => json(ADA);
        await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
        expect(callsTo(fetchMock, '/api/auth/me')).toBe(3);
        expect(result.current.offline).toBe(false);
        expect(result.current.user).toEqual(ADA);
    });

    it.each([401, 403])('still ends the session when `/me` answers %i', async (status) => {
        rememberOfflineUser(ADA);
        const fetchMock = stubApi({
            '/api/auth/refresh': () => json({ accessToken: tokenFor(1) }),
            '/api/auth/me': () => json({ statusCode: status, message: 'x', error: 'x', code: 'UNAUTHORIZED' }, status),
        });

        const { result } = await renderLoaded();

        expect(result.current.user).toBeNull();
        expect(result.current.offline).toBe(false);
        expect(result.current.unreachable).toBe(false);
        expect(result.current.getAccessToken()).toBeNull();
        expect(readOfflineUser()).toBeNull();
        // A token the refresh just issued and `/me` refuses is not refreshed again
        expect(callsTo(fetchMock, '/api/auth/refresh')).toBe(1);
    });

    it('says Thoughty cannot be reached, rather than asking to sign in, when no writer is remembered here', async () => {
        const token = tokenFor(1);
        const routes: Record<string, Answer> = { '/api/auth/refresh': () => json({ accessToken: token }), '/api/auth/me': () => tooManyReads('60') };
        stubApi(routes);

        const { result } = await renderLoaded();
        expect(result.current.user).toBeNull();
        expect(result.current.unreachable).toBe(true);
        expect(result.current.offline).toBe(false);
        expect(result.current.getAccessToken()).toBe(token);

        // Trying again during the wait sends nothing; once it is over, the session is confirmed
        await act(async () => { await result.current.retrySession(); });
        expect(result.current.unreachable).toBe(true);
        localStorage.removeItem('thoughty.meRetryAt');
        routes['/api/auth/me'] = () => json(ADA);
        await act(async () => { await result.current.retrySession(); });
        expect(result.current.user).toEqual(ADA);
        expect(result.current.unreachable).toBe(false);
    });

    it('does not show a remembered writer the token is not for', async () => {
        rememberOfflineUser({ ...ADA, id: 2, username: 'grace' });
        stubApi({ '/api/auth/refresh': () => json({ accessToken: tokenFor(1) }), '/api/auth/me': () => json({}, 503) });

        const { result } = await renderLoaded();

        expect(result.current.user).toBeNull();
        expect(result.current.unreachable).toBe(true);
    });

    it('signs out from the cannot-be-reached state, here and on the server', async () => {
        const fetchMock = stubApi({
            '/api/auth/refresh': () => json({ accessToken: tokenFor(1) }),
            '/api/auth/me': () => json({}, 503),
            '/api/auth/logout': () => json({ success: true }),
        });
        const { result } = await renderLoaded();
        expect(result.current.unreachable).toBe(true);

        await act(() => result.current.logout());

        expect(result.current.unreachable).toBe(false);
        expect(result.current.getAccessToken()).toBeNull();
        expect(callsTo(fetchMock, '/api/auth/logout')).toBe(1);
    });

    it('ends the cannot-be-reached state when another tab signs out or another writer signs in there', async () => {
        stubApi({ '/api/auth/refresh': () => json({ accessToken: tokenFor(1) }), '/api/auth/me': () => json({}, 503) });
        const first = await renderLoaded();
        const second = await renderLoaded();
        expect(first.result.current.unreachable).toBe(true);
        expect(second.result.current.unreachable).toBe(true);
        const other = new BroadcastChannel('thoughty.auth-session');

        await act(async () => { other.postMessage({ type: 'signed-in', userId: 1 }); });
        expect(first.result.current.unreachable).toBe(true);
        await act(async () => { other.postMessage({ type: 'signed-in', userId: 2 }); });
        await waitFor(() => expect(first.result.current.unreachable).toBe(false));
        expect(first.result.current.getAccessToken()).toBeNull();

        await act(async () => { other.postMessage({ type: 'signed-out' }); });
        await waitFor(() => expect(second.result.current.unreachable).toBe(false));
        other.close();
    });
});

describe('useAuthSession › `/me` on the way back from offline', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(Math, 'random').mockReturnValue(0);
        localStorage.clear();
        rememberOfflineUser(ADA);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    async function renderOffline(routes: Record<string, Answer>) {
        routes['/api/auth/refresh'] = unreachable;
        const fetchMock = stubApi(routes);
        const { result } = await renderLoaded();
        expect(result.current.offline).toBe(true);
        return { result, fetchMock };
    }

    it('stays offline, keeping the token, while `/me` answers 503, and comes back without another refresh', async () => {
        const routes: Record<string, Answer> = { '/api/auth/me': () => json({}, 503) };
        const { result, fetchMock } = await renderOffline(routes);
        const token = tokenFor(1);

        routes['/api/auth/refresh'] = () => json({ accessToken: token });
        await act(async () => { globalThis.dispatchEvent(new Event('online')); });
        expect(result.current.offline).toBe(true);
        expect(result.current.user).toEqual(ADA);
        expect(result.current.getAccessToken()).toBe(token);

        routes['/api/auth/me'] = () => json(ADA);
        await act(async () => { globalThis.dispatchEvent(new Event('online')); });
        await waitFor(() => expect(result.current.offline).toBe(false));
        expect(callsTo(fetchMock, '/api/auth/refresh')).toBe(2);
    });

    it('ends the session when `/me` refuses the token just refreshed', async () => {
        const routes: Record<string, Answer> = { '/api/auth/me': () => json({}, 401) };
        const { result } = await renderOffline(routes);

        routes['/api/auth/refresh'] = () => json({ accessToken: tokenFor(1) });
        await act(async () => { globalThis.dispatchEvent(new Event('online')); });

        await waitFor(() => expect(result.current.user).toBeNull());
        expect(result.current.offline).toBe(false);
        expect(readOfflineUser()).toBeNull();
    });

    it('refreshes a held token `/me` refuses, since it may have expired during the wait', async () => {
        const routes: Record<string, Answer> = { '/api/auth/me': () => json({}, 503) };
        const { result, fetchMock } = await renderOffline(routes);
        routes['/api/auth/refresh'] = () => json({ accessToken: tokenFor(1) });
        await act(async () => { globalThis.dispatchEvent(new Event('online')); });
        expect(result.current.offline).toBe(true);

        const renewed = tokenFor(1, 2);
        routes['/api/auth/refresh'] = () => json({ accessToken: renewed });
        routes['/api/auth/me'] = vi.fn()
            .mockImplementationOnce(() => json({}, 401))
            .mockImplementation(() => json(ADA));
        await act(async () => { globalThis.dispatchEvent(new Event('online')); });

        await waitFor(() => expect(result.current.offline).toBe(false));
        expect(result.current.getAccessToken()).toBe(renewed);
        expect(result.current.user).toEqual(ADA);
        expect(callsTo(fetchMock, '/api/auth/refresh')).toBe(3);
    });

    it('ends the offline session when the token is for another writer', async () => {
        const routes: Record<string, Answer> = { '/api/auth/me': () => json({}, 503) };
        const { result } = await renderOffline(routes);
        const key = result.current.sessionKey;

        routes['/api/auth/refresh'] = () => json({ accessToken: tokenFor(2) });
        await act(async () => { globalThis.dispatchEvent(new Event('online')); });

        expect(result.current.user).toBeNull();
        expect(result.current.sessionKey).toBe(key + 1);
        expect(result.current.unreachable).toBe(true);
        expect(readOfflineUser()).toBeNull();
    });
});
