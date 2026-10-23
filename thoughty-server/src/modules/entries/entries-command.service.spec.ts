import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntriesCommandService } from './entries-command.service';
import type { BulkOperationDto } from './dto';

describe('EntriesCommandService', () => {
  let service: EntriesCommandService;
  let entryRepository: Record<string, jest.Mock>;
  let revisionRepository: Record<string, jest.Mock>;
  let diaryRepository: Record<string, jest.Mock>;
  let entryTaggingService: Record<string, jest.Mock>;
  let configService: Record<string, jest.Mock>;

  beforeEach(() => {
    entryRepository = {
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
      update: jest.fn(),
    };

    revisionRepository = {
      findOne: jest.fn(),
      remove: jest.fn(),
      save: jest.fn(),
    };

    diaryRepository = {
      findOne: jest.fn(),
    };

    entryTaggingService = {
      resolveSavedTags: jest.fn().mockResolvedValue([]),
    };

    configService = {
      getConfig: jest.fn().mockResolvedValue({ maxPinnedEntries: '3' }),
    };

    service = new EntriesCommandService(
      entryRepository as never,
      revisionRepository as never,
      diaryRepository as never,
      entryTaggingService as never,
      configService as never,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const invalidBulkOperation = (action: string): BulkOperationDto => {
    return { ids: [1], action } as unknown as BulkOperationDto;
  };

  it('creates an entry using the default diary and AI-suggested tags when capacity remains', async () => {
    entryTaggingService.resolveSavedTags.mockResolvedValue(['work', 'ai']);
    diaryRepository.findOne.mockResolvedValue({ id: 42 });
    entryRepository.count.mockResolvedValue(2);
    entryRepository.save.mockResolvedValue({ id: 7 });

    const result = await service.create(5, {
      text: 'Hello world',
      tags: [' work ', 'work'],
      date: '2024-01-15',
    });

    expect(diaryRepository.findOne).toHaveBeenCalledWith({ where: { userId: 5, isDefault: true } });
    expect(entryTaggingService.resolveSavedTags).toHaveBeenCalledWith(5, 'Hello world', [' work ', 'work']);
    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      userId: 5,
      date: '2024-01-15',
      index: 3,
      tags: ['work', 'ai'],
      content: 'Hello world',
      format: 'plain',
      visibility: 'private',
      diaryId: 42,
    }));
    expect(result).toEqual({ success: true, entryId: 7 });
  });

  it('creates an entry without requesting AI tags when auto-tagging is disabled', async () => {
    entryTaggingService.resolveSavedTags.mockResolvedValue(['focus']);
    diaryRepository.findOne.mockResolvedValue(null);
    entryRepository.count.mockResolvedValue(0);
    entryRepository.save.mockResolvedValue({ id: 9 });

    const result = await service.create(2, {
      text: 'Manual tags only',
      tags: ['focus'],
      format: 'markdown',
      visibility: 'public',
    });

    expect(entryTaggingService.resolveSavedTags).toHaveBeenCalledWith(2, 'Manual tags only', ['focus']);
    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      diaryId: undefined,
      format: 'markdown',
      visibility: 'public',
    }));
    expect(result).toEqual({ success: true, entryId: 9 });
  });

  it('creates an entry in a requested diary the writer owns', async () => {
    diaryRepository.findOne.mockResolvedValue({ id: 12, userId: 4 });
    entryRepository.count.mockResolvedValue(0);
    entryRepository.save.mockResolvedValue({ id: 15 });

    await service.create(4, { text: 'In my travel diary', tags: [], diaryId: 12 });

    expect(diaryRepository.findOne).toHaveBeenCalledWith({ where: { id: 12, userId: 4 } });
    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ diaryId: 12 }));
  });

  it('rejects an entry aimed at a diary the writer does not own', async () => {
    diaryRepository.findOne.mockResolvedValue(null);

    await expect(service.create(4, { text: 'Not my diary', tags: [], diaryId: 99 }))
      .rejects.toThrow(NotFoundException);

    expect(diaryRepository.findOne).toHaveBeenCalledWith({ where: { id: 99, userId: 4 } });
    expect(entryTaggingService.resolveSavedTags).not.toHaveBeenCalled();
    expect(entryRepository.save).not.toHaveBeenCalled();
  });

  it('updates an entry, writes a revision, and reindexes the original day when the date changes', async () => {
    const existingEntry = {
      id: 3,
      userId: 8,
      content: 'Old text',
      tags: ['old'],
      date: '2024-01-10',
      format: 'plain',
      visibility: 'private',
      index: 2,
    };
    const remainingEntries = [
      { id: 10, userId: 8, date: '2024-01-10', index: 4 },
      { id: 11, userId: 8, date: '2024-01-10', index: 7 },
    ];

    entryRepository.findOne.mockResolvedValue(existingEntry);
    entryRepository.count.mockResolvedValue(1);
    revisionRepository.save.mockResolvedValue({ id: 101 });
    entryRepository.save
      .mockResolvedValueOnce({ ...existingEntry, content: 'New text', date: '2024-01-11', index: 2 })
      .mockResolvedValueOnce({ ...remainingEntries[0], index: 1 })
      .mockResolvedValueOnce({ ...remainingEntries[1], index: 2 });
    entryRepository.find.mockResolvedValue(remainingEntries);

    const result = await service.update(8, 3, {
      text: 'New text',
      tags: ['updated'],
      date: '2024-01-11',
      visibility: 'public',
      format: 'markdown',
    });

    expect(revisionRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      entryId: 3,
      userId: 8,
      content: 'Old text',
      tags: ['old'],
      date: '2024-01-10',
      format: 'plain',
      visibility: 'private',
    }));
    expect(entryRepository.find).toHaveBeenCalledWith({
      where: { userId: 8, date: '2024-01-10' },
      order: { index: 'ASC' },
    });
    expect(entryRepository.save).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 10, index: 1 }));
    expect(entryRepository.save).toHaveBeenNthCalledWith(3, expect.objectContaining({ id: 11, index: 2 }));
    expect(result).toEqual({ success: true, entry: expect.objectContaining({ content: 'New text', date: '2024-01-11', index: 2 }) });
  });

  it('numbers a new entry after the day whatever its time, and keeps its title on one line', async () => {
    diaryRepository.findOne.mockResolvedValue({ id: 42 });
    entryRepository.count.mockResolvedValue(2);
    entryRepository.save.mockResolvedValue({ id: 8 });

    await service.create(5, {
      text: 'Early swim',
      tags: ['swim'],
      date: '2024-01-15',
      title: '  Before\nsunrise ',
      timeOfDay: '06:15',
    });

    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      index: 3,
      title: 'Before sunrise',
      timeOfDay: '06:15',
    }));
  });

  it('stores no title or time when they are empty', async () => {
    diaryRepository.findOne.mockResolvedValue({ id: 42 });
    entryRepository.count.mockResolvedValue(0);
    entryRepository.save.mockResolvedValue({ id: 8 });

    await service.create(5, { text: 'Plain', tags: ['a'], title: ' ', timeOfDay: '' });

    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ title: null, timeOfDay: null }));
  });

  it('keeps the title and time in the revision and leaves them alone when an edit omits them', async () => {
    const existingEntry = {
      id: 3,
      userId: 8,
      content: 'Old text',
      title: 'Old title',
      timeOfDay: '09:00',
      tags: ['old'],
      date: '2024-01-10',
      format: 'plain',
      visibility: 'private',
      index: 2,
    };
    entryRepository.findOne.mockResolvedValue({ ...existingEntry });
    entryRepository.save.mockImplementation(async (entry) => entry);

    const kept = await service.update(8, 3, { text: 'Rephrased', tags: ['old'], date: '2024-01-10' });

    expect(revisionRepository.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'Old title', timeOfDay: '09:00' }));
    expect(kept.entry).toMatchObject({ content: 'Rephrased', title: 'Old title', timeOfDay: '09:00', index: 2 });

    entryRepository.findOne.mockResolvedValue({ ...existingEntry });
    const changed = await service.update(8, 3, { text: 'Old text', tags: ['old'], date: '2024-01-10', title: 'New title', timeOfDay: '17:20' });
    expect(changed.entry).toMatchObject({ title: 'New title', timeOfDay: '17:20', index: 2 });

    entryRepository.findOne.mockResolvedValue({ ...existingEntry });
    const cleared = await service.update(8, 3, { text: 'Old text', tags: ['old'], date: '2024-01-10', title: null, timeOfDay: null });
    expect(cleared.entry).toMatchObject({ title: null, timeOfDay: null, index: 2 });
    expect(entryRepository.find).not.toHaveBeenCalled();
  });

  it('stores a recorded mood with cleaned feeling words, and none when left out', async () => {
    diaryRepository.findOne.mockResolvedValue({ id: 42 });
    entryRepository.count.mockResolvedValue(0);
    entryRepository.save.mockResolvedValue({ id: 8 });

    await service.create(5, { text: 'Good day', tags: ['a'], mood: 4, feelings: [' Calm ', 'calm', 'Grateful'] });
    await service.create(5, { text: 'Plain', tags: ['a'] });

    expect(entryRepository.save).toHaveBeenNthCalledWith(1, expect.objectContaining({ mood: 4, feelings: ['calm', 'grateful'] }));
    expect(entryRepository.save).toHaveBeenNthCalledWith(2, expect.objectContaining({ mood: null, feelings: [] }));
  });

  it('keeps the mood in the revision and leaves it alone when an edit omits it', async () => {
    const existingEntry = {
      id: 3,
      userId: 8,
      content: 'Old text',
      mood: 2,
      feelings: ['tired'],
      tags: ['old'],
      date: '2024-01-10',
      format: 'plain',
      visibility: 'private',
      index: 1,
    };
    entryRepository.findOne.mockResolvedValue({ ...existingEntry });
    entryRepository.save.mockImplementation(async (entry) => entry);

    const kept = await service.update(8, 3, { text: 'Rephrased', tags: ['old'], date: '2024-01-10' });

    expect(revisionRepository.save).toHaveBeenCalledWith(expect.objectContaining({ mood: 2, feelings: ['tired'] }));
    expect(kept.entry).toMatchObject({ mood: 2, feelings: ['tired'] });

    entryRepository.findOne.mockResolvedValue({ ...existingEntry });
    const changed = await service.update(8, 3, { text: 'Old text', tags: ['old'], date: '2024-01-10', mood: 5, feelings: ['Relieved'] });
    expect(changed.entry).toMatchObject({ mood: 5, feelings: ['relieved'] });

    entryRepository.findOne.mockResolvedValue({ ...existingEntry });
    const cleared = await service.update(8, 3, { text: 'Old text', tags: ['old'], date: '2024-01-10', mood: null, feelings: [] });
    expect(cleared.entry).toMatchObject({ mood: null, feelings: [] });
  });

  it('throws when updating a missing entry', async () => {
    entryRepository.findOne.mockResolvedValue(null);

    await expect(service.update(3, 99, {
      text: 'Missing',
      tags: [],
      date: '2024-01-11',
    })).rejects.toThrow(NotFoundException);
  });

  it('updates visibility, favorite, archived, and pinned flags for existing entries', async () => {
    const entry = { id: 1, userId: 5, visibility: 'private', isFavorite: false, isArchived: false, isPinned: false };
    entryRepository.findOne
      .mockResolvedValueOnce({ ...entry })
      .mockResolvedValueOnce({ ...entry })
      .mockResolvedValueOnce({ ...entry })
      .mockResolvedValueOnce({ ...entry });
    entryRepository.count.mockResolvedValue(2);
    entryRepository.save
      .mockResolvedValueOnce({ ...entry, visibility: 'public' })
      .mockResolvedValueOnce({ ...entry, isFavorite: true })
      .mockResolvedValueOnce({ ...entry, isArchived: true })
      .mockResolvedValueOnce({ ...entry, isPinned: true });

    await expect(service.updateVisibility(5, 1, 'public')).resolves.toEqual({ success: true, entry: expect.objectContaining({ visibility: 'public' }) });
    await expect(service.toggleFavorite(5, 1, true)).resolves.toEqual({ success: true, entry: expect.objectContaining({ isFavorite: true }) });
    await expect(service.toggleArchived(5, 1, true)).resolves.toEqual({ success: true, entry: expect.objectContaining({ isArchived: true }) });
    await expect(service.togglePinned(5, 1, true)).resolves.toEqual({ success: true, entry: expect.objectContaining({ isPinned: true }) });
    expect(configService.getConfig).toHaveBeenCalledWith(5);
  });

  it('rejects pinning when the configured pinned entry limit is reached', async () => {
    entryRepository.findOne.mockResolvedValue({ id: 1, userId: 5, isPinned: false });
    entryRepository.count.mockResolvedValue(3);
    configService.getConfig.mockResolvedValue({ maxPinnedEntries: '3' });

    await expect(service.togglePinned(5, 1, true)).rejects.toThrow(BadRequestException);

    expect(entryRepository.save).not.toHaveBeenCalled();
  });

  it('moves a deleted entry to the recycle bin and reindexes the rest of its day', async () => {
    entryRepository.findOne.mockResolvedValue({ id: 12, userId: 2, date: '2024-01-20' });
    entryRepository.softDelete.mockResolvedValue({ affected: 1 });
    entryRepository.find.mockResolvedValue([
      { id: 20, userId: 2, date: '2024-01-20', index: 3 },
      { id: 21, userId: 2, date: '2024-01-20', index: 9 },
    ]);
    entryRepository.save.mockResolvedValue({});

    const result = await service.delete(2, 12);

    expect(entryRepository.softDelete).toHaveBeenCalledWith({ id: 12, userId: 2 });
    expect(entryRepository.delete).not.toHaveBeenCalled();
    expect(entryRepository.save).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: 20, index: 1 }));
    expect(entryRepository.save).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 21, index: 2 }));
    expect(result).toEqual({ success: true });
  });

  it('moves every entry in scope to the recycle bin, leaving entries already there untouched', async () => {
    const execute = jest.fn().mockResolvedValue({ affected: 4 });
    const qb: Record<string, jest.Mock> = { execute };
    qb.andWhere = jest.fn().mockReturnValue(qb);
    qb.where = jest.fn().mockReturnValue(qb);
    const softDelete = jest.fn().mockReturnValue(qb);
    entryRepository.createQueryBuilder.mockReturnValue({ softDelete, delete: jest.fn() });

    const result = await service.deleteAll(4, 9);

    expect(softDelete).toHaveBeenCalled();
    expect(qb.where).toHaveBeenCalledWith('user_id = :userId', { userId: 4 });
    expect(qb.andWhere).toHaveBeenCalledWith('deleted_at IS NULL');
    expect(qb.andWhere).toHaveBeenCalledWith('diary_id = :diaryId', { diaryId: 9 });
    expect(result).toEqual({ success: true, deletedCount: 4 });
  });

  it('handles all bulk operation variants and validates their required inputs', async () => {
    const entries = [
      { id: 1, userId: 9, date: '2024-01-15', tags: ['alpha'] },
      { id: 2, userId: 9, date: '2024-01-16', tags: ['beta'] },
    ];
    entryRepository.find.mockResolvedValue(entries);
    entryRepository.softDelete.mockResolvedValue({ affected: 2 });
    entryRepository.update.mockResolvedValue({ affected: 2 });
    entryRepository.save.mockResolvedValue({});
    diaryRepository.findOne.mockResolvedValue({ id: 77, userId: 9 });

    await expect(service.bulkOperation(9, { ids: [1, 2], action: 'visibility', visibility: 'public' }))
      .resolves.toEqual({ success: true, affectedCount: 2 });
    expect(entryRepository.update).toHaveBeenCalledWith({ id: expect.anything(), userId: 9 }, { visibility: 'public' });

    await expect(service.bulkOperation(9, { ids: [1, 2], action: 'tags', tags: ['gamma', 'gamma'] }))
      .resolves.toEqual({ success: true, affectedCount: 2 });
    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ tags: ['alpha', 'gamma'] }));

    await expect(service.bulkOperation(9, { ids: [1, 2], action: 'move', diaryId: 77 }))
      .resolves.toEqual({ success: true, affectedCount: 2 });

    await expect(service.bulkOperation(9, { ids: [1, 2], action: 'archive', isArchived: true }))
      .resolves.toEqual({ success: true, affectedCount: 2 });

    await expect(service.bulkOperation(9, { ids: [1, 2], action: 'delete' }))
      .resolves.toEqual({ success: true, affectedCount: 2 });
    expect(entryRepository.softDelete).toHaveBeenCalledWith({ id: expect.anything(), userId: 9 });
    expect(entryRepository.delete).not.toHaveBeenCalled();

    await expect(service.bulkOperation(9, { ids: [1], action: 'visibility' }))
      .rejects.toThrow(BadRequestException);
    await expect(service.bulkOperation(9, { ids: [1], action: 'tags' }))
      .rejects.toThrow(BadRequestException);
    await expect(service.bulkOperation(9, { ids: [1], action: 'move' }))
      .rejects.toThrow(BadRequestException);
    await expect(service.bulkOperation(9, { ids: [1], action: 'archive' }))
      .rejects.toThrow(BadRequestException);
    await expect(service.bulkOperation(9, invalidBulkOperation('unknown')))
      .rejects.toThrow(BadRequestException);
  });

  it('throws when bulk operation does not match any entries', async () => {
    entryRepository.find.mockResolvedValue([]);

    await expect(service.bulkOperation(1, { ids: [1], action: 'delete' })).rejects.toThrow(NotFoundException);
  });

  it('renames tags with validation and deduplication, in the recycle bin too', async () => {
    const entries = [
      { id: 1, tags: ['old', 'keep'], deletedAt: null },
      { id: 2, tags: ['keep', 'old', 'new'], deletedAt: null },
      { id: 3, tags: ['old'], deletedAt: new Date('2024-02-01') },
    ];
    const getMany = jest.fn().mockResolvedValue(entries);
    const andWhere = jest.fn().mockReturnValue({ getMany });
    const where = jest.fn().mockReturnValue({ andWhere });
    const withDeleted = jest.fn().mockReturnValue({ where });
    entryRepository.createQueryBuilder.mockReturnValue({ withDeleted });
    entryRepository.save.mockResolvedValue({});

    await expect(service.renameTag(1, '', 'next')).rejects.toThrow(BadRequestException);
    await expect(service.renameTag(1, 'same', 'same')).rejects.toThrow(BadRequestException);

    const result = await service.renameTag(1, 'old', 'new');

    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: 1, tags: ['new', 'keep'] }));
    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: 2, tags: ['keep', 'new'] }));
    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: 3, tags: ['new'] }));
    expect(result).toEqual({ success: true, affectedCount: 2 });
  });

  it('removes a tag from every matching entry', async () => {
    const entries = [
      { id: 1, tags: ['old', 'keep'] },
      { id: 2, tags: ['old'] },
    ];
    const getMany = jest.fn().mockResolvedValue(entries);
    const andWhere = jest.fn().mockReturnValue({ getMany });
    const where = jest.fn().mockReturnValue({ andWhere });
    const withDeleted = jest.fn().mockReturnValue({ where });
    entryRepository.createQueryBuilder.mockReturnValue({ withDeleted });
    entryRepository.save.mockResolvedValue({});

    await expect(service.deleteTag(1, '  ')).rejects.toThrow(BadRequestException);

    const result = await service.deleteTag(1, 'old');

    expect(where).toHaveBeenCalledWith('e.user_id = :userId', { userId: 1 });
    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: 1, tags: ['keep'] }));
    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: 2, tags: [] }));
    expect(result).toEqual({ success: true, affectedCount: 2 });
  });

  it('throws when renaming a tag with no matching entries', async () => {
    const getMany = jest.fn().mockResolvedValue([]);
    const andWhere = jest.fn().mockReturnValue({ getMany });
    const where = jest.fn().mockReturnValue({ andWhere });
    entryRepository.createQueryBuilder.mockReturnValue({ withDeleted: jest.fn().mockReturnValue({ where }) });

    await expect(service.renameTag(1, 'missing', 'new')).rejects.toThrow(NotFoundException);
  });

  it('reorders entries for a day and validates missing ids', async () => {
    entryRepository.find.mockResolvedValue([
      { id: 1, index: 1 },
      { id: 2, index: 2 },
    ]);
    entryRepository.save.mockResolvedValue({});

    await expect(service.reorderEntries(7, '2024-01-15', [3])).rejects.toThrow(BadRequestException);

    const result = await service.reorderEntries(7, '2024-01-15', [2, 1]);

    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: 2, index: 1 }));
    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: 1, index: 2 }));
    expect(result).toEqual({ success: true });
  });

  it('reorders some of a day\'s entries over the indexes they hold, leaving the others alone', async () => {
    entryRepository.find.mockResolvedValue([
      { id: 1, index: 1, timeOfDay: '08:00' },
      { id: 2, index: 2, timeOfDay: null },
      { id: 3, index: 3, timeOfDay: '12:00' },
      { id: 4, index: 4, timeOfDay: null },
    ]);
    entryRepository.save.mockResolvedValue({});

    await service.reorderEntries(7, '2024-01-15', [4, 2]);

    expect(entryRepository.save).toHaveBeenCalledTimes(2);
    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: 4, index: 2 }));
    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: 2, index: 4 }));
  });

  it('deletes a revision when it exists and throws when it does not', async () => {
    revisionRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 5 });
    revisionRepository.remove.mockResolvedValue({});

    await expect(service.deleteRevision(1, 2, 5)).rejects.toThrow(NotFoundException);
    await expect(service.deleteRevision(1, 2, 5)).resolves.toEqual({ success: true });
    expect(revisionRepository.remove).toHaveBeenCalledWith({ id: 5 });
  });
});
