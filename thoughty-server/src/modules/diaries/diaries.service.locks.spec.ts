import { ConflictException } from '@nestjs/common';
import { ContentLockedException } from '@/common/content-lock';
import { asUnlocked } from '@/common/content-lock/content-lock.test-helpers';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { DiariesService } from './diaries.service';

describe('DiariesService with a locked diary', () => {
  const vault = () => ({ id: 2, userId: 1, name: 'Vault', icon: '📓', color: null, visibility: 'private', isDefault: false, isLocked: true });
  let diaries: { findOne: jest.Mock; save: jest.Mock; delete: jest.Mock };
  let transfer: { moveEntriesToDiary: jest.Mock };
  let service: DiariesService;

  beforeEach(() => {
    diaries = {
      findOne: jest.fn(async ({ where }: { where: { isDefault?: boolean } }) => (where.isDefault ? { id: 1, isDefault: true } : vault())),
      save: jest.fn(async (value: unknown) => value),
      delete: jest.fn(),
    };
    transfer = { moveEntriesToDiary: jest.fn() };
    service = new DiariesService(diaries as never, transfer as never);
  });

  it('keeps it private, while its other settings change', async () => {
    await expectApiError(service.update(1, 2, { name: 'Vault', visibility: 'public' }), ConflictException, 'CONTENT_LOCKED_PRIVATE');
    await expect(service.update(1, 2, { name: 'Safe' })).resolves.toMatchObject({ name: 'Safe', visibility: 'private' });
  });

  it('is deleted, moving its entries out of the lock, only from an unlocked request', async () => {
    await expectApiError(service.delete(1, 2), ContentLockedException, 'CONTENT_LOCKED');
    expect(transfer.moveEntriesToDiary).not.toHaveBeenCalled();

    await expect(asUnlocked(1, () => service.delete(1, 2))).resolves.toEqual({ success: true });
    expect(transfer.moveEntriesToDiary).toHaveBeenCalledWith(1, 2, 1);
  });
});
