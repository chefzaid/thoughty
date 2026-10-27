import { describe, expect, it, vi } from 'vitest';

import { createOnThisDayEmailService, unsubscribeOnThisDayEmail } from './onThisDayEmailService';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const settings = { enabled: true, deliveryHour: 8, timeZone: 'Europe/Paris', diaryId: null, nextSendAt: '2026-10-28T07:00:00.000Z', emailAvailable: true };

describe('onThisDayEmailService', () => {
  it('reads and saves the setting', async () => {
    const authFetch = vi.fn().mockImplementation(() => Promise.resolve(ok(settings)));
    const service = createOnThisDayEmailService(authFetch);
    const changes = { enabled: true, deliveryHour: 8, timeZone: 'Europe/Paris', diaryId: null };

    await expect(service.get()).resolves.toEqual({ data: settings, error: null });
    await expect(service.save(changes)).resolves.toEqual({ data: settings, error: null });

    expect(authFetch.mock.calls.map(([url, options]) => [url, options?.method, options?.body])).toEqual([
      ['/api/on-this-day-email', undefined, undefined],
      ['/api/on-this-day-email', 'PUT', JSON.stringify(changes)],
    ]);
  });

  it('gives a translation key when a request fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = createOnThisDayEmailService(vi.fn().mockRejectedValue(new Error('offline')));

    await expect(service.get()).resolves.toEqual({ data: null, error: 'onThisDayEmailLoadFailed' });
    await expect(service.save({ enabled: false, deliveryHour: 8, timeZone: 'UTC', diaryId: null })).resolves.toEqual({
      data: null,
      error: 'onThisDayEmailSaveFailed',
    });
  });

  it('unsubscribes with the link’s token, encoded, without signing in', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ success: true }));

    await expect(unsubscribeOnThisDayEmail('3.a+b', fetchImpl)).resolves.toEqual({ data: { success: true }, error: null });
    expect(fetchImpl).toHaveBeenCalledWith('/api/on-this-day-email/unsubscribe?token=3.a%2Bb', { method: 'POST' });

    const invalid = new Response(JSON.stringify({ statusCode: 400, code: 'ON_THIS_DAY_UNSUBSCRIBE_INVALID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
    await expect(unsubscribeOnThisDayEmail('bad', vi.fn().mockResolvedValue(invalid))).resolves.toEqual({
      data: null,
      error: 'apiError_ON_THIS_DAY_UNSUBSCRIBE_INVALID',
    });
  });
});
