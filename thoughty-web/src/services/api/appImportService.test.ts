import { describe, expect, it, vi } from 'vitest';

import { createAppImportService } from './appImportService';

const jsonResponse = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
  ...init,
});

describe('appImportService', () => {
  it('posts a batch of entries as JSON', async () => {
    const authFetch = vi.fn().mockResolvedValue(jsonResponse({ entries: [], importedCount: 0, alreadyImportedCount: 0, createdDiaries: [] }));
    const service = createAppImportService(authFetch);
    const request = { source: 'dayone' as const, entries: [{ sourceId: 'A', date: '2024-03-05', content: 'x', tags: [] }] };

    const result = await service.importEntries(request);

    expect(result).toEqual({ ok: true, data: { entries: [], importedCount: 0, alreadyImportedCount: 0, createdDiaries: [] } });
    expect(authFetch).toHaveBeenCalledWith('/api/io/import/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  });

  it('uploads files with the entry each one belongs to', async () => {
    const authFetch = vi.fn().mockResolvedValue(jsonResponse({ attachments: [{ id: 1, entryId: 12, originalFilename: 'a.jpg' }] }));
    const service = createAppImportService(authFetch);

    const result = await service.uploadAttachments([new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg')], [12, 13]);

    expect(result.ok).toBe(true);
    const [url, options] = authFetch.mock.calls[0]!;
    expect(url).toBe('/api/io/import/attachments');
    const form = options.body as FormData;
    expect(form.get('entryIds')).toBe('12,13');
    expect((form.getAll('files') as File[]).map((file) => file.name)).toEqual(['a.jpg', 'b.jpg']);
  });

  it('reports the status, message, and requested wait of a refused request', async () => {
    const authFetch = vi.fn().mockResolvedValue(jsonResponse({ message: 'Too Many Requests' }, { status: 429, headers: { 'Retry-After': '42' } }));

    await expect(createAppImportService(authFetch).importEntries({ source: 'journey', entries: [] })).resolves.toEqual({
      ok: false,
      error: 'Too Many Requests',
      status: 429,
      retryAfterSeconds: 42,
    });
  });

  it('reports network failures and empty answers', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const offline = createAppImportService(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const empty = createAppImportService(vi.fn().mockResolvedValue(new Response('', { status: 200 })));

    await expect(offline.uploadAttachments([], [])).resolves.toEqual({ ok: false, error: 'Failed to attach files', status: 0 });
    await expect(empty.importEntries({ source: 'dayone', entries: [] })).resolves.toEqual({ ok: false, error: 'Failed to import entries', status: 200 });
  });
});
