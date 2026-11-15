import { describe, expect, it, vi } from 'vitest';

import { createComposerDraftService, type ComposerDraftFields } from './composerDraftService';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const fields: ComposerDraftFields = { text: 'We walked', title: null, tags: ['walks'], format: 'plain', mood: null, feelings: [] };
const draft = { ...fields, revision: 2, updatedAt: '2026-11-15T09:30:00.000Z' };

describe('composerDraftService', () => {
  it('loads, saves on top of a revision and discards the draft', async () => {
    const authFetch = vi.fn()
      .mockResolvedValueOnce(json({ draft }))
      .mockResolvedValueOnce(json(draft))
      .mockResolvedValueOnce(json({ success: true }))
      .mockResolvedValueOnce(json({ success: true }));
    const service = createComposerDraftService(authFetch);

    await expect(service.load()).resolves.toEqual({ status: 'ok', data: draft });
    await expect(service.save(fields, 1)).resolves.toEqual({ status: 'ok', data: draft });
    await expect(service.discard(2)).resolves.toEqual({ status: 'ok', data: null });
    await service.discard(null);

    expect(authFetch.mock.calls.map(([url, options]) => [url, options?.method, options?.body])).toEqual([
      ['/api/composer-draft', undefined, undefined],
      ['/api/composer-draft', 'PUT', JSON.stringify({ ...fields, baseRevision: 1 })],
      ['/api/composer-draft?revision=2', 'DELETE', undefined],
      ['/api/composer-draft', 'DELETE', undefined],
    ]);
  });

  it('tells a conflict, a request that never reached the API and any other failure apart', async () => {
    const authFetch = vi.fn()
      .mockResolvedValueOnce(json({ statusCode: 409, code: 'COMPOSER_DRAFT_CONFLICT' }, 409))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(json({ statusCode: 429, code: 'RATE_LIMITED' }, 429))
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(json({ statusCode: 409, code: 'COMPOSER_DRAFT_CONFLICT' }, 409));
    const service = createComposerDraftService(authFetch);

    await expect(service.save(fields, 1)).resolves.toEqual({ status: 'conflict' });
    await expect(service.save(fields, 1)).resolves.toEqual({ status: 'offline' });
    await expect(service.load()).resolves.toEqual({ status: 'failed' });
    await expect(service.load()).resolves.toEqual({ status: 'failed' });
    await expect(service.discard(1)).resolves.toEqual({ status: 'conflict' });
  });
});
