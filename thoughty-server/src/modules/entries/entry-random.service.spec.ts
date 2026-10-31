import { NotFoundException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { EntryRandomService } from './entry-random.service';
import { createQueryBuilder } from './entries-query.test-helpers';

describe('EntryRandomService', () => {
  let listed: ReturnType<typeof createQueryBuilder>;
  let picked: ReturnType<typeof createQueryBuilder>;
  let entrySearch: { prepare: jest.Mock };
  let service: EntryRandomService;

  beforeEach(() => {
    listed = createQueryBuilder({
      getQuery: jest.fn(() => 'SELECT listed entries'),
      getParameters: jest.fn(() => ({ userId: 4 })),
    });
    picked = createQueryBuilder({
      from: jest.fn(() => picked),
      setParameters: jest.fn(() => picked),
    });
    picked.getRawOne!.mockResolvedValue({ id: '12', date: '2024-03-10', index: 2, position: '21' });
    entrySearch = { prepare: jest.fn() };
    const entryRepository = {
      createQueryBuilder: jest.fn(() => listed),
      manager: { createQueryBuilder: jest.fn(() => picked) },
    };
    service = new EntryRandomService(entryRepository as never, entrySearch as never);
  });

  const numbering = () =>
    listed.addSelect!.mock.calls.find(([, alias]) => alias === 'position')?.[0] as string;

  it("picks one of the writer's unsealed matches at random, with the page of the list that shows it", async () => {
    await expect(service.pick(4, { limit: 10, tags: 'walks' })).resolves.toEqual({
      id: 12,
      date: '2024-03-10',
      index: 2,
      page: 3,
    });

    expect(listed.where).toHaveBeenCalledWith('e.user_id = :userId', { userId: 4 });
    expect(listed.andWhere).toHaveBeenCalledWith('e.tags @> :tagList', { tagList: ['walks'] });
    expect(numbering()).toBe(
      'ROW_NUMBER() OVER (ORDER BY e.is_pinned DESC, e.date DESC, e.time_of_day ASC NULLS FIRST, e.index ASC)',
    );
    expect(picked.from).toHaveBeenCalledWith('(SELECT listed entries)', 'listed');
    expect(picked.where).toHaveBeenCalledWith('listed.sealed = false');
    expect(picked.setParameters).toHaveBeenCalledWith({ userId: 4 });
    expect(picked.orderBy).toHaveBeenCalledWith('RANDOM()');
    expect(picked.limit).toHaveBeenCalledWith(1);
    expect(entrySearch.prepare).not.toHaveBeenCalled();
  });

  it('counts pages at the default size of ten when none is given', async () => {
    picked.getRawOne!.mockResolvedValue({ id: 3, date: '2024-01-01', index: 1, position: 10 });
    await expect(service.pick(4, {})).resolves.toMatchObject({ page: 1 });
  });

  it('keeps the entry picked last time for when nothing else matches', async () => {
    await service.pick(4, { excludeId: 7, limit: 5 });

    expect(picked.orderBy).toHaveBeenCalledWith('listed.id = :excludeId', 'ASC');
    expect(picked.setParameter).toHaveBeenCalledWith('excludeId', 7);
    expect(picked.addOrderBy).toHaveBeenCalledWith('RANDOM()');
  });

  it('narrows to the date filter and numbers word-search results by relevance, as the list does', async () => {
    entrySearch.prepare.mockResolvedValue({
      kind: 'text',
      text: 'harbor run',
      matchQuery: "'harbor' & 'run':*",
      exactQuery: "'harbor' & 'run'",
      terms: [],
    });

    await service.pick(4, { search: 'harbor run', date: '2024-03-10' });

    expect(listed.andWhere).toHaveBeenCalledWith('e.date = :date', { date: '2024-03-10' });
    expect(listed.setParameter).toHaveBeenCalledWith('exactQuery', "'harbor' & 'run'");
    expect(numbering()).toBe(
      'ROW_NUMBER() OVER (ORDER BY ts_rank(e.search_vector, CAST(:searchQuery AS tsquery), 1) + ' +
        'ts_rank(e.search_vector, CAST(:exactQuery AS tsquery), 1) DESC, e.date DESC, e.time_of_day ASC NULLS FIRST, e.index ASC)',
    );
  });

  it('numbers word-search results by date when the list is sorted by date', async () => {
    entrySearch.prepare.mockResolvedValue({ kind: 'text', text: 'harbor', matchQuery: "'harbor':*", terms: [] });

    await service.pick(4, { search: 'harbor', sort: 'date' });

    expect(numbering()).toContain('ORDER BY e.is_pinned DESC');
  });

  it('numbers a meaning search by its ranking', async () => {
    await service.pick(4, { ids: '9,3' });

    expect(listed.setParameter).toHaveBeenCalledWith('semanticOrder', [9, 3]);
    expect(numbering()).toBe('ROW_NUMBER() OVER (ORDER BY array_position(CAST(:semanticOrder AS integer[]), e.id) ASC)');
  });

  it('answers 404 with a code when no entry matches', async () => {
    picked.getRawOne!.mockResolvedValue(undefined);

    await expectApiError(service.pick(4, { mood: '1' }), NotFoundException, 'ENTRY_RANDOM_NO_MATCH');
  });
});
