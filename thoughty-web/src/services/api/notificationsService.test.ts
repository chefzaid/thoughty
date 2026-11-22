import { describe, expect, it, vi } from 'vitest';

import { createNotificationsService } from './notificationsService';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('notificationsService', () => {
  it('lists the notifications, counts the new ones and marks them read', async () => {
    const page = { notifications: [], unreadCount: 2 };
    const authFetch = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(ok(url === '/api/notifications' ? page : { unreadCount: url.endsWith('/read') ? 0 : 2 })),
    );
    const service = createNotificationsService(authFetch);

    await expect(service.list()).resolves.toEqual({ data: page, error: null });
    await expect(service.countUnread()).resolves.toEqual({ data: { unreadCount: 2 }, error: null });
    await expect(service.markRead()).resolves.toEqual({ data: { unreadCount: 0 }, error: null });
    expect(authFetch.mock.calls.map(([url, options]) => [url, options?.method])).toEqual([
      ['/api/notifications', undefined],
      ['/api/notifications/unread', undefined],
      ['/api/notifications/read', 'PUT'],
    ]);
  });

  it('gives a translation key when a request fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = createNotificationsService(vi.fn().mockRejectedValue(new Error('offline')));

    await expect(service.list()).resolves.toEqual({ data: null, error: 'notificationsLoadError' });
    await expect(service.countUnread()).resolves.toEqual({ data: null, error: 'notificationsLoadError' });
    await expect(service.markRead()).resolves.toEqual({ data: null, error: 'notificationsLoadError' });
  });
});
