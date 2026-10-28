import { describe, expect, it, vi } from 'vitest';

import {
  createShareLinksService,
  fetchSharedContent,
  sharedAttachmentUrl,
  sharedBookFileUrl,
  shareLinkUrl,
  shareTokenFromPath,
} from './shareLinksService';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const TOKEN = 'q3Jm0bX9vN2kR7sT1uW4yZ6aC8eG0iK2mO4qS6uW8yA';

describe('shareLinksService', () => {
  it('lists, makes and revokes the links of an entry or a book version', async () => {
    const authFetch = vi.fn().mockResolvedValue(ok({ links: [], limit: 100, activeCount: 0 }));
    const service = createShareLinksService(authFetch);
    const draft = { kind: 'entry' as const, targetId: 12, expiresAt: '2026-11-04T09:00:00.000Z', maxViews: null };

    await expect(service.list({ kind: 'bookVersion', id: 9 })).resolves.toEqual({ data: { links: [], limit: 100, activeCount: 0 }, error: null });
    await service.create(draft);
    await service.revoke(7);

    expect(authFetch.mock.calls.map(([url, options]) => [url, options?.method, options?.body])).toEqual([
      ['/api/share-links?kind=bookVersion&targetId=9', undefined, undefined],
      ['/api/share-links', 'POST', JSON.stringify(draft)],
      ['/api/share-links/7', 'DELETE', undefined],
    ]);
  });

  it('gives the API error code to translate', async () => {
    const refused = new Response(JSON.stringify({ statusCode: 400, message: 'x', code: 'SHARE_LINK_LIMIT_REACHED' }), { status: 400 });
    const service = createShareLinksService(vi.fn().mockResolvedValue(refused));

    await expect(service.create({ kind: 'entry', targetId: 1, expiresAt: 'x' })).resolves.toEqual({ data: null, error: 'apiError_SHARE_LINK_LIMIT_REACHED' });
  });

  it('builds the reader’s address and the link’s file routes, and reads a token from the page address', () => {
    expect(shareLinkUrl(TOKEN, 'https://thoughty.example')).toBe(`https://thoughty.example/s/${TOKEN}`);
    expect(sharedAttachmentUrl(TOKEN, 31)).toBe(`/api/shared/${TOKEN}/attachments/31`);
    expect(sharedAttachmentUrl(TOKEN, 31, 'poster')).toBe(`/api/shared/${TOKEN}/attachments/31/poster`);
    expect(sharedBookFileUrl(TOKEN)).toBe(`/api/shared/${TOKEN}/file`);

    expect(shareTokenFromPath(`/s/${TOKEN}`)).toBe(TOKEN);
    expect(shareTokenFromPath(`/s/${TOKEN}/`)).toBe(TOKEN);
    for (const path of ['/s/', '/journal', `/s/${TOKEN}/more`, '/s/a%2Fb', `/share/${TOKEN}`]) {
      expect(shareTokenFromPath(path)).toBeNull();
    }
  });

  it('reads shared content without credentials or referrer, telling an unavailable link from a failure', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(ok({ kind: 'entry' }))
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(new Response('{}', { status: 429 }))
      .mockRejectedValueOnce(new Error('offline'));

    await expect(fetchSharedContent(TOKEN, fetchImpl)).resolves.toEqual({ status: 'ready', content: { kind: 'entry' } });
    expect(fetchImpl).toHaveBeenCalledWith(`/api/shared/${TOKEN}`, { credentials: 'omit', referrerPolicy: 'no-referrer' });
    await expect(fetchSharedContent(TOKEN, fetchImpl)).resolves.toEqual({ status: 'unavailable' });
    await expect(fetchSharedContent(TOKEN, fetchImpl)).resolves.toEqual({ status: 'failed' });
    await expect(fetchSharedContent(TOKEN, fetchImpl)).resolves.toEqual({ status: 'failed' });
  });
});
