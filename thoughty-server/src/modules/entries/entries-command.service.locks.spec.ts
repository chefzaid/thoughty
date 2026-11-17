import { ConflictException } from '@nestjs/common';
import { ContentLockedException } from '@/common/content-lock';
import { asUnlocked } from '@/common/content-lock/content-lock.test-helpers';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { createEntriesCommandTestBed } from './entries-command.test-helpers';

const entry = (fields: Record<string, unknown> = {}) => ({
  id: 3, userId: 1, date: '2024-01-15', index: 1, content: 'Hidden text', format: 'plain', visibility: 'private', tags: ['kept'],
  isLocked: true, diaryLocked: false, sealedUntil: null, ...fields,
});
const edit = { text: 'Edited', tags: [], date: '2024-01-15', visibility: 'private' as const };

describe('EntriesCommandService with locked entries', () => {
  it('refuses editing a locked entry before keeping a revision, unless the request is unlocked', async () => {
    const { service, entryRepository, revisionRepository } = createEntriesCommandTestBed();
    entryRepository.findOne.mockResolvedValue(entry({ isLocked: false, diaryLocked: true }));
    entryRepository.save.mockImplementation(async (value: unknown) => value);

    await expectApiError(service.update(1, 3, edit), ContentLockedException, 'CONTENT_LOCKED');
    expect(revisionRepository.save).not.toHaveBeenCalled();

    await expect(asUnlocked(1, () => service.update(1, 3, edit))).resolves.toMatchObject({ entry: { content: 'Edited' } });
    await expectApiError(asUnlocked(1, () => service.update(1, 3, { ...edit, visibility: 'public' })), ConflictException, 'CONTENT_LOCKED_PRIVATE');
  });

  it('keeps a locked entry private', async () => {
    const { service, entryRepository } = createEntriesCommandTestBed();
    entryRepository.findOne.mockResolvedValue(entry());
    entryRepository.save.mockImplementation(async (value: unknown) => value);

    await expectApiError(service.updateVisibility(1, 3, 'public'), ConflictException, 'CONTENT_LOCKED_PRIVATE');
    await expect(service.updateVisibility(1, 3, 'private')).resolves.toMatchObject({ success: true });
  });

  it('leaves locked entries out of bulk tags, moves and publishing while locked, and out of publishing at all', async () => {
    const { service, entryRepository, diaryRepository } = createEntriesCommandTestBed();
    entryRepository.find.mockResolvedValue([entry({ id: 3 }), entry({ id: 4, isLocked: false })]);
    entryRepository.save.mockImplementation(async (value: unknown) => value);
    diaryRepository.findOne.mockResolvedValue({ id: 9 });

    await expect(service.bulkOperation(1, { ids: [3, 4], action: 'move', diaryId: 9 })).resolves.toMatchObject({ affectedCount: 1 });
    expect(entryRepository.update).toHaveBeenLastCalledWith(expect.objectContaining({ userId: 1 }), { diaryId: 9 });
    await expect(service.bulkOperation(1, { ids: [3, 4], action: 'tags', tags: ['new'] })).resolves.toMatchObject({ affectedCount: 1 });
    await expect(asUnlocked(1, () => service.bulkOperation(1, { ids: [3, 4], action: 'visibility', visibility: 'public' }))).resolves.toMatchObject({ affectedCount: 1 });
    await expect(asUnlocked(1, () => service.bulkOperation(1, { ids: [3, 4], action: 'visibility', visibility: 'private' }))).resolves.toMatchObject({ affectedCount: 2 });

    entryRepository.update.mockClear();
    entryRepository.find.mockResolvedValue([entry({ id: 3 })]);
    await expect(service.bulkOperation(1, { ids: [3], action: 'move', diaryId: 9 })).resolves.toMatchObject({ affectedCount: 0 });
    expect(entryRepository.update).not.toHaveBeenCalled();
  });
});
