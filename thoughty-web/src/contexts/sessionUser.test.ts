import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSessionUserThrottle, sessionUserWaitMs } from './refreshThrottle';
import { readSessionUser, tokenUserId } from './sessionUser';

const ADA = { id: 1, username: 'ada', email: 'ada@example.com', authProvider: 'local', emailVerified: true, twoFactorEnabled: false };
const answer = (status: number, body: unknown = {}, headers: Record<string, string> = {}) =>
    ({ ok: status >= 200 && status < 300, status, headers: new Headers(headers), json: async () => body });
const base64Url = (value: unknown) => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

describe('sessionUser', () => {
    beforeEach(() => {
        localStorage.clear();
        clearSessionUserThrottle();
        vi.spyOn(Math, 'random').mockReturnValue(0);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('reads the account a token was signed for, and nothing from a token it cannot read', () => {
        expect(tokenUserId(`h.${base64Url({ userId: 42, email: 'ö?>~' })}.s`)).toBe(42);
        expect(tokenUserId(null)).toBeNull();
        expect(tokenUserId('opaque')).toBeNull();
        expect(tokenUserId('h.%%%.s')).toBeNull();
        expect(tokenUserId(`h.${base64Url({ userId: '42' })}.s`)).toBeNull();
        expect(tokenUserId(`h.${base64Url(null)}.s`)).toBeNull();
    });

    it('says whose the session is, that it is gone, or nothing', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        fetchMock.mockResolvedValueOnce(answer(200, ADA));
        expect(await readSessionUser('token')).toEqual({ kind: 'user', user: ADA });
        expect(new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).get('Authorization')).toBe('Bearer token');

        fetchMock.mockResolvedValueOnce(answer(401));
        expect(await readSessionUser('token')).toEqual({ kind: 'refused' });
        fetchMock.mockResolvedValueOnce(answer(403));
        expect(await readSessionUser('token')).toEqual({ kind: 'refused' });
        fetchMock.mockResolvedValueOnce(answer(500));
        expect(await readSessionUser('token')).toEqual({ kind: 'unanswered' });
        fetchMock.mockResolvedValueOnce(answer(404));
        expect(await readSessionUser('token')).toEqual({ kind: 'unanswered' });
        fetchMock.mockResolvedValueOnce(answer(200, null));
        expect(await readSessionUser('token')).toEqual({ kind: 'unanswered' });
        fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
        expect(await readSessionUser('token')).toEqual({ kind: 'unanswered' });
    });

    it('waits as long as a 429 asks, sending nothing meanwhile', async () => {
        const fetchMock = vi.fn().mockResolvedValue(answer(429, {}, { 'Retry-After': '30' }));
        vi.stubGlobal('fetch', fetchMock);

        expect(await readSessionUser('token')).toEqual({ kind: 'wait', retryInMs: 30_000 });
        const again = await readSessionUser('token');

        expect(again.kind).toBe('wait');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(sessionUserWaitMs()).toBeGreaterThan(29_000);
    });

    it('shares one request between callers asking at the same time', async () => {
        const fetchMock = vi.fn().mockResolvedValue(answer(200, ADA));
        vi.stubGlobal('fetch', fetchMock);

        const [first, second] = await Promise.all([readSessionUser('token'), readSessionUser('token')]);
        await readSessionUser('token');

        expect(first).toEqual(second);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
