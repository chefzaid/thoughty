import { describe, expect, it, vi } from 'vitest';

import { createOpenTasksService } from './openTasksService';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('openTasksService', () => {
  it('asks for one page of the open tasks, of one diary or all of them', async () => {
    const page = { tasks: [], total: 0, page: 2, totalPages: 0, nextCursor: null };
    const authFetch = vi.fn().mockImplementation(() => Promise.resolve(json(page)));
    const service = createOpenTasksService(authFetch);

    await expect(service.fetchPage(2, 50, null)).resolves.toEqual({ data: page, error: null });
    await service.fetchPage(1, 50, 7);
    await service.fetchPage(2, 50, 7, '2026-10-21_09:30_1_42_3');

    expect(authFetch.mock.calls.map(([url]) => url)).toEqual([
      '/api/entries/open-tasks?page=2&limit=50',
      '/api/entries/open-tasks?page=1&limit=50&diaryId=7',
      '/api/entries/open-tasks?after=2026-10-21_09%3A30_1_42_3&limit=50&diaryId=7',
    ]);
  });

  it('turns a failed request into the API error code or the load error', async () => {
    const service = createOpenTasksService(vi.fn().mockResolvedValue(json({ code: 'VALIDATION_FAILED', message: 'bad' }, 400)));
    await expect(service.fetchPage(1, 50, null)).resolves.toEqual({ data: null, error: 'apiError_VALIDATION_FAILED' });

    const offline = createOpenTasksService(vi.fn().mockRejectedValue(new Error('offline')));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(offline.fetchPage(1, 50, null)).resolves.toEqual({ data: null, error: 'openTasksLoadError' });
    consoleError.mockRestore();
  });
});
