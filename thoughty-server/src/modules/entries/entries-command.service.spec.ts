import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntriesCommandService } from './entries-command.service';

describe('EntriesCommandService', () => {
  let service: EntriesCommandService;
  let entryRepository: Record<string, jest.Mock>;
  let revisionRepository: Record<string, jest.Mock>;
  let diaryRepository: Record<string, jest.Mock>;
  let configService: Record<string, jest.Mock>;
  let aiService: Record<string, jest.Mock>;

  beforeEach(() => {
    entryRepository = {
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
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

    configService = {
      getConfig: jest.fn().mockResolvedValue({ autoTagMaxTags: '0' }),
    };

    aiService = {
      autoTagEntry: jest.fn().mockResolvedValue([]),
    };

    service = new EntriesCommandService(
      entryRepository as never,
      revisionRepository as never,
      diaryRepository as never,
      configService as never,
      aiService as never,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates an entry using the default diary and AI-suggested tags when capacity remains', async () => {
    configService.getConfig.mockResolvedValue({ autoTagMaxTags: '3' });
    aiService.autoTagEntry.mockResolvedValue(['ai']);
    diaryRepository.findOne.mockResolvedValue({ id: 42 });
    entryRepository.count.mockResolvedValue(2);
    entryRepository.save.mockResolvedValue({ id: 7 });

    const result = await service.create(5, {
      text: 'Hello world',
      tags: [' work ', 'work'],
      date: '2024-01-15',
    } as never);

    expect(diaryRepository.findOne).toHaveBeenCalledWith({ where: { userId: 5, isDefault: true } });
    expect(aiService.autoTagEntry).toHaveBeenCalledWith(5, 'Hello world', ['work'], 2);
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
    diaryRepository.findOne.mockResolvedValue(null);
    entryRepository.count.mockResolvedValue(0);
    entryRepository.save.mockResolvedValue({ id: 9 });

    const result = await service.create(2, {
      text: 'Manual tags only',
      tags: ['focus'],
      format: 'markdown',
      visibility: 'public',
    } as never);

    expect(aiService.autoTagEntry).not.toHaveBeenCalled();
    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      diaryId: undefined,
      format: 'markdown',
      visibility: 'public',
    }));
    expect(result).toEqual({ success: true, entryId: 9 });
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
    } as never);

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

  it('throws when updating a missing entry', async () => {
    entryRepository.findOne.mockResolvedValue(null);

    await expect(service.update(3, 99, {
      text: 'Missing',
      tags: [],
      date: '2024-01-11',
    } as never)).rejects.toThrow(NotFoundException);
  });

  it('updates visibility, favorite, and archived flags for existing entries', async () => {
    const entry = { id: 1, userId: 5, visibility: 'private', isFavorite: false, isArchived: false };
    entryRepository.findOne
      .mockResolvedValueOnce({ ...entry })
      .mockResolvedValueOnce({ ...entry })
      .mockResolvedValueOnce({ ...entry });
    entryRepository.save
      .mockResolvedValueOnce({ ...entry, visibility: 'public' })
      .mockResolvedValueOnce({ ...entry, isFavorite: true })
      .mockResolvedValueOnce({ ...entry, isArchived: true });

    await expect(service.updateVisibility(5, 1, 'public')).resolves.toEqual({ success: true, entry: expect.objectContaining({ visibility: 'public' }) });
    await expect(service.toggleFavorite(5, 1, true)).resolves.toEqual({ success: true, entry: expect.objectContaining({ isFavorite: true }) });
    await expect(service.toggleArchived(5, 1, true)).resolves.toEqual({ success: true, entry: expect.objectContaining({ isArchived: true }) });
  });

  it('deletes entries and reindexes remaining entries for the same date', async () => {
    entryRepository.findOne.mockResolvedValue({ id: 12, userId: 2, date: '2024-01-20' });
    entryRepository.delete.mockResolvedValue({ affected: 1 });
    entryRepository.find.mockResolvedValue([
      { id: 20, userId: 2, date: '2024-01-20', index: 3 },
      { id: 21, userId: 2, date: '2024-01-20', index: 9 },
    ]);
    entryRepository.save.mockResolvedValue({});

    const result = await service.delete(2, 12);

    expect(entryRepository.delete).toHaveBeenCalledWith({ id: 12, userId: 2 });
    expect(entryRepository.save).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: 20, index: 1 }));
    expect(entryRepository.save).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 21, index: 2 }));
    expect(result).toEqual({ success: true });
  });

  it('deletes all entries with an optional diary filter', async () => {
    const execute = jest.fn().mockResolvedValue({ affected: 4 });
    const andWhere = jest.fn().mockReturnValue({ execute });
    const where = jest.fn().mockReturnValue({ andWhere, execute });
    const del = jest.fn().mockReturnValue({ where });
    entryRepository.createQueryBuilder.mockReturnValue({ delete: del });

    const result = await service.deleteAll(4, 9);

    expect(andWhere).toHaveBeenCalledWith('diary_id = :diaryId', { diaryId: 9 });
    expect(result).toEqual({ success: true, deletedCount: 4 });
  });

  it('handles all bulk operation variants and validates their required inputs', async () => {
    const entries = [
      { id: 1, userId: 9, date: '2024-01-15', tags: ['alpha'] },
      { id: 2, userId: 9, date: '2024-01-16', tags: ['beta'] },
    ];
    entryRepository.find.mockResolvedValue(entries);
    entryRepository.delete.mockResolvedValue({ affected: 2 });
    entryRepository.update.mockResolvedValue({ affected: 2 });
    entryRepository.save.mockResolvedValue({});
    diaryRepository.findOne.mockResolvedValue({ id: 77, userId: 9 });

    await expect(service.bulkOperation(9, { ids: [1, 2], action: 'visibility', visibility: 'public' } as never))
      .resolves.toEqual({ success: true, affectedCount: 2 });
    expect(entryRepository.update).toHaveBeenCalledWith({ id: expect.anything(), userId: 9 }, { visibility: 'public' });

    await expect(service.bulkOperation(9, { ids: [1, 2], action: 'tags', tags: ['gamma', 'gamma'] } as never))
      .resolves.toEqual({ success: true, affectedCount: 2 });
    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ tags: ['alpha', 'gamma'] }));

    await expect(service.bulkOperation(9, { ids: [1, 2], action: 'move', diaryId: 77 } as never))
      .resolves.toEqual({ success: true, affectedCount: 2 });

    await expect(service.bulkOperation(9, { ids: [1, 2], action: 'archive', isArchived: true } as never))
      .resolves.toEqual({ success: true, affectedCount: 2 });

    await expect(service.bulkOperation(9, { ids: [1, 2], action: 'delete' } as never))
      .resolves.toEqual({ success: true, affectedCount: 2 });

    await expect(service.bulkOperation(9, { ids: [1], action: 'visibility' } as never))
      .rejects.toThrow(BadRequestException);
    await expect(service.bulkOperation(9, { ids: [1], action: 'tags' } as never))
      .rejects.toThrow(BadRequestException);
    await expect(service.bulkOperation(9, { ids: [1], action: 'move' } as never))
      .rejects.toThrow(BadRequestException);
    await expect(service.bulkOperation(9, { ids: [1], action: 'archive' } as never))
      .rejects.toThrow(BadRequestException);
    await expect(service.bulkOperation(9, { ids: [1], action: 'unknown' } as never))
      .rejects.toThrow(BadRequestException);
  });

  it('throws when bulk operation does not match any entries', async () => {
    entryRepository.find.mockResolvedValue([]);

    await expect(service.bulkOperation(1, { ids: [1], action: 'delete' } as never)).rejects.toThrow(NotFoundException);
  });

  it('renames tags with validation and deduplication', async () => {
    const entries = [
      { id: 1, tags: ['old', 'keep'] },
      { id: 2, tags: ['keep', 'old', 'new'] },
    ];
    const getMany = jest.fn().mockResolvedValue(entries);
    const andWhere = jest.fn().mockReturnValue({ getMany });
    const where = jest.fn().mockReturnValue({ andWhere });
    entryRepository.createQueryBuilder.mockReturnValue({ where });
    entryRepository.save.mockResolvedValue({});

    await expect(service.renameTag(1, '', 'next')).rejects.toThrow(BadRequestException);
    await expect(service.renameTag(1, 'same', 'same')).rejects.toThrow(BadRequestException);

    const result = await service.renameTag(1, 'old', 'new');

    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: 1, tags: ['new', 'keep'] }));
    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: 2, tags: ['keep', 'new'] }));
    expect(result).toEqual({ success: true, affectedCount: 2 });
  });

  it('throws when renaming a tag with no matching entries', async () => {
    const getMany = jest.fn().mockResolvedValue([]);
    const andWhere = jest.fn().mockReturnValue({ getMany });
    const where = jest.fn().mockReturnValue({ andWhere });
    entryRepository.createQueryBuilder.mockReturnValue({ where });

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

  it('deletes a revision when it exists and throws when it does not', async () => {
    revisionRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 5 });
    revisionRepository.remove.mockResolvedValue({});

    await expect(service.deleteRevision(1, 2, 5)).rejects.toThrow(NotFoundException);
    await expect(service.deleteRevision(1, 2, 5)).resolves.toEqual({ success: true });
    expect(revisionRepository.remove).toHaveBeenCalledWith({ id: 5 });
  });
});