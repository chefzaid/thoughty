import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntriesCommandService } from './entries-command.service';
import { createEntriesCommandTestBed } from './entries-command.test-helpers';

describe('EntriesCommandService', () => {
  let service: EntriesCommandService;
  let entryRepository: Record<string, jest.Mock>;
  let revisionRepository: Record<string, jest.Mock>;

  beforeEach(() => {
    ({ service, entryRepository, revisionRepository } = createEntriesCommandTestBed());
  });

  afterEach(() => {
    jest.clearAllMocks();
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
