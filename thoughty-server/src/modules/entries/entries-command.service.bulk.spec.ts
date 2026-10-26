import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntriesCommandService } from './entries-command.service';
import type { BulkOperationDto } from './dto';
import { createEntriesCommandTestBed } from './entries-command.test-helpers';

describe('EntriesCommandService', () => {
  let service: EntriesCommandService;
  let entryRepository: Record<string, jest.Mock>;
  let diaryRepository: Record<string, jest.Mock>;
  let configService: Record<string, jest.Mock>;

  beforeEach(() => {
    ({ service, entryRepository, diaryRepository, configService } = createEntriesCommandTestBed());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const invalidBulkOperation = (action: string): BulkOperationDto => {
    return { ids: [1], action } as unknown as BulkOperationDto;
  };

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
});
