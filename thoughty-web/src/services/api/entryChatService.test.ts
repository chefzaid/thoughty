import { describe, expect, it, vi } from 'vitest';

import { createEntryChatService, entryChatParams } from './entryChatService';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const messages = [{ role: 'user' as const, content: 'What comes back?' }];

describe('entryChatService', () => {
  it('asks about the filters of the scope (never its month) and the dates that are set', () => {
    expect(entryChatParams('tags=walks&month=2026-10&page=2', { from: '2026-01-01', to: '' }).toString())
      .toBe('tags=walks&dateFrom=2026-01-01');
    expect(entryChatParams('', { from: '', to: '2026-06-30' }).toString()).toBe('dateTo=2026-06-30');
  });

  it('posts the conversation and gives back the reply', async () => {
    const reply = { reply: 'Walks [1].', entries: [{ ref: 1, id: 4, date: '2026-03-01', title: null }], cited: [1], total: 1 };
    const authFetch = vi.fn().mockResolvedValue(json(reply));

    await expect(createEntryChatService(authFetch).send('tags=walks', { from: '', to: '' }, messages)).resolves.toEqual({ data: reply, error: null });
    expect(authFetch).toHaveBeenCalledWith('/api/entries/chat?tags=walks', { method: 'POST', body: JSON.stringify({ messages }) });
  });

  it("names the API's coded reason, or the fallback", async () => {
    const authFetch = vi.fn()
      .mockResolvedValueOnce(json({ code: 'ENTRY_CHAT_NO_MATCH', message: 'No entry' }, 404))
      .mockRejectedValueOnce(new Error('offline'));
    const service = createEntryChatService(authFetch);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(service.send('', { from: '', to: '' }, messages)).resolves.toEqual({ data: null, error: 'apiError_ENTRY_CHAT_NO_MATCH' });
    await expect(service.send('', { from: '', to: '' }, messages)).resolves.toEqual({ data: null, error: 'entryChatFailed' });
  });
});
