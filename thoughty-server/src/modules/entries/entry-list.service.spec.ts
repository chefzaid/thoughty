import { NotFoundException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { EntryListService } from './entry-list.service';
import { createQueryBuilder } from './entries-query.test-helpers';
import { formatEntryListCursor, parseEntryListCursor } from './entry-list-cursor';

interface Row {
  id: number;
  list_lead: number;
  list_date: string;
  list_time: string | null;
  list_index: number;
}

const row = (id: number, date: string, lead = 1, time: string | null = null): Row =>
  ({ id, list_lead: lead, list_date: date, list_time: time, list_index: 1 });

/** Which part of the list a query builder reads, told from the conditions added to it. */
const placeOf = (qb: ReturnType<typeof createQueryBuilder>): string => {
  const conditions = qb.andWhere!.mock.calls.map(([condition]) => String(condition));
  if (conditions.some((condition) => condition === 'e.id = :aroundId')) return 'target';
  if (conditions.some((condition) => condition.includes(') >= ('))) return 'from';
  if (conditions.some((condition) => condition.includes(') > ('))) return 'after';
  if (conditions.some((condition) => condition.includes(') < ('))) return 'before';
  return 'start';
};

describe('EntryListService', () => {
  let builders: Array<ReturnType<typeof createQueryBuilder>>;
  let rows: Record<string, Row[]>;
  let counts: Record<string, number>;
  let loaded: Array<Record<string, unknown>>;
  let entrySearch: { prepare: jest.Mock; findMatches: jest.Mock };
  let service: EntryListService;

  beforeEach(() => {
    builders = [];
    rows = {};
    counts = { start: 9, before: 0 };
    loaded = [];
    const entryRepository = {
      createQueryBuilder: jest.fn(() => {
        const qb = createQueryBuilder();
        qb.getRawMany!.mockImplementation(async () => {
          const selected = qb.select!.mock.calls[0]?.[0];
          if (selected === 'DISTINCT UNNEST(e.tags)') return [{ tag: 'work' }, { tag: 'alpha' }];
          const take = qb.limit!.mock.calls[0]?.[0] as number;
          return (rows[placeOf(qb)] ?? []).slice(0, take);
        });
        qb.getCount!.mockImplementation(async () => counts[placeOf(qb)] ?? 0);
        qb.getMany!.mockImplementation(async () => loaded);
        builders.push(qb);
        return qb;
      }),
    };
    entrySearch = { prepare: jest.fn(), findMatches: jest.fn().mockResolvedValue(new Map([[3, ['Work']]])) };
    service = new EntryListService(entryRepository as never, entrySearch as never);
  });

  const entity = (id: number) => ({ id, date: '2024-01-15', index: 1, tags: [], content: `Entry ${id}`, attachments: [] });

  it('reads the first batch with the filters, pinned entries first, and a cursor to the next one', async () => {
    rows.start = [row(3, '2024-01-15', 0), row(2, '2024-01-14', 1, '08:30'), row(1, '2024-01-13')];
    loaded = [entity(2), entity(3)];

    const result = await service.getEntries(4, { tags: 'work', diaryId: 8, date: '2024-01-15', limit: 2 });

    const listedQb = builders.find((qb) => qb.select!.mock.calls[0]?.[0] === 'e.id')!;
    expect(listedQb.where).toHaveBeenCalledWith('e.user_id = :userId', { userId: 4 });
    expect(listedQb.andWhere).toHaveBeenCalledWith('e.tags @> :tagList', { tagList: ['work'] });
    expect(listedQb.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 8 });
    expect(listedQb.andWhere).toHaveBeenCalledWith('e.date = :date', { date: '2024-01-15' });
    expect(listedQb.addSelect).toHaveBeenCalledWith('CAST(CASE WHEN e.is_pinned THEN 0 ELSE 1 END AS double precision)', 'list_lead');
    expect(listedQb.orderBy).toHaveBeenCalledWith(expect.stringContaining("DATE '1970-01-01' - e.date"), 'ASC');
    expect(listedQb.limit).toHaveBeenCalledWith(3);
    // The entries come back in the order their positions were found
    expect(result.entries.map((entry) => entry.id)).toEqual([3, 2]);
    expect(result).toMatchObject({
      total: 9,
      offset: 0,
      prevCursor: null,
      nextCursor: '1_2024-01-14_08:30_1_2',
      allTags: ['alpha', 'work'],
    });
    expect(entrySearch.prepare).not.toHaveBeenCalled();
  });

  it('reads the batch after a cursor, counting the entries before it', async () => {
    rows.after = [row(5, '2024-01-10')];
    counts.before = 4;
    loaded = [entity(5)];

    const result = await service.getEntries(4, { after: '1_2024-01-11__2_6', limit: 2 });

    const afterQb = builders.find((qb) => placeOf(qb) === 'after')!;
    expect(afterQb.andWhere).toHaveBeenCalledWith(expect.stringContaining('> (CAST(:cursorLead AS double precision)'), {
      cursorLead: 1, cursorDate: '2024-01-11', cursorTimed: false, cursorTime: null, cursorIndex: 2, cursorId: 6,
    });
    expect(result).toMatchObject({ offset: 4, nextCursor: null, prevCursor: '1_2024-01-10__1_5' });
  });

  it('reads a batch again from its own first entry, included', async () => {
    rows.from = [row(6, '2024-01-11', 1, null), row(5, '2024-01-10')];
    counts.before = 2;
    loaded = [entity(6), entity(5)];

    const result = await service.getEntries(4, { from: '1_2024-01-11__1_6', limit: 2 });

    expect(builders.find((qb) => placeOf(qb) === 'from')!.andWhere)
      .toHaveBeenCalledWith(expect.stringContaining(') >= (CAST(:cursorLead'), expect.objectContaining({ cursorId: 6 }));
    expect(result.entries.map((entry) => entry.id)).toEqual([6, 5]);
    expect(result).toMatchObject({ offset: 2, prevCursor: '1_2024-01-11__1_6', nextCursor: null });
  });

  it('reads the batch before a cursor nearest first and shows it in list order', async () => {
    rows.before = [row(8, '2024-01-12'), row(9, '2024-01-13')];
    counts.before = 0;
    loaded = [entity(9), entity(8)];

    const result = await service.getEntries(4, { before: '1_2024-01-11__1_7', limit: 2 });

    expect(builders.find((qb) => placeOf(qb) === 'before' && qb.limit!.mock.calls.length > 0)!.orderBy)
      .toHaveBeenCalledWith(expect.any(String), 'DESC');
    expect(result.entries.map((entry) => entry.id)).toEqual([9, 8]);
    expect(result).toMatchObject({ offset: 0, prevCursor: null, nextCursor: '1_2024-01-12__1_8' });
  });

  it('opens a window around an entry, half before it and the rest from it', async () => {
    rows.target = [row(5, '2024-01-10')];
    rows.before = [row(6, '2024-01-11'), row(7, '2024-01-12'), row(8, '2024-01-13')];
    rows.from = [row(5, '2024-01-10'), row(4, '2024-01-09'), row(3, '2024-01-08')];
    counts.before = 3;
    loaded = [6, 7, 5, 4].map(entity);

    const result = await service.getEntries(4, { around: 5, limit: 4 });

    expect(result.entries.map((entry) => entry.id)).toEqual([7, 6, 5, 4]);
    expect(result).toMatchObject({ offset: 3, nextCursor: '1_2024-01-09__1_4', prevCursor: '1_2024-01-12__1_7' });
  });

  it('answers 404 when the filters leave out the entry to open at', async () => {
    await expectApiError(service.getEntries(4, { around: 5, favorites: true }), NotFoundException, 'ENTRY_NOT_FOUND');
  });

  it('orders a word search by relevance, with its matches, and by date when asked', async () => {
    entrySearch.prepare.mockResolvedValue({
      kind: 'text', text: 'work', matchQuery: "'work':*", exactQuery: "'work'", terms: [{ text: 'work', prefix: true }],
    });
    rows.start = [row(3, '2024-01-15', -0.06)];
    loaded = [entity(3)];

    const result = await service.getEntries(4, { search: 'work' });

    const listedQb = builders.find((qb) => qb.select!.mock.calls[0]?.[0] === 'e.id')!;
    expect(listedQb.addSelect).toHaveBeenCalledWith(
      'CAST(-(ts_rank(e.search_vector, CAST(:searchQuery AS tsquery), 1) + ts_rank(e.search_vector, CAST(:exactQuery AS tsquery), 1)) AS double precision)',
      'list_lead',
    );
    expect(entrySearch.findMatches).toHaveBeenCalledWith(4, [3], [{ text: 'work', prefix: true }]);
    expect(result.entries[0]).toMatchObject({ id: 3, search_matches: ['Work'] });

    builders.length = 0;
    await service.getEntries(4, { search: 'work', sort: 'date' });
    expect(builders.find((qb) => qb.select!.mock.calls[0]?.[0] === 'e.id')!.addSelect)
      .toHaveBeenCalledWith('CAST(CASE WHEN e.is_pinned THEN 0 ELSE 1 END AS double precision)', 'list_lead');
  });

  it('orders a meaning search by its IDs and a literal search by date, without matches', async () => {
    await service.getEntries(4, { ids: '8,3,8' });
    const semanticQb = builders.find((qb) => qb.select!.mock.calls[0]?.[0] === 'e.id')!;
    expect(semanticQb.setParameter).toHaveBeenCalledWith('semanticOrder', [8, 3]);
    expect(semanticQb.addSelect).toHaveBeenCalledWith('CAST(array_position(CAST(:semanticOrder AS integer[]), e.id) AS double precision)', 'list_lead');

    entrySearch.prepare.mockResolvedValue({ kind: 'literal', text: '100%' });
    rows.start = [row(9, '2024-01-15')];
    loaded = [entity(9)];
    const literal = await service.getEntries(4, { search: '100%' });
    expect(entrySearch.findMatches).not.toHaveBeenCalled();
    expect(literal.entries[0]).not.toHaveProperty('search_matches');
  });

  it('reads nothing more for an empty list', async () => {
    counts.start = 0;

    await expect(service.getEntries(4, {})).resolves.toEqual({
      entries: [], total: 0, offset: 0, nextCursor: null, prevCursor: null, allTags: ['alpha', 'work'],
    });
    expect(builders.some((qb) => qb.getMany!.mock.calls.length > 0)).toBe(false);
  });
});

describe('entry list cursors', () => {
  it.each([
    { lead: 0, date: '2024-01-15', timeOfDay: null, index: 2, id: 7 },
    { lead: -0.060792699456214905, date: '1969-07-20', timeOfDay: '08:30', index: 1, id: 42 },
    { lead: -1e-21, date: '2024-01-15', timeOfDay: null, index: 3, id: 9 },
  ])('reads back the position it wrote: %p', (position) => {
    expect(parseEntryListCursor(formatEntryListCursor(position))).toEqual(position);
  });

  it('refuses a cursor of another shape', () => {
    expect(() => parseEntryListCursor('2024-01-15_1_7')).toThrow('Invalid entry list cursor');
  });
});
