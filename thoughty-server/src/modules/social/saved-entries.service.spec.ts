import { BadRequestException, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { SavedEntry } from '@/database/entities';
import { SavedEntriesService } from './saved-entries.service';

function createQueryBuilder() {
  const qb: Record<string, jest.Mock> = {};
  for (const method of [
    'andWhere',
    'execute',
    'getOne',
    'innerJoin',
    'insert',
    'into',
    'orIgnore',
    'select',
    'values',
    'where',
  ]) {
    qb[method] = jest.fn(() => qb);
  }
  // An entry missing from the feed is not there at all, rather than one shown as a teaser
  qb.getExists = jest.fn().mockResolvedValue(false);
  return qb;
}

describe('SavedEntriesService', () => {
  const savedEntryRepository = {
    createQueryBuilder: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
  };
  const entryRepository = { createQueryBuilder: jest.fn() };
  let entryQb: Record<string, jest.Mock>;
  let service: SavedEntriesService;

  beforeEach(() => {
    jest.clearAllMocks();
    entryQb = createQueryBuilder();
    entryQb.getOne.mockResolvedValue({ id: 8, userId: 5 });
    entryRepository.createQueryBuilder.mockReturnValue(entryQb);
    service = new SavedEntriesService(savedEntryRepository as never, entryRepository as never);
  });

  it('saves a feed-visible entry by someone else, once', async () => {
    const insertQb = createQueryBuilder();
    savedEntryRepository.createQueryBuilder.mockReturnValue(insertQb);

    await expect(service.setSaved(7, 8, true)).resolves.toEqual({ saved: true });
    expect(insertQb.into).toHaveBeenCalledWith(SavedEntry);
    expect(insertQb.values).toHaveBeenCalledWith({ userId: 7, entryId: 8 });
    expect(insertQb.orIgnore).toHaveBeenCalled();
    expect(insertQb.execute).toHaveBeenCalled();
    expect(entryQb.andWhere).toHaveBeenCalledWith('e.visibility = :visibility', {
      visibility: 'public',
    });
  });

  it('removes a save', async () => {
    await expect(service.setSaved(7, 8, false)).resolves.toEqual({ saved: false });
    expect(savedEntryRepository.delete).toHaveBeenCalledWith({ userId: 7, entryId: 8 });
    expect(savedEntryRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('refuses to save the reader’s own entry', async () => {
    await expect(service.setSaved(5, 8, true)).rejects.toBeInstanceOf(BadRequestException);
    expect(savedEntryRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('answers an entry the feed does not show as missing', async () => {
    entryQb.getOne.mockResolvedValue(null);

    await expect(service.setSaved(7, 8, true)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.setSaved(7, 8, false)).rejects.toBeInstanceOf(NotFoundException);
    expect(savedEntryRepository.delete).not.toHaveBeenCalled();
  });

  it('refuses to save a teaser, and lets a save made before it be taken back', async () => {
    entryQb.getOne.mockResolvedValueOnce(null);
    entryQb.getExists.mockResolvedValueOnce(true);
    await expect(service.setSaved(7, 8, true)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'FOLLOW_APPROVAL_REQUIRED' }),
    });

    entryQb.andWhere.mockClear();
    await expect(service.setSaved(7, 8, false)).resolves.toEqual({ saved: false });
    expect(entryQb.andWhere).not.toHaveBeenCalledWith(expect.stringContaining('followers_by_approval'), expect.anything());
  });

  it('tells which entries the reader saved', async () => {
    savedEntryRepository.find.mockResolvedValue([{ entryId: 3 }]);

    await expect(service.findSavedIds(7, [3, 4])).resolves.toEqual(new Set([3]));
    expect(savedEntryRepository.find).toHaveBeenCalledWith({
      where: { userId: 7, entryId: In([3, 4]) },
      select: { entryId: true },
    });
    await expect(service.findSavedIds(7, [])).resolves.toEqual(new Set());
    expect(savedEntryRepository.find).toHaveBeenCalledTimes(1);
  });
});
