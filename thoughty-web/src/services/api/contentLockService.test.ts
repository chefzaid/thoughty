import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildAuthHeaders } from './base';
import { createContentLockService } from './contentLockService';
import { getContentUnlockToken, setContentUnlockToken, subscribeContentUnlockToken } from './contentUnlockToken';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const JSON_HEADERS = { 'Content-Type': 'application/json' };

afterEach(() => setContentUnlockToken(null));

describe('contentLockService', () => {
  it('reads the state, sets and removes the PIN, unlocks, locks again and locks diaries and entries', async () => {
    const authFetch = vi.fn().mockImplementation(() => Promise.resolve(ok({ success: true })));
    const service = createContentLockService(authFetch);

    await service.status();
    await service.setPin('2468');
    await service.setPin('1357', { currentPin: '2468' });
    await service.removePin({ password: 'secret' });
    await service.unlock('1357');
    await service.lock();
    await service.setEntryLocked(4, true);
    await expect(service.setDiaryLocked(2, false)).resolves.toEqual({ data: { success: true }, error: null });

    expect(authFetch.mock.calls).toEqual([
      ['/api/content-lock'],
      ['/api/content-lock/pin', { method: 'PUT', headers: JSON_HEADERS, body: '{"pin":"2468"}' }],
      ['/api/content-lock/pin', { method: 'PUT', headers: JSON_HEADERS, body: '{"pin":"1357","currentPin":"2468"}' }],
      ['/api/content-lock/pin/remove', { method: 'POST', headers: JSON_HEADERS, body: '{"password":"secret"}' }],
      ['/api/content-lock/unlock', { method: 'POST', headers: JSON_HEADERS, body: '{"pin":"1357"}' }],
      ['/api/content-lock/unlock', { method: 'DELETE' }],
      ['/api/entries/4/lock', { method: 'PATCH', headers: JSON_HEADERS, body: '{"locked":true}' }],
      ['/api/diaries/2/lock', { method: 'PATCH', headers: JSON_HEADERS, body: '{"locked":false}' }],
    ]);
  });

  it('gives the API’s code for a wrong PIN', async () => {
    const refused = new Response(JSON.stringify({ code: 'CONTENT_PIN_INCORRECT', message: 'Wrong PIN' }), { status: 403 });
    const service = createContentLockService(vi.fn().mockResolvedValue(refused));
    await expect(service.unlock('0000')).resolves.toEqual({ data: null, error: 'apiError_CONTENT_PIN_INCORRECT' });
  });
});

describe('the unlock token', () => {
  it('is kept in memory, told to listeners, and sent with authenticated requests only', () => {
    const listener = vi.fn();
    const stop = subscribeContentUnlockToken(listener);
    expect(buildAuthHeaders({}, 'access')).not.toHaveProperty('X-Content-Unlock');

    setContentUnlockToken('token');
    setContentUnlockToken('token');
    expect(getContentUnlockToken()).toBe('token');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(buildAuthHeaders({}, 'access')).toMatchObject({ Authorization: 'Bearer access', 'X-Content-Unlock': 'token' });
    expect(buildAuthHeaders({}, null)).not.toHaveProperty('X-Content-Unlock');

    stop();
    setContentUnlockToken(null);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
