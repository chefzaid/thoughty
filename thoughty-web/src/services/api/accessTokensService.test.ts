import { describe, expect, it, vi } from 'vitest';

import { createAccessTokensService } from './accessTokensService';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const draft = { name: 'Shortcut', scopes: ['entries:write' as const], expiresInDays: 90 as const, timeZone: 'Europe/Paris' };

describe('accessTokensService', () => {
  it('lists, makes and revokes tokens', async () => {
    const authFetch = vi.fn()
      .mockResolvedValueOnce(json({ tokens: [], limit: 10 }))
      .mockResolvedValueOnce(json({ id: 3, token: 'thy_x' }, 201))
      .mockResolvedValueOnce(json({ success: true }));
    const service = createAccessTokensService(authFetch);

    await expect(service.list()).resolves.toEqual({ data: { tokens: [], limit: 10 }, error: null });
    await expect(service.create(draft)).resolves.toEqual({ data: { id: 3, token: 'thy_x' }, error: null });
    await expect(service.revoke(3)).resolves.toEqual({ data: { success: true }, error: null });

    expect(authFetch.mock.calls.map(([url, options]) => [url, options?.method, options?.body])).toEqual([
      ['/api/access-tokens', undefined, undefined],
      ['/api/access-tokens', 'POST', JSON.stringify(draft)],
      ['/api/access-tokens/3', 'DELETE', undefined],
    ]);
  });

  it('gives the API’s coded reason, or a translation key when a request fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const limited = createAccessTokensService(vi.fn().mockResolvedValue(json({ statusCode: 400, code: 'ACCESS_TOKEN_LIMIT_REACHED', message: 'Access token limit reached' }, 400)));
    await expect(limited.create(draft)).resolves.toEqual({ data: null, error: 'apiError_ACCESS_TOKEN_LIMIT_REACHED' });

    const offline = createAccessTokensService(vi.fn().mockRejectedValue(new Error('offline')));
    await expect(offline.list()).resolves.toEqual({ data: null, error: 'accessTokensLoadFailed' });
    await expect(offline.create(draft)).resolves.toEqual({ data: null, error: 'accessTokenCreateFailed' });
    await expect(offline.revoke(3)).resolves.toEqual({ data: null, error: 'accessTokenRevokeFailed' });
  });
});
