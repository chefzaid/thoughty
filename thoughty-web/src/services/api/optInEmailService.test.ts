import { describe, expect, it, vi } from 'vitest';

import { createMonthlyRecapEmailService } from './monthlyRecapEmailService';
import { unsubscribeEmail } from './optInEmailService';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('opt-in email services', () => {
  it('read and save the monthly recap setting, with its own failure keys', async () => {
    const settings = { enabled: true, deliveryHour: 8, timeZone: 'UTC', diaryId: null, nextSendAt: '2026-11-01T08:00:00.000Z', emailAvailable: true };
    const authFetch = vi.fn().mockImplementation(() => Promise.resolve(json(settings)));
    const service = createMonthlyRecapEmailService(authFetch);
    const changes = { enabled: true, deliveryHour: 8, timeZone: 'UTC', diaryId: null };

    await expect(service.get()).resolves.toEqual({ data: settings, error: null });
    await expect(service.save(changes)).resolves.toEqual({ data: settings, error: null });
    expect(authFetch.mock.calls.map(([url, options]) => [url, options?.method])).toEqual([
      ['/api/monthly-recap-email', undefined],
      ['/api/monthly-recap-email', 'PUT'],
    ]);

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const offline = createMonthlyRecapEmailService(vi.fn().mockRejectedValue(new Error('offline')));
    await expect(offline.get()).resolves.toEqual({ data: null, error: 'monthlyRecapEmailLoadFailed' });
    await expect(offline.save(changes)).resolves.toEqual({ data: null, error: 'monthlyRecapEmailSaveFailed' });
  });

  it('unsubscribe with the link’s token, encoded, without signing in, and say which email went off', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ success: true, kind: 'monthly-recap' }));

    await expect(unsubscribeEmail('recap.3.a+b', fetchImpl)).resolves.toEqual({ data: { success: true, kind: 'monthly-recap' }, error: null });
    expect(fetchImpl).toHaveBeenCalledWith('/api/email-unsubscribe?token=recap.3.a%2Bb', { method: 'POST' });

    const invalid = json({ statusCode: 400, code: 'EMAIL_UNSUBSCRIBE_INVALID' }, 400);
    await expect(unsubscribeEmail('bad', vi.fn().mockResolvedValue(invalid))).resolves.toEqual({ data: null, error: 'apiError_EMAIL_UNSUBSCRIBE_INVALID' });
  });
});
