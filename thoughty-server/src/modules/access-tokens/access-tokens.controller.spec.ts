import { createAccountActivityMock } from '@/modules/auth/account-activity/account-activity.test-helpers';
import { AccessTokensController } from './access-tokens.controller';
import { PublicApiController } from './public-api.controller';

describe('AccessTokensController', () => {
  const service = { list: jest.fn(), create: jest.fn(), revoke: jest.fn() };
  const activity = createAccountActivityMock();
  const controller = new AccessTokensController(service as never, activity as never);
  const user = { userId: 7, email: 'writer@example.com', username: 'writer' };

  it('passes every call on for the signed-in writer and records tokens made and revoked', async () => {
    service.list.mockResolvedValue({ tokens: [], limit: 10 });
    service.create.mockResolvedValue({ id: 1, token: 'thy_x' });
    service.revoke.mockResolvedValue({ success: true });
    const dto = { name: 'Zapier', scopes: ['entries:read'], expiresInDays: 30, timeZone: 'UTC' };

    await expect(controller.list(user)).resolves.toEqual({ tokens: [], limit: 10 });
    expect(service.list).toHaveBeenCalledWith(7);
    await expect(controller.create(user, dto as never)).resolves.toEqual({ id: 1, token: 'thy_x' });
    expect(service.create).toHaveBeenCalledWith(7, dto);
    await expect(controller.revoke(user, 1)).resolves.toEqual({ success: true });
    expect(service.revoke).toHaveBeenCalledWith(7, 1);
    expect(activity.record.mock.calls).toEqual([[7, 'access_token_created'], [7, 'access_token_revoked']]);
  });

  it('records nothing when the token could not be made or revoked', async () => {
    activity.record.mockClear();
    service.create.mockRejectedValue(new Error('limit'));
    service.revoke.mockRejectedValue(new Error('not found'));

    await expect(controller.create(user, {} as never)).rejects.toThrow('limit');
    await expect(controller.revoke(user, 2)).rejects.toThrow('not found');
    expect(activity.record).not.toHaveBeenCalled();
  });
});

describe('PublicApiController', () => {
  const service = { listDiaries: jest.fn(), listEntries: jest.fn(), createEntry: jest.fn() };
  const controller = new PublicApiController(service as never);
  const user = { userId: 7, email: 'writer@example.com', username: 'writer' };

  it('passes every call on for the token’s writer', async () => {
    service.listDiaries.mockResolvedValue({ diaries: [] });
    service.listEntries.mockResolvedValue({ entries: [], nextCursor: null });
    service.createEntry.mockResolvedValue({ id: 9, date: '2026-11-21' });
    const token = { tokenId: 1, userId: 7, scopes: ['entries:write'], timeZone: 'UTC' };

    await expect(controller.listDiaries(user)).resolves.toEqual({ diaries: [] });
    expect(service.listDiaries).toHaveBeenCalledWith(7);
    await expect(controller.listEntries(user, { limit: 5 })).resolves.toEqual({ entries: [], nextCursor: null });
    expect(service.listEntries).toHaveBeenCalledWith(7, { limit: 5 });
    await expect(controller.createEntry(token as never, { text: 'Hi' } as never)).resolves.toEqual({ id: 9, date: '2026-11-21' });
    expect(service.createEntry).toHaveBeenCalledWith(token, { text: 'Hi' });
  });
});
