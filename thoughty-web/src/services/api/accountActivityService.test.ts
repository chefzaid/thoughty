import { describe, expect, it, vi } from 'vitest';

import { createAccountActivityService } from './accountActivityService';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const page = { events: [], nextBefore: null, newBrowserEmail: true };

describe('accountActivityService', () => {
  it('reads a page of the activity, older pages before an id, and saves the email setting', async () => {
    const authFetch = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(ok(url.includes('new-browser-email') ? { newBrowserEmail: false } : page)),
    );
    const service = createAccountActivityService(authFetch);

    await expect(service.list()).resolves.toEqual({ data: page, error: null });
    await expect(service.list(42)).resolves.toEqual({ data: page, error: null });
    await expect(service.setNewBrowserEmail(false)).resolves.toEqual({ data: { newBrowserEmail: false }, error: null });

    expect(authFetch.mock.calls.map(([url, options]) => [url, options?.method, options?.body])).toEqual([
      ['/api/auth/activity', undefined, undefined],
      ['/api/auth/activity?before=42', undefined, undefined],
      ['/api/auth/activity/new-browser-email', 'PUT', JSON.stringify({ enabled: false })],
    ]);
  });

  it('gives a translation key when a request fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = createAccountActivityService(vi.fn().mockRejectedValue(new Error('offline')));

    await expect(service.list()).resolves.toEqual({ data: null, error: 'accountActivityLoadError' });
    await expect(service.setNewBrowserEmail(true)).resolves.toEqual({ data: null, error: 'newBrowserEmailSaveError' });
  });
});
