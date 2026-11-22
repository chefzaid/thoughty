import { describe, expect, it, vi } from 'vitest';

import { createDiaryWritingReminderService } from './diaryWritingReminderService';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('diary writing reminder service', () => {
  it('lists and saves the diaries’ own reminder hours, with its own failure keys', async () => {
    const reminders = { reminders: [{ diaryId: 4, deliveryHour: 7, timeZone: 'UTC', nextSendAt: '2026-11-23T07:00:00.000Z' }], emailAvailable: true };
    const authFetch = vi.fn().mockImplementation(() => Promise.resolve(json(reminders)));
    const service = createDiaryWritingReminderService(authFetch);
    const changes = { deliveryHour: 7, timeZone: 'UTC' };

    await expect(service.list()).resolves.toEqual({ data: reminders, error: null });
    await expect(service.save(4, changes)).resolves.toEqual({ data: reminders, error: null });
    expect(authFetch.mock.calls.map(([url, options]) => [url, options?.method, options?.body])).toEqual([
      ['/api/writing-reminder-email/diaries', undefined, undefined],
      ['/api/writing-reminder-email/diaries/4', 'PUT', JSON.stringify(changes)],
    ]);

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const offline = createDiaryWritingReminderService(vi.fn().mockRejectedValue(new Error('offline')));
    await expect(offline.list()).resolves.toEqual({ data: null, error: 'diaryReminderLoadFailed' });
    await expect(offline.save(4, { deliveryHour: null, timeZone: 'UTC' })).resolves.toEqual({ data: null, error: 'diaryReminderSaveFailed' });
  });
});
