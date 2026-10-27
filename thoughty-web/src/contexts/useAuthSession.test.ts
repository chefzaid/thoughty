import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { takeLegacyRefreshToken, useAuthSession } from './useAuthSession';

const json = (body: unknown, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
});

/** Answers the refresh with a new access token and `/me` with `me`. */
function stubFetch(me: () => unknown) {
    const fetchMock = vi.fn(async (url: string) => {
        if (url === '/api/auth/refresh') {
            return json({ accessToken: 'access-token' });
        }
        if (url === '/api/auth/me') {
            return me();
        }
        return json({});
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

async function renderSession() {
    const hook = renderHook(() => useAuthSession());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    return hook.result;
}

describe('useAuthSession', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('returns no legacy token when localStorage cannot be read', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });

        expect(takeLegacyRefreshToken()).toBeNull();
    });

    it('treats a refresh answer without an access token as signed out', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({})));

        const result = await renderSession();

        expect(result.current.user).toBeNull();
        expect(result.current.getAccessToken()).toBeNull();
    });

    it('runs the refresh inside a cross-tab lock when the browser has Web Locks', async () => {
        const request = vi.fn((_name: string, task: () => Promise<unknown>) => task());
        vi.stubGlobal('navigator', { ...navigator, locks: { request } });
        stubFetch(() => json({ id: 1, username: 'ada', email: 'ada@example.com' }));

        const result = await renderSession();

        expect(request).toHaveBeenCalledWith('thoughty.auth-refresh', expect.any(Function));
        expect(result.current.user?.username).toBe('ada');
    });

    it.each([
        ['the profile request is refused', () => json({}, 500)],
        ['the profile has no body', () => ({ ok: true, status: 200, json: async () => null })],
        ['the profile request fails', () => {
            throw new Error('offline');
        }],
    ])('drops the access token when %s', async (_case, me) => {
        stubFetch(me);

        const result = await renderSession();

        expect(result.current.user).toBeNull();
        expect(result.current.getAccessToken()).toBeNull();
    });

    it('signs out locally even when the logout request fails', async () => {
        const fetchMock = stubFetch(() => json({ id: 1, username: 'ada', email: 'ada@example.com' }));
        const result = await renderSession();
        fetchMock.mockRejectedValueOnce(new Error('offline'));

        await act(async () => {
            await result.current.logout();
        });

        expect(console.error).toHaveBeenCalledWith('Logout error:', expect.any(Error));
        expect(result.current.user).toBeNull();
        expect(result.current.getAccessToken()).toBeNull();
    });

    it('sends a multipart body without a JSON content type, also when retrying after a refresh', async () => {
        const fetchMock = stubFetch(() => json({ id: 1, username: 'ada', email: 'ada@example.com' }));
        const result = await renderSession();
        fetchMock.mockResolvedValueOnce(json({}, 401));
        const body = new FormData();
        body.append('coverImage', new Blob(['png'], { type: 'image/png' }), 'cover.png');

        await act(async () => {
            await result.current.authFetch('/api/books/export?format=pdf', { method: 'POST', body });
        });

        const uploads = fetchMock.mock.calls.filter(([url]) => url === '/api/books/export?format=pdf');
        expect(uploads).toHaveLength(2);
        for (const [, init] of uploads as unknown as Array<[string, RequestInit]>) {
            expect(init.body).toBe(body);
            expect(init.headers).toEqual({ Authorization: 'Bearer access-token' });
        }
    });

    it('sends JSON text as JSON and keeps a content type the caller chose', async () => {
        const fetchMock = stubFetch(() => json({ id: 1, username: 'ada', email: 'ada@example.com' }));
        const result = await renderSession();

        await act(async () => {
            await result.current.authFetch('/api/entries', { method: 'POST', body: '{"text":"Hi"}' });
            await result.current.authFetch('/api/notes', { method: 'POST', body: 'Hi', headers: { 'Content-Type': 'text/plain' } });
        });

        const headersFor = (url: string) =>
            (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>).find(([called]) => called === url)?.[1].headers;
        expect(headersFor('/api/entries')).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer access-token' });
        expect(headersFor('/api/notes')).toEqual({ 'Content-Type': 'text/plain', Authorization: 'Bearer access-token' });
    });

    it('keeps the 401 response when the access token cannot be refreshed', async () => {
        const fetchMock = stubFetch(() => json({ id: 1, username: 'ada', email: 'ada@example.com' }));
        const result = await renderSession();
        fetchMock.mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({}, 401));

        let response: Response | undefined;
        await act(async () => {
            response = await result.current.authFetch('/api/entries');
        });

        expect(response?.status).toBe(401);
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });
});
