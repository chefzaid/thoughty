import { asUnlocked } from '@/common/content-lock/content-lock.test-helpers';
import { ContentLockController } from './content-lock.controller';

describe('ContentLockController', () => {
  const user = { userId: 3 } as never;
  const challenge = { twoFactorRequired: true as const, challengeToken: 'challenge', expiresInSeconds: 600 };
  let pins: Record<string, jest.Mock>;
  let unlocks: Record<string, jest.Mock>;
  let controller: ContentLockController;

  beforeEach(() => {
    pins = {
      find: jest.fn().mockResolvedValue({ failedAttempts: 2, blockedUntil: null }),
      hasLockedContent: jest.fn().mockResolvedValue(true),
      set: jest.fn().mockResolvedValue(null),
      remove: jest.fn().mockResolvedValue(null),
      verify: jest.fn(),
    };
    unlocks = { endAll: jest.fn(), create: jest.fn().mockResolvedValue({ token: 't', expiresAt: new Date(0) }), end: jest.fn() };
    controller = new ContentLockController(pins as never, unlocks as never);
  });

  it('says whether a PIN is set, anything is locked, how many tries are left and whether the request is unlocked', async () => {
    await expect(controller.status(user)).resolves.toEqual({
      pinSet: true, hasLockedContent: true, unlocked: false, unlockExpiresAt: null, attemptsLeft: 3, blockedUntil: null,
    });
    const blockedUntil = new Date(Date.now() + 60_000);
    pins.find.mockResolvedValue({ failedAttempts: 7, blockedUntil });
    const unlocked = await asUnlocked(3, () => controller.status(user));
    expect(unlocked).toMatchObject({ unlocked: true, unlockExpiresAt: expect.any(Date), attemptsLeft: 0, blockedUntil });

    pins.find.mockResolvedValue({ failedAttempts: 5, blockedUntil: new Date(Date.now() - 1000) });
    await expect(controller.status(user)).resolves.toMatchObject({ blockedUntil: null });
    pins.find.mockResolvedValue(null);
    await expect(controller.status(user)).resolves.toMatchObject({ pinSet: false, attemptsLeft: 5 });
  });

  it('ends every unlock once the PIN changes or goes, but not while a code is awaited', async () => {
    await expect(controller.setPin(user, { pin: '1357', currentPin: '2468' })).resolves.toEqual({ success: true });
    expect(pins.set).toHaveBeenCalledWith(3, '1357', { currentPin: '2468' });
    await expect(controller.removePin(user, { currentPin: '1357' })).resolves.toEqual({ success: true });
    expect(unlocks.endAll).toHaveBeenCalledTimes(2);

    pins.set.mockResolvedValue(challenge);
    pins.remove.mockResolvedValue(challenge);
    await expect(controller.setPin(user, { pin: '1357', password: 'x' })).resolves.toBe(challenge);
    await expect(controller.removePin(user, { password: 'x' })).resolves.toBe(challenge);
    expect(unlocks.endAll).toHaveBeenCalledTimes(2);
  });

  it('unlocks after the PIN is checked, and locks again by ending the request’s unlock', async () => {
    await expect(controller.unlock(user, { pin: '2468' })).resolves.toEqual({ token: 't', expiresAt: new Date(0) });
    expect(pins.verify).toHaveBeenCalledWith(3, '2468');
    expect(unlocks.create).toHaveBeenCalledWith(3);

    await expect(asUnlocked(3, () => controller.lock(user))).resolves.toEqual({ success: true });
    expect(unlocks.end).toHaveBeenCalledWith(3, 'a'.repeat(64));
  });
});
