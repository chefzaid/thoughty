import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { TooManyPinAttemptsException } from '@/common/content-lock';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { ContentPinService, pinLockoutMs } from './content-pin.service';

const MINUTE = 60_000;

describe('pinLockoutMs', () => {
  it('lets four wrong PINs go, then blocks for a minute and doubles the wait up to a day', () => {
    expect([0, 1, 4].map(pinLockoutMs)).toEqual([0, 0, 0]);
    expect(pinLockoutMs(5)).toBe(MINUTE);
    expect(pinLockoutMs(6)).toBe(2 * MINUTE);
    expect(pinLockoutMs(8)).toBe(8 * MINUTE);
    expect(pinLockoutMs(40)).toBe(24 * 60 * MINUTE);
  });
});

describe('ContentPinService', () => {
  const now = new Date('2026-11-17T10:00:00Z');
  let pinHash: string;
  let row: { userId: number; pinHash: string; failedAttempts: number; blockedUntil: Date | null } | null;
  let pins: { findOne: jest.Mock; exists: jest.Mock; upsert: jest.Mock; update: jest.Mock; delete: jest.Mock };
  let users: { findOne: jest.Mock };
  let manager: { getRepository: jest.Mock; query: jest.Mock };
  let dataSource: { transaction: jest.Mock; query: jest.Mock };
  let twoFactor: { startContentPinChallenge: jest.Mock; consumeContentPinChallenge: jest.Mock };
  let service: ContentPinService;

  beforeAll(async () => {
    pinHash = await bcrypt.hash('2468', 4);
  });

  beforeEach(() => {
    row = { userId: 3, pinHash, failedAttempts: 0, blockedUntil: null };
    pins = {
      findOne: jest.fn(async () => row),
      exists: jest.fn(async () => row !== null),
      upsert: jest.fn(),
      update: jest.fn(async (_where, fields: Partial<NonNullable<typeof row>>) => {
        if (row) Object.assign(row, fields);
      }),
      delete: jest.fn(),
    };
    users = { findOne: jest.fn().mockResolvedValue({ id: 3, passwordHash: null, twoFactorEnabled: false }) };
    manager = { getRepository: jest.fn(() => pins), query: jest.fn() };
    dataSource = { transaction: jest.fn((work) => work(manager)), query: jest.fn().mockResolvedValue([{ locked: false }]) };
    twoFactor = {
      startContentPinChallenge: jest.fn().mockResolvedValue({ twoFactorRequired: true, challengeToken: 'challenge', expiresInSeconds: 600 }),
      consumeContentPinChallenge: jest.fn(),
    };
    service = new ContentPinService(pins as never, users as never, dataSource as never, twoFactor as never);
  });

  it('checks the PIN under a row lock and clears the wrong tries on the right one', async () => {
    row!.failedAttempts = 3;
    await service.verify(3, '2468', now);

    expect(pins.findOne).toHaveBeenCalledWith({ where: { userId: 3 }, lock: { mode: 'pessimistic_write' } });
    expect(row).toMatchObject({ failedAttempts: 0, blockedUntil: null });
    pins.update.mockClear();
    await service.verify(3, '2468', now);
    expect(pins.update).not.toHaveBeenCalled();
  });

  it('counts wrong PINs, blocks from the fifth, and keeps the count after the block ends', async () => {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await expectApiError(service.verify(3, '0000', now), ForbiddenException, 'CONTENT_PIN_INCORRECT');
    }
    expect(row).toMatchObject({ failedAttempts: 4, blockedUntil: null });

    await expectApiError(service.verify(3, '0000', now), TooManyPinAttemptsException, 'CONTENT_PIN_BLOCKED');
    expect(row!.blockedUntil).toEqual(new Date(now.getTime() + MINUTE));
    // While blocked, even the right PIN is not checked
    await expectApiError(service.verify(3, '2468', new Date(now.getTime() + 30_000)), TooManyPinAttemptsException, 'CONTENT_PIN_BLOCKED');
    expect(row!.failedAttempts).toBe(5);

    const later = new Date(now.getTime() + 2 * MINUTE);
    await expectApiError(service.verify(3, '0000', later), TooManyPinAttemptsException, 'CONTENT_PIN_BLOCKED');
    expect(row).toMatchObject({ failedAttempts: 6, blockedUntil: new Date(later.getTime() + 2 * MINUTE) });
  });

  it('refuses checking or locking without a PIN', async () => {
    row = null;
    await expectApiError(service.verify(3, '2468', now), ConflictException, 'CONTENT_PIN_NOT_SET');
    await expectApiError(service.assertPinSet(3), ConflictException, 'CONTENT_PIN_NOT_SET');
    await expectApiError(service.remove(3, { currentPin: '2468' }), ConflictException, 'CONTENT_PIN_NOT_SET');
  });

  it('sets a first PIN as a bcrypt hash without a proof', async () => {
    row = null;
    await expect(service.set(3, '1357', {})).resolves.toBeNull();

    const [saved, conflictPaths] = pins.upsert.mock.calls[0];
    expect(conflictPaths).toEqual(['userId']);
    expect(saved).toMatchObject({ userId: 3, failedAttempts: 0, blockedUntil: null });
    expect(saved.pinHash).not.toContain('1357');
    await expect(bcrypt.compare('1357', saved.pinHash)).resolves.toBe(true);
    await expect(service.assertPinSet(3)).rejects.toBeDefined();
  });

  it('changes the PIN with the current one, which counts as a try', async () => {
    users.findOne.mockResolvedValueOnce({ id: 3, passwordHash: 'a password account', twoFactorEnabled: false });
    await expectApiError(service.set(3, '1357', {}), BadRequestException, 'CONTENT_PIN_PROOF_REQUIRED');
    await expectApiError(service.set(3, '1357', { currentPin: '0000' }), ForbiddenException, 'CONTENT_PIN_INCORRECT');
    expect(row!.failedAttempts).toBe(1);
    await expect(service.set(3, '1357', { currentPin: '2468' })).resolves.toBeNull();
    expect(pins.upsert).toHaveBeenCalledTimes(1);
  });

  it('resets a forgotten PIN with the account password, then the emailed code when two-factor is on', async () => {
    const passwordHash = await bcrypt.hash('Secret123!', 4);
    users.findOne.mockResolvedValue({ id: 3, passwordHash, twoFactorEnabled: false });
    await expectApiError(service.set(3, '1357', { password: 'nope' }), UnauthorizedException, 'AUTH_INVALID_PASSWORD');
    await expect(service.set(3, '1357', { password: 'Secret123!' })).resolves.toBeNull();

    users.findOne.mockResolvedValue({ id: 3, passwordHash, twoFactorEnabled: true });
    await expect(service.set(3, '1357', { password: 'Secret123!' })).resolves.toMatchObject({ twoFactorRequired: true });
    expect(pins.upsert).toHaveBeenCalledTimes(1);
    await expect(service.set(3, '1357', { password: 'Secret123!', challengeToken: 'challenge', code: '123456' })).resolves.toBeNull();
    expect(twoFactor.consumeContentPinChallenge).toHaveBeenCalledWith(3, { challengeToken: 'challenge', code: '123456' });
    expect(pins.upsert).toHaveBeenCalledTimes(2);
  });

  it('confirms an account without a password by an emailed code', async () => {
    await expect(service.set(3, '1357', {})).resolves.toMatchObject({ challengeToken: 'challenge' });
    expect(twoFactor.startContentPinChallenge).toHaveBeenCalledWith({ id: 3, passwordHash: null, twoFactorEnabled: false });
    await expect(service.set(3, '1357', { challengeToken: 'challenge', code: '123456' })).resolves.toBeNull();

    users.findOne.mockResolvedValue(null);
    await expectApiError(service.set(3, '1357', {}), NotFoundException, 'USER_NOT_FOUND');
  });

  it('removes the PIN and every lock with it, after the proof', async () => {
    await expect(service.remove(3, { currentPin: '2468' })).resolves.toBeNull();

    expect(manager.query).toHaveBeenCalledWith('UPDATE diaries SET is_locked = false WHERE user_id = $1 AND is_locked', [3]);
    expect(manager.query).toHaveBeenCalledWith('UPDATE entries SET is_locked = false WHERE user_id = $1 AND is_locked', [3]);
    expect(pins.delete).toHaveBeenCalledWith({ userId: 3 });

    pins.delete.mockClear();
    await expect(service.remove(3, {})).resolves.toMatchObject({ twoFactorRequired: true });
    expect(pins.delete).not.toHaveBeenCalled();
  });

  it('finds the PIN row and whether anything is locked', async () => {
    await expect(service.find(3)).resolves.toBe(row);
    await expect(service.hasLockedContent(3)).resolves.toBe(false);
  });
});
