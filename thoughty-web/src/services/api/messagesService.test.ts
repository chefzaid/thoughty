import { describe, expect, it, vi } from 'vitest';

import { createMessagesService } from './messagesService';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('messagesService', () => {
  it('calls each conversation route', async () => {
    const authFetch = vi.fn().mockImplementation(() => Promise.resolve(ok({ ok: true })));
    const service = createMessagesService(authFetch);

    await service.list();
    await service.countUnread();
    await service.open(2);
    await service.thread(7);
    await service.thread(7, 30);
    await expect(service.send(7, 'Hello')).resolves.toEqual({ data: { ok: true }, error: null });
    await service.markRead(7);
    await service.deleteMessage(7, 30);
    await service.deleteConversation(7);

    expect(authFetch.mock.calls.map(([url, options]) => [url, options?.method])).toEqual([
      ['/api/conversations', undefined],
      ['/api/conversations/unread', undefined],
      ['/api/conversations/with/2', 'PUT'],
      ['/api/conversations/7', undefined],
      ['/api/conversations/7?before=30', undefined],
      ['/api/conversations/7/messages', 'POST'],
      ['/api/conversations/7/read', 'PUT'],
      ['/api/conversations/7/messages/30', 'DELETE'],
      ['/api/conversations/7', 'DELETE'],
    ]);
    expect(authFetch.mock.calls[5]?.[1]?.body).toBe(JSON.stringify({ body: 'Hello' }));
  });

  it('sends the entry a message shares', async () => {
    const authFetch = vi.fn().mockImplementation(() => Promise.resolve(ok({ ok: true })));

    await createMessagesService(authFetch).send(7, 'Look', 42);

    expect(authFetch.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ body: 'Look', entryId: 42 }));
  });

  it('gives a translation key when a request fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = createMessagesService(vi.fn().mockRejectedValue(new Error('offline')));

    await expect(service.list()).resolves.toEqual({ data: null, error: 'messagesLoadError' });
    await expect(service.open(2)).resolves.toEqual({ data: null, error: 'messagesOpenError' });
    await expect(service.send(7, 'Hi')).resolves.toEqual({ data: null, error: 'messageSendError' });
    await expect(service.deleteMessage(7, 30)).resolves.toEqual({ data: null, error: 'messageDeleteError' });
    await expect(service.deleteConversation(7)).resolves.toEqual({ data: null, error: 'conversationDeleteError' });
  });
});
