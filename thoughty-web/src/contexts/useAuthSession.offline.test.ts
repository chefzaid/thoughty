import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { isSignOutPending, markSignOutPending, readOfflineUser, rememberOfflineUser } from './offlineSession';
import { useAuthSession } from './useAuthSession';

const json = (body: unknown, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
});

const ADA = { id: 1, username: 'ada', email: 'ada@example.com', authProvider: 'local' as const, emailVerified: true, emailMissing: false, twoFactorEnabled: false };

type Answer = () => unknown;
const unreachable: Answer = () => Promise.reject(new TypeError('Failed to fetch'));

/** Answers each URL from its own function, which a test can swap; anything else an empty 200. */
function stubApi(routes: Record<string, Answer>) {
    const fetchMock = vi.fn(async (url: string) => (routes[url] ?? (() => json({})))());
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const callsTo = (fetchMock: ReturnType<typeof vi.fn>, url: string) =>
    fetchMock.mock.calls.filter(([called]) => called === url);

async function renderLoaded() {
    const hook = renderHook(() => useAuthSession());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    return hook.result;
}

describe('useAuthSession › a journal opened without a connection', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('remembers the writer of a confirmed session', async () => {
        stubApi({ '/api/auth/refresh': () => json({ accessToken: 'access-token' }), '/api/auth/me': () => json({ ...ADA, avatarUrl: 'data:x' }) });

        const result = await renderLoaded();

        expect(result.current.user?.id).toBe(1);
        expect(result.current.offline).toBe(false);
        expect(readOfflineUser()).toEqual(ADA);
    });

    it('opens offline for the writer last signed in here when the API cannot be reached', async () => {
        rememberOfflineUser(ADA);
        const fetchMock = stubApi({ '/api/auth/refresh': unreachable });

        const result = await renderLoaded();

        expect(result.current.user).toEqual(ADA);
        expect(result.current.offline).toBe(true);
        expect(result.current.getAccessToken()).toBeNull();
        expect(callsTo(fetchMock, '/api/auth/me')).toHaveLength(0);
    });

    it('counts a server that is down as unreachable', async () => {
        rememberOfflineUser(ADA);
        stubApi({ '/api/auth/refresh': () => json({ message: 'Bad gateway' }, 502) });

        const result = await renderLoaded();

        expect(result.current.offline).toBe(true);
        expect(result.current.user?.id).toBe(1);
    });

    it('stays signed out offline when no writer was signed in here', async () => {
        stubApi({ '/api/auth/refresh': unreachable });

        const result = await renderLoaded();

        expect(result.current.user).toBeNull();
        expect(result.current.offline).toBe(false);
    });

    it('forgets the writer when the server refuses the session on load', async () => {
        rememberOfflineUser(ADA);
        stubApi({ '/api/auth/refresh': () => json({}, 401) });

        const result = await renderLoaded();

        expect(result.current.user).toBeNull();
        expect(readOfflineUser()).toBeNull();
    });

    it('gets the session back when the connection returns, and reads who it belongs to', async () => {
        rememberOfflineUser(ADA);
        const routes: Record<string, Answer> = { '/api/auth/refresh': unreachable, '/api/auth/me': () => json({ ...ADA, username: 'ada.l' }) };
        stubApi(routes);
        const result = await renderLoaded();
        const key = result.current.sessionKey;

        routes['/api/auth/refresh'] = () => json({ accessToken: 'back-token' });
        act(() => { globalThis.dispatchEvent(new Event('online')); });

        await waitFor(() => expect(result.current.offline).toBe(false));
        await waitFor(() => expect(result.current.user?.username).toBe('ada.l'));
        expect(result.current.getAccessToken()).toBe('back-token');
        expect(result.current.sessionKey).toBe(key);
    });

    it('keeps the token, still offline, when `/me` cannot be read on the way back', async () => {
        rememberOfflineUser(ADA);
        const routes: Record<string, Answer> = { '/api/auth/refresh': unreachable, '/api/auth/me': unreachable };
        stubApi(routes);
        const result = await renderLoaded();

        // A token the API signs for Ada (`userId` 1)
        const token = `h.${btoa(JSON.stringify({ userId: 1 }))}.s`;
        routes['/api/auth/refresh'] = () => json({ accessToken: token });
        await act(async () => { globalThis.dispatchEvent(new Event('online')); });

        expect(result.current.offline).toBe(true);
        expect(result.current.getAccessToken()).toBe(token);
        expect(result.current.user).toEqual(ADA);
        expect(readOfflineUser()).toEqual(ADA);
    });

    it('does not bring back a session signed out while it was being got back', async () => {
        rememberOfflineUser(ADA);
        let answerMe: (value: unknown) => void = () => undefined;
        const routes: Record<string, Answer> = {
            '/api/auth/refresh': unreachable,
            '/api/auth/me': () => new Promise((resolve) => { answerMe = resolve; }),
            '/api/auth/logout': () => json({ success: true }),
        };
        const fetchMock = stubApi(routes);
        const result = await renderLoaded();

        routes['/api/auth/refresh'] = () => json({ accessToken: 'back-token' });
        act(() => { globalThis.dispatchEvent(new Event('online')); });
        await waitFor(() => expect(callsTo(fetchMock, '/api/auth/me')).toHaveLength(1));

        await act(() => result.current.logout());
        await act(async () => { answerMe(json(ADA)); });

        expect(result.current.user).toBeNull();
        expect(result.current.getAccessToken()).toBeNull();
        expect(readOfflineUser()).toBeNull();
        expect(isSignOutPending()).toBe(false);
    });

    it('ends the session when the server refuses it on the way back', async () => {
        rememberOfflineUser(ADA);
        const routes: Record<string, Answer> = { '/api/auth/refresh': unreachable };
        stubApi(routes);
        const result = await renderLoaded();
        const key = result.current.sessionKey;

        routes['/api/auth/refresh'] = () => json({}, 401);
        act(() => { globalThis.dispatchEvent(new Event('online')); });

        await waitFor(() => expect(result.current.user).toBeNull());
        expect(result.current.offline).toBe(false);
        expect(result.current.sessionKey).toBe(key + 1);
        expect(readOfflineUser()).toBeNull();
    });

    it('tries to get the session back before each request, sending it with the token once it is back', async () => {
        rememberOfflineUser(ADA);
        const routes: Record<string, Answer> = { '/api/auth/refresh': unreachable, '/api/auth/me': () => json(ADA), '/api/composer-draft': unreachable };
        const fetchMock = stubApi(routes);
        const result = await renderLoaded();

        // Still offline: the request goes without a token and fails as the connection does
        await expect(result.current.authFetch('/api/composer-draft')).rejects.toThrow('Failed to fetch');
        expect(result.current.offline).toBe(true);

        routes['/api/auth/refresh'] = () => json({ accessToken: 'back-token' });
        routes['/api/composer-draft'] = () => json({ draft: null });
        await act(async () => {
            expect((await result.current.authFetch('/api/composer-draft')).status).toBe(200);
        });

        const sent = callsTo(fetchMock, '/api/composer-draft').at(-1)?.[1] as RequestInit;
        expect(new Headers(sent.headers).get('Authorization')).toBe('Bearer back-token');
        expect(result.current.offline).toBe(false);
    });

    it('keeps a live session through a refresh that reaches no API', async () => {
        const routes: Record<string, Answer> = { '/api/auth/refresh': () => json({ accessToken: 'access-token' }), '/api/auth/me': () => json(ADA), '/api/entries': () => json({}, 401) };
        stubApi(routes);
        const result = await renderLoaded();

        routes['/api/auth/refresh'] = unreachable;
        await act(async () => {
            expect((await result.current.authFetch('/api/entries')).status).toBe(401);
        });

        expect(result.current.user?.id).toBe(1);
        expect(result.current.getAccessToken()).toBe('access-token');
    });
});

describe('useAuthSession › a sign-out the server has not heard', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('is kept when the logout reaches no working API', async () => {
        rememberOfflineUser(ADA);
        const routes: Record<string, Answer> = { '/api/auth/refresh': unreachable, '/api/auth/logout': unreachable };
        stubApi(routes);
        const result = await renderLoaded();

        await act(() => result.current.logout());
        expect(result.current.user).toBeNull();
        expect(isSignOutPending()).toBe(true);

        routes['/api/auth/logout'] = () => json({}, 503);
        await act(() => result.current.logout());
        expect(isSignOutPending()).toBe(true);
    });

    it('goes first on the next load, which then stays signed out without refreshing', async () => {
        markSignOutPending();
        const fetchMock = stubApi({ '/api/auth/refresh': () => json({ accessToken: 'still-valid' }), '/api/auth/logout': () => json({ success: true }) });

        const result = await renderLoaded();

        expect(result.current.user).toBeNull();
        expect(callsTo(fetchMock, '/api/auth/logout')).toHaveLength(1);
        expect(callsTo(fetchMock, '/api/auth/refresh')).toHaveLength(0);
        expect(isSignOutPending()).toBe(false);
    });

    it('stays pending while the API still cannot be reached, and goes with the next sign-in', async () => {
        markSignOutPending();
        stubApi({ '/api/auth/logout': unreachable });

        const result = await renderLoaded();
        expect(isSignOutPending()).toBe(true);

        act(() => result.current.startSession({ accessToken: 'new-token', user: ADA }));
        expect(isSignOutPending()).toBe(false);
    });
});
