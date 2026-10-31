import { describe, expect, it, vi } from 'vitest';

import { createRecycleBinService } from './recycleBinService';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('recycleBinService', () => {
  it('asks for one page of the bin', async () => {
    const authFetch = vi.fn().mockResolvedValue(ok({ entries: [], total: 0 }));
    const service = createRecycleBinService(authFetch);

    await expect(service.fetchPage(2, 20)).resolves.toEqual({ data: { entries: [], total: 0 }, error: null });
    expect(authFetch).toHaveBeenCalledWith('/api/recycle-bin?page=2&limit=20');
  });

  it('restores and deletes chosen entries, or the whole bin', async () => {
    const authFetch = vi.fn().mockResolvedValue(ok({ success: true }));
    const service = createRecycleBinService(authFetch);

    await service.restore([3, 4]);
    await service.restore([6], { inPlace: true });
    await service.restoreAll();
    await service.deletePermanently([5]);
    await service.empty();

    expect(authFetch.mock.calls.map(([url, options]) => [url, options.method, options.body])).toEqual([
      ['/api/recycle-bin/restore', 'POST', '{"ids":[3,4]}'],
      ['/api/recycle-bin/restore', 'POST', '{"ids":[6],"inPlace":true}'],
      ['/api/recycle-bin/restore-all', 'POST', undefined],
      ['/api/recycle-bin/delete', 'POST', '{"ids":[5]}'],
      ['/api/recycle-bin', 'DELETE', undefined],
    ]);
  });

  it('turns a failed request into a readable error', async () => {
    const authFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'No matching entries in the recycle bin' }), { status: 404 }),
    );
    const service = createRecycleBinService(authFetch);

    await expect(service.restore([9])).resolves.toEqual({ data: null, error: 'No matching entries in the recycle bin' });
  });
});
