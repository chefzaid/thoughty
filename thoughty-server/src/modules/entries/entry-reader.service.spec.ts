import { NotFoundException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { EntryReaderService } from './entry-reader.service';
import { createQueryBuilder } from './entries-query.test-helpers';

describe('EntryReaderService', () => {
  let read: ReturnType<typeof createQueryBuilder>;
  let shown: ReturnType<typeof createQueryBuilder>;
  let entrySearch: { prepare: jest.Mock };
  let findOne: jest.Mock;
  let service: EntryReaderService;

  const stored = {
    id: 12,
    userId: 4,
    diaryId: 1,
    date: '2024-03-10',
    index: 2,
    content: 'The harbor at dawn',
    format: 'markdown',
    tags: ['walks'],
    visibility: 'private',
    isFavorite: false,
    isArchived: false,
    isPinned: false,
    attachments: [],
    diary: { name: 'Journal', icon: 'book', color: null },
  };

  beforeEach(() => {
    read = createQueryBuilder({
      getQuery: jest.fn(() => 'SELECT read entries'),
      getParameters: jest.fn(() => ({ userId: 4 })),
    });
    shown = createQueryBuilder({
      from: jest.fn(() => shown),
      setParameters: jest.fn(() => shown),
    });
    shown.getRawOne!.mockResolvedValue({ id: '12', previous_id: '7', next_id: null, position: '3', total: '3' });
    entrySearch = { prepare: jest.fn() };
    findOne = jest.fn().mockResolvedValue(stored);
    const entryRepository = {
      createQueryBuilder: jest.fn(() => read),
      findOne,
      manager: { createQueryBuilder: jest.fn(() => shown) },
    };
    service = new EntryReaderService(entryRepository as never, entrySearch as never);
  });

  const selected = (alias: string) => read.addSelect!.mock.calls.find(([, as]) => as === alias)?.[0] as string;

  it("reads the writer's unsealed matches oldest first and gives the entry with its neighbours, place and count", async () => {
    const result = await service.read(4, { tags: 'walks', entryId: 12 });

    expect(result).toMatchObject({ previousId: 7, nextId: null, position: 3, total: 3 });
    expect(result.entry).toMatchObject({ id: 12, content: 'The harbor at dawn', diary_name: 'Journal', attachments: [] });
    expect(read.where).toHaveBeenCalledWith('e.user_id = :userId', { userId: 4 });
    expect(read.andWhere).toHaveBeenCalledWith('e.sealed_until IS NULL');
    expect(read.andWhere).toHaveBeenCalledWith('e.tags @> :tagList', { tagList: ['walks'] });
    const bookOrder = 'ORDER BY e.date ASC, e.time_of_day ASC NULLS FIRST, e.index ASC, e.id ASC';
    expect(selected('previous_id')).toBe(`LAG(e.id) OVER (${bookOrder})`);
    expect(selected('next_id')).toBe(`LEAD(e.id) OVER (${bookOrder})`);
    expect(selected('position')).toBe(`ROW_NUMBER() OVER (${bookOrder})`);
    expect(selected('total')).toBe('COUNT(*) OVER ()');
    expect(shown.from).toHaveBeenCalledWith('(SELECT read entries)', 'read');
    expect(shown.setParameters).toHaveBeenCalledWith({ userId: 4 });
    expect(shown.where).toHaveBeenCalledWith('read.id = :entryId', { entryId: 12 });
    expect(findOne).toHaveBeenCalledWith({ where: { id: 12, userId: 4 }, relations: { diary: true, attachments: true } });
    expect(entrySearch.prepare).not.toHaveBeenCalled();
  });

  it('starts at the oldest entry without one asked for, and keeps no neighbour that is not there', async () => {
    shown.getRawOne!.mockResolvedValue({ id: 12, previous_id: null, next_id: 15, position: 1, total: 2 });

    await expect(service.read(4, {})).resolves.toMatchObject({ previousId: null, nextId: 15, position: 1, total: 2 });
    expect(shown.where).toHaveBeenCalledWith('read.position = 1');
  });

  it('narrows to a day, a month and a search as the journal does', async () => {
    const prepared = { kind: 'literal', text: 'harbor' };
    entrySearch.prepare.mockResolvedValue(prepared);

    await service.read(4, { search: 'harbor', date: '2024-03-10', month: '2024-03' });

    expect(entrySearch.prepare).toHaveBeenCalledWith('harbor');
    expect(read.andWhere).toHaveBeenCalledWith('e.date = :date', { date: '2024-03-10' });
    expect(read.andWhere).toHaveBeenCalledWith('e.date >= :monthStart AND e.date < :nextMonthStart', {
      monthStart: '2024-03-01',
      nextMonthStart: '2024-04-01',
    });
  });

  it('says nothing matches without an entry asked for, and that the entry is not read with one', async () => {
    shown.getRawOne!.mockResolvedValue(undefined);
    await expectApiError(service.read(4, { mood: '1' }), NotFoundException, 'ENTRY_READER_NO_MATCH');
    await expectApiError(service.read(4, { entryId: 9 }), NotFoundException, 'ENTRY_READER_NOT_FOUND');
    expect(findOne).not.toHaveBeenCalled();
  });

  it('treats an entry gone to the recycle bin between the two reads as not read', async () => {
    findOne.mockResolvedValue(null);
    await expectApiError(service.read(4, { entryId: 12 }), NotFoundException, 'ENTRY_READER_NOT_FOUND');
  });
});
