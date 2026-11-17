import { ConflictException, NotFoundException } from '@nestjs/common';
import { ContentLockedException } from '@/common/content-lock';
import { asUnlocked } from '@/common/content-lock/content-lock.test-helpers';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { apiError } from '@/common/errors';
import { ContentLocksService } from './content-locks.service';
import { DiaryLockController, EntryLockController } from './content-locks.controller';

describe('ContentLocksService', () => {
  let entries: { findOne: jest.Mock; update: jest.Mock; findOneOrFail: jest.Mock };
  let diaries: { findOne: jest.Mock; update: jest.Mock; findOneOrFail: jest.Mock };
  let pins: { assertPinSet: jest.Mock };
  let service: ContentLocksService;

  beforeEach(() => {
    entries = {
      findOne: jest.fn().mockResolvedValue({ id: 5, userId: 3, isLocked: true, diaryLocked: false }),
      update: jest.fn(),
      findOneOrFail: jest.fn().mockResolvedValue({ id: 5 }),
    };
    diaries = {
      findOne: jest.fn().mockResolvedValue({ id: 2, userId: 3, isLocked: true }),
      update: jest.fn(),
      findOneOrFail: jest.fn().mockResolvedValue({ id: 2, isLocked: false }),
    };
    pins = { assertPinSet: jest.fn() };
    service = new ContentLocksService(entries as never, diaries as never, pins as never);
  });

  it('locks an entry once a PIN is set, and reads it back with its diary and files', async () => {
    await expect(service.setEntryLocked(3, 5, true)).resolves.toEqual({ id: 5 });
    expect(pins.assertPinSet).toHaveBeenCalledWith(3);
    expect(entries.update).toHaveBeenCalledWith({ id: 5, userId: 3 }, { isLocked: true });
    expect(entries.findOneOrFail).toHaveBeenCalledWith({ where: { id: 5, userId: 3 }, relations: { diary: true, attachments: true } });

    pins.assertPinSet.mockRejectedValueOnce(apiError(ConflictException, 'CONTENT_PIN_NOT_SET'));
    await expectApiError(service.setEntryLocked(3, 5, true), ConflictException, 'CONTENT_PIN_NOT_SET');
  });

  it('lifts an entry’s lock only from an unlocked request, and refuses another writer’s entry', async () => {
    await expectApiError(service.setEntryLocked(3, 5, false), ContentLockedException, 'CONTENT_LOCKED');
    await asUnlocked(3, () => service.setEntryLocked(3, 5, false));
    expect(entries.update).toHaveBeenCalledWith({ id: 5, userId: 3 }, { isLocked: false });

    entries.findOne.mockResolvedValue(null);
    await expectApiError(service.setEntryLocked(3, 5, true), NotFoundException, 'ENTRY_NOT_FOUND');
  });

  it('locks a diary private, and lifts its lock only from an unlocked request', async () => {
    await service.setDiaryLocked(3, 2, true);
    expect(diaries.update).toHaveBeenCalledWith({ id: 2, userId: 3 }, { isLocked: true, visibility: 'private' });

    await expectApiError(service.setDiaryLocked(3, 2, false), ContentLockedException, 'CONTENT_LOCKED');
    await expect(asUnlocked(3, () => service.setDiaryLocked(3, 2, false))).resolves.toEqual({ id: 2, isLocked: false });
    expect(diaries.update).toHaveBeenLastCalledWith({ id: 2, userId: 3 }, { isLocked: false });

    // A diary that is not locked needs no unlock to stay unlocked
    diaries.findOne.mockResolvedValue({ id: 2, userId: 3, isLocked: false });
    await service.setDiaryLocked(3, 2, false);
    diaries.findOne.mockResolvedValue(null);
    await expectApiError(service.setDiaryLocked(3, 2, true), NotFoundException, 'DIARY_NOT_FOUND');
  });

  it('answers the routes with the entry as the entries API sends it, and the diary', async () => {
    const locks = { setEntryLocked: jest.fn().mockResolvedValue({ id: 5, userId: 3, isLocked: true, tags: ['x'], content: 'Secret' }), setDiaryLocked: jest.fn().mockResolvedValue({ id: 2 }) };
    const entry = await new EntryLockController(locks as never).setLocked({ userId: 3 } as never, 5, { locked: true });
    expect(entry).toMatchObject({ success: true, entry: { id: 5, content: '', tags: [], withheld: true } });
    await expect(new DiaryLockController(locks as never).setLocked({ userId: 3 } as never, 2, { locked: true })).resolves.toEqual({ id: 2 });
  });
});
