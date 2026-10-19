import { describe, expect, it, vi } from 'vitest';

import { createMemoirService } from './memoirService';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe('memoirService', () => {
  it('loads the overview', async () => {
    const authFetch = vi.fn().mockResolvedValue(ok({ program: null, chapters: [], progress: {} }));

    const result = await createMemoirService(authFetch).fetchOverview();

    expect(authFetch).toHaveBeenCalledWith('/api/memoir');
    expect(result.data).toEqual({ program: null, chapters: [], progress: {} });
  });

  it('sends each memoir change to its endpoint as JSON', async () => {
    const authFetch = vi.fn().mockImplementation(async () => ok({ success: true }));
    const service = createMemoirService(authFetch);
    const start = { diaryName: 'My memoir', emailEnabled: true, deliveryWeekday: 0, timeZone: 'Europe/Paris' };

    await service.start(start);
    await service.update({ status: 'paused' });
    await service.skip();
    await service.answer({ questionId: 'childhood-home', text: 'A fig tree.', attachmentIds: [4] });
    await service.leave();

    expect(authFetch.mock.calls).toEqual([
      ['/api/memoir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(start) }],
      ['/api/memoir', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{"status":"paused"}' }],
      ['/api/memoir/skip', { method: 'POST' }],
      [
        '/api/memoir/answers',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"questionId":"childhood-home","text":"A fig tree.","attachmentIds":[4]}',
        },
      ],
      ['/api/memoir', { method: 'DELETE' }],
    ]);
  });

  it('returns the API message when a change is refused', async () => {
    const authFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'This question already has an answer' }), { status: 409 }),
    );

    const result = await createMemoirService(authFetch).answer({ questionId: 'love-first', text: 'x' });

    expect(result).toEqual({ data: null, error: 'This question already has an answer' });
  });
});
