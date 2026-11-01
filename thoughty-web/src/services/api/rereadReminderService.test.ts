import { describe, expect, it, vi } from 'vitest';

import { createRereadReminderService } from './rereadReminderService';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const answer = { success: true, entry: { id: 4, reread_on: '2026-11-07' } };

describe('rereadReminderService', () => {
  it('sets a reminder with the writer’s day, and clears it', async () => {
    const authFetch = vi.fn().mockImplementation(() => Promise.resolve(ok(answer)));
    const service = createRereadReminderService(authFetch);

    await expect(service.set(4, '2026-11-07', '2026-10-31')).resolves.toEqual({ data: answer, error: null });
    await service.clear(4);

    expect(authFetch).toHaveBeenNthCalledWith(1, '/api/entries/4/reread-reminder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rereadOn: '2026-11-07', today: '2026-10-31' }),
    });
    expect(authFetch).toHaveBeenNthCalledWith(2, '/api/entries/4/reread-reminder', { method: 'DELETE' });
  });

  it('gives the API error, or a translation key when the request fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const refused = new Response(JSON.stringify({ code: 'REREAD_DATE_INVALID', message: 'Choose' }), { status: 400 });
    const service = createRereadReminderService(vi.fn().mockResolvedValueOnce(refused).mockRejectedValueOnce(new Error('offline')));

    await expect(service.set(4, '2026-10-31', '2026-10-31')).resolves.toEqual({ data: null, error: 'apiError_REREAD_DATE_INVALID' });
    await expect(service.clear(4)).resolves.toEqual({ data: null, error: 'rereadRemoveFailed' });
  });
});
