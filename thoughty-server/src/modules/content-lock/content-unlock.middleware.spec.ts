import { currentContentAccess, LOCKED_ACCESS, type ContentAccess } from '@/common/content-lock';
import { ContentUnlockMiddleware } from './content-unlock.middleware';

describe('ContentUnlockMiddleware', () => {
  const unlocked: ContentAccess = { unlockedUserId: 3, unlockExpiresAt: new Date(), unlockTokenHash: 'hash' };
  let unlocks: { resolve: jest.Mock };
  let middleware: ContentUnlockMiddleware;

  beforeEach(() => {
    unlocks = { resolve: jest.fn().mockResolvedValue(unlocked) };
    middleware = new ContentUnlockMiddleware(unlocks as never);
  });

  const accessDuring = async (headers: Record<string, unknown>): Promise<ContentAccess> => {
    let seen: ContentAccess | undefined;
    await middleware.use({ headers } as never, {} as never, () => {
      seen = currentContentAccess();
    });
    return seen!;
  };

  it('runs the request with what its X-Content-Unlock header unlocks', async () => {
    await expect(accessDuring({ 'x-content-unlock': 'token' })).resolves.toBe(unlocked);
    expect(unlocks.resolve).toHaveBeenCalledWith('token');
  });

  it('unlocks nothing without the header, and when the unlock cannot be read', async () => {
    await expect(accessDuring({})).resolves.toBe(LOCKED_ACCESS);
    await expect(accessDuring({ 'x-content-unlock': ['a', 'b'] })).resolves.toBe(LOCKED_ACCESS);
    expect(unlocks.resolve).not.toHaveBeenCalled();

    unlocks.resolve.mockRejectedValueOnce(new Error('database down'));
    await expect(accessDuring({ 'x-content-unlock': 'token' })).resolves.toBe(LOCKED_ACCESS);
    unlocks.resolve.mockRejectedValueOnce('odd');
    await expect(accessDuring({ 'x-content-unlock': 'token' })).resolves.toBe(LOCKED_ACCESS);
  });
});
