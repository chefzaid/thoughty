import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { getContentUnlockToken, setContentUnlockToken } from '../services/api/contentUnlockToken';
import { openSessionChannel, type SessionMessage } from './sessionBroadcast';
import { useAuthSession } from './useAuthSession';

const json = (body: unknown, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
});

const ADA = { id: 1, username: 'ada', email: 'ada@example.com', authProvider: 'local' as const, emailVerified: true, twoFactorEnabled: false };

/** A signed-in tab: the refresh cookie gives a token and `/me` answers Ada; `refresh` answers the later refreshes. */
async function renderSignedIn(refresh: () => unknown = () => json({ accessToken: 'access-token' })) {
    let refreshes = 0;
    const fetchMock = vi.fn(async (url: string) => {
        if (url === '/api/auth/refresh') {
            refreshes += 1;
            return refreshes === 1 ? json({ accessToken: 'access-token' }) : refresh();
        }
        if (url === '/api/auth/me') return json(ADA);
        return json({});
    });
    vi.stubGlobal('fetch', fetchMock);
    const hook = renderHook(() => useAuthSession());
    await waitFor(() => expect(hook.result.current.user?.id).toBe(1));
    return { result: hook.result, fetchMock };
}

/** Another tab of this browser: what it hears, and a way to speak. */
function otherTab() {
    const heard: SessionMessage[] = [];
    const channel = openSessionChannel((message) => heard.push(message));
    return { heard, post: (message: SessionMessage) => channel.post(message), close: () => channel.close() };
}

const callsTo = (fetchMock: ReturnType<typeof vi.fn>, url: string) =>
    fetchMock.mock.calls.filter(([called]) => called === url);

describe('useAuthSession › every way a session ends', () => {
    const tabs: Array<{ close: () => void }> = [];
    const openTab = () => {
        const tab = otherTab();
        tabs.push(tab);
        return tab;
    };

    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        localStorage.clear();
    });

    afterEach(() => {
        for (const tab of tabs.splice(0)) tab.close();
        setContentUnlockToken(null);
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('signs out here at once, before the server answers, and tells the other tabs', async () => {
        const { result, fetchMock } = await renderSignedIn();
        const tab = openTab();
        setContentUnlockToken('unlock');
        localStorage.setItem('thoughty.composerDraft.1', '{"fields":{}}');
        let answerLogout: (value: unknown) => void = () => undefined;
        fetchMock.mockImplementationOnce(() => new Promise((resolve) => { answerLogout = resolve; }));
        const key = result.current.sessionKey;

        let loggedOut: Promise<void> = Promise.resolve();
        act(() => { loggedOut = result.current.logout(); });

        expect(result.current.user).toBeNull();
        expect(result.current.sessionKey).toBe(key + 1);
        expect(result.current.getAccessToken()).toBeNull();
        expect(getContentUnlockToken()).toBeNull();
        expect(localStorage.getItem('thoughty.composerDraft.1')).toBeNull();
        await act(async () => {
            answerLogout(json({ success: true }));
            await loggedOut;
        });
        expect(callsTo(fetchMock, '/api/auth/logout')).toHaveLength(1);
        await waitFor(() => expect(tab.heard).toEqual([{ type: 'signed-out' }]));
    });

    it('waits for a refresh in flight, so the logout revokes the cookie that refresh set', async () => {
        const request = vi.fn((_name: string, task: () => Promise<unknown>) => task());
        vi.stubGlobal('navigator', { ...navigator, locks: { request } });
        const { result, fetchMock } = await renderSignedIn();
        request.mockClear();

        await act(() => result.current.logout());

        expect(request).toHaveBeenCalledTimes(1);
        expect(request).toHaveBeenCalledWith('thoughty.auth-refresh', expect.any(Function));
        expect(callsTo(fetchMock, '/api/auth/logout')).toHaveLength(1);
    });

    it('ends the session when a refresh fails, keeping the draft copy that may not be on the server yet', async () => {
        const { result, fetchMock } = await renderSignedIn(() => json({}, 401));
        localStorage.setItem('thoughty.composerDraft.1', '{"fields":{}}');
        setContentUnlockToken('unlock');
        const key = result.current.sessionKey;
        fetchMock.mockResolvedValueOnce(json({}, 401));

        await act(async () => {
            await result.current.authFetch('/api/entries');
        });

        expect(result.current.user).toBeNull();
        expect(result.current.sessionKey).toBe(key + 1);
        expect(getContentUnlockToken()).toBeNull();
        expect(localStorage.getItem('thoughty.composerDraft.1')).not.toBeNull();
    });

    it('never refreshes for a request sent without a session, nor for one whose session ended meanwhile', async () => {
        const { result, fetchMock } = await renderSignedIn();
        let answerEntries: (value: unknown) => void = () => undefined;
        fetchMock.mockImplementationOnce(() => new Promise((resolve) => { answerEntries = resolve; }));

        let pending: Promise<Response> = Promise.resolve(new Response());
        act(() => { pending = result.current.authFetch('/api/entries'); });
        await act(() => result.current.logout());
        const key = result.current.sessionKey;
        await act(async () => {
            answerEntries(json({}, 401));
            expect((await pending).status).toBe(401);
            expect((await result.current.authFetch('/api/feature-requests')).status).toBe(200);
        });
        fetchMock.mockResolvedValueOnce(json({}, 401));
        await act(() => result.current.authFetch('/api/entries'));

        expect(callsTo(fetchMock, '/api/auth/refresh')).toHaveLength(1);
        expect(callsTo(fetchMock, '/api/entries')).toHaveLength(2);
        expect(result.current.sessionKey).toBe(key);
    });

    it('drops a refresh that answers after its session ended', async () => {
        let answerRefresh: (value: unknown) => void = () => undefined;
        const { result, fetchMock } = await renderSignedIn(() => new Promise((resolve) => { answerRefresh = resolve; }));
        fetchMock.mockResolvedValueOnce(json({}, 401));

        let pending: Promise<Response> = Promise.resolve(new Response());
        act(() => { pending = result.current.authFetch('/api/entries'); });
        await waitFor(() => expect(callsTo(fetchMock, '/api/auth/refresh')).toHaveLength(2));
        let loggedOut: Promise<void> = Promise.resolve();
        act(() => { loggedOut = result.current.logout(); });
        await act(async () => {
            answerRefresh(json({ accessToken: 'late-token' }));
            await pending;
            await loggedOut;
        });

        expect(result.current.getAccessToken()).toBeNull();
        expect(callsTo(fetchMock, '/api/entries')).toHaveLength(1);
    });

    it('signs out with the account it deletes, here and in the other tabs', async () => {
        const { result } = await renderSignedIn();
        const tab = openTab();
        localStorage.setItem('thoughty.composerDraft.1', '{"fields":{}}');
        const key = result.current.sessionKey;

        act(() => result.current.signOutLocally());

        expect(result.current.user).toBeNull();
        expect(result.current.sessionKey).toBe(key + 1);
        expect(localStorage.getItem('thoughty.composerDraft.1')).toBeNull();
        await waitFor(() => expect(tab.heard).toEqual([{ type: 'signed-out' }]));
    });

    it('ends when another tab signs out or another writer signs in there, not when the same writer does', async () => {
        const { result } = await renderSignedIn();
        const tab = openTab();
        const key = result.current.sessionKey;

        tab.post({ type: 'signed-in', userId: 1 });
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(result.current.user?.id).toBe(1);

        tab.post({ type: 'signed-out' });
        await waitFor(() => expect(result.current.user).toBeNull());
        expect(result.current.sessionKey).toBe(key + 1);
        expect(result.current.getAccessToken()).toBeNull();

        act(() => result.current.startSession({ accessToken: 'again', user: ADA }));
        await waitFor(() => expect(tab.heard).toEqual([{ type: 'signed-in', userId: 1 }]));
        tab.post({ type: 'signed-in', userId: 2 });
        await waitFor(() => expect(result.current.user).toBeNull());
        expect(result.current.sessionKey).toBe(key + 2);
    });

    it('starts afresh when another writer signs in over the one signed in here', async () => {
        const { result } = await renderSignedIn();
        const key = result.current.sessionKey;

        act(() => result.current.startSession({ accessToken: 'ada-again', user: ADA }));
        expect(result.current.sessionKey).toBe(key);

        act(() => result.current.startSession({ accessToken: 'bo-token', user: { ...ADA, id: 2, username: 'bo' } }));
        expect(result.current.sessionKey).toBe(key + 1);
        expect(result.current.user?.username).toBe('bo');
        expect(result.current.getAccessToken()).toBe('bo-token');
    });

    it('ignores what is not a session message on the channel', async () => {
        const { result } = await renderSignedIn();
        const raw = new BroadcastChannel('thoughty.auth-session');
        raw.postMessage({ type: 'signed-in', userId: 'two' });
        raw.postMessage({ type: 'reset' });
        raw.postMessage(null);
        await new Promise((resolve) => setTimeout(resolve, 10));
        raw.close();

        expect(result.current.user?.id).toBe(1);
    });
});
