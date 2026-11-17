import { createHash } from 'node:crypto';
import { LessThan } from 'typeorm';
import { LOCKED_ACCESS } from '@/common/content-lock';
import { CONTENT_UNLOCK_IDLE_MS, ContentUnlockService } from './content-unlock.service';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

describe('ContentUnlockService', () => {
  const now = new Date('2026-11-17T10:00:00Z');
  let unlocks: { insert: jest.Mock; delete: jest.Mock };
  let dataSource: { query: jest.Mock };
  let service: ContentUnlockService;

  beforeEach(() => {
    unlocks = { insert: jest.fn(), delete: jest.fn() };
    dataSource = { query: jest.fn().mockResolvedValue([{ user_id: 3 }]) };
    service = new ContentUnlockService(unlocks as never, dataSource as never);
  });

  it('gives a random token, keeping only its hash, for 15 minutes, and clears the writer’s ended unlocks', async () => {
    const { token, expiresAt } = await service.create(3, now);

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(expiresAt).toEqual(new Date(now.getTime() + CONTENT_UNLOCK_IDLE_MS));
    expect(unlocks.delete).toHaveBeenCalledWith({ userId: 3, expiresAt: LessThan(now) });
    expect(unlocks.insert).toHaveBeenCalledWith({ userId: 3, tokenHash: sha256(token), expiresAt });
    expect((await service.create(3, now)).token).not.toBe(token);
  });

  it('reads a live token’s writer and moves its end on by 15 minutes', async () => {
    const token = 'a'.repeat(64);
    await expect(service.resolve(token, now)).resolves.toEqual({
      unlockedUserId: 3,
      unlockExpiresAt: new Date(now.getTime() + CONTENT_UNLOCK_IDLE_MS),
      unlockTokenHash: sha256(token),
    });
    expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('WHERE token_hash = $1 AND expires_at > $3'), [
      sha256(token),
      new Date(now.getTime() + CONTENT_UNLOCK_IDLE_MS),
      now,
    ]);
  });

  it('unlocks nothing for no token, a malformed one, or one that ended or never was', async () => {
    await expect(service.resolve(undefined, now)).resolves.toBe(LOCKED_ACCESS);
    await expect(service.resolve('not a token', now)).resolves.toBe(LOCKED_ACCESS);
    expect(dataSource.query).not.toHaveBeenCalled();

    dataSource.query.mockResolvedValue([]);
    await expect(service.resolve('b'.repeat(64), now)).resolves.toEqual({ ...LOCKED_ACCESS, unlockTokenHash: sha256('b'.repeat(64)) });
  });

  it('ends one unlock of the writer, or all of them', async () => {
    await service.end(3, null);
    expect(unlocks.delete).not.toHaveBeenCalled();
    await service.end(3, 'hash');
    expect(unlocks.delete).toHaveBeenCalledWith({ userId: 3, tokenHash: 'hash' });
    await service.endAll(3);
    expect(unlocks.delete).toHaveBeenLastCalledWith({ userId: 3 });
  });
});
