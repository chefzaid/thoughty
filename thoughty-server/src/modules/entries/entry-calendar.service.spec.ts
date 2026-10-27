import { EntryCalendarService } from './entry-calendar.service';
import { createQueryBuilder } from './entries-query.test-helpers';

describe('EntryCalendarService', () => {
  let entryRepository: Record<string, jest.Mock>;
  let entrySearch: Record<string, jest.Mock>;
  let qb: ReturnType<typeof createQueryBuilder>;
  let service: EntryCalendarService;

  beforeEach(() => {
    qb = createQueryBuilder();
    entryRepository = { createQueryBuilder: jest.fn(() => qb) };
    entrySearch = {
      prepare: jest.fn().mockResolvedValue({
        kind: 'text',
        text: 'harbor',
        matchQuery: "'harbor':*",
        terms: [{ text: 'harbor', prefix: true }],
      }),
    };
    service = new EntryCalendarService(entryRepository as never, entrySearch as never);
  });

  it("summarizes the writer's entries of the month in day order", async () => {
    qb.getRawAndEntities.mockResolvedValue({
      entities: [
        { id: 7, diaryId: 2, date: '2026-10-01', index: 1, timeOfDay: null, title: 'Harbor run', mood: 4 },
        { id: 9, diaryId: null, date: '2026-10-01', index: 2, timeOfDay: '21:15', title: null, mood: null },
      ],
      raw: [
        { e_id: 9, content_start: '## Evening\n\nA **quiet** night at home, reading by the window until late.' },
        { e_id: 7, content_start: 'Ran along the harbor.' },
      ],
    });

    const result = await service.getMonth(4, { month: '2026-10' });

    expect(qb.where).toHaveBeenCalledWith('e.user_id = :userId', { userId: 4 });
    expect(qb.andWhere).toHaveBeenCalledWith('e.date >= :monthStart AND e.date < :nextMonthStart', {
      monthStart: '2026-10-01',
      nextMonthStart: '2026-11-01',
    });
    expect(qb.orderBy).toHaveBeenCalledWith('e.date', 'ASC');
    expect(qb.addOrderBy).toHaveBeenCalledWith('e.timeOfDay', 'ASC', 'NULLS FIRST');
    expect(qb.addOrderBy).toHaveBeenCalledWith('e.index', 'ASC');
    expect(qb.setParameter).toHaveBeenCalledWith('snippetSource', 400);
    expect(entrySearch.prepare).not.toHaveBeenCalled();
    expect(result).toEqual({
      month: '2026-10',
      entries: [
        { id: 7, diary_id: 2, date: '2026-10-01', index: 1, time_of_day: null, title: 'Harbor run', snippet: 'Ran along the harbor.', mood: 4 },
        {
          id: 9,
          diary_id: null,
          date: '2026-10-01',
          index: 2,
          time_of_day: '21:15',
          title: null,
          snippet: 'Evening A quiet night at home, reading by the window until late.',
          mood: null,
        },
      ],
    });
  });

  it('ends December at the next new year and cuts long texts into a short snippet', async () => {
    qb.getRawAndEntities.mockResolvedValue({
      entities: [{ id: 3, diaryId: 1, date: '2025-12-31', index: 1, timeOfDay: null, title: null, mood: 2 }],
      raw: [{ e_id: 3, content_start: `${'word '.repeat(40)}end` }],
    });

    const result = await service.getMonth(4, { month: '2025-12' });

    expect(qb.andWhere).toHaveBeenCalledWith(expect.any(String), {
      monthStart: '2025-12-01',
      nextMonthStart: '2026-01-01',
    });
    const snippet = result.entries[0]?.snippet ?? '';
    expect(snippet.length).toBeLessThanOrEqual(101);
    expect(snippet.endsWith('word…')).toBe(true);
  });

  it('applies the search and the journal filters', async () => {
    qb.getRawAndEntities.mockResolvedValue({ entities: [], raw: [] });

    await service.getMonth(4, {
      month: '2026-02',
      search: 'harbor',
      tags: 'running, ,sea',
      visibility: 'public',
      favorites: true,
      archiveStatus: 'archived',
      mood: '4,5,4',
      diaryId: 2,
      ids: '5,6,5',
      eraId: 8,
    });

    expect(entrySearch.prepare).toHaveBeenCalledWith('harbor');
    expect(qb.andWhere).toHaveBeenCalledWith('e.id IN (:...entryIds)', { entryIds: [5, 6] });
    expect(qb.andWhere).toHaveBeenCalledWith(
      '(e.search_vector @@ CAST(:searchQuery AS tsquery) OR e.tags @> :searchTags)',
      { searchQuery: "'harbor':*", searchTags: ['harbor'] },
    );
    expect(qb.andWhere).toHaveBeenCalledWith('e.tags @> :tagList', { tagList: ['running', 'sea'] });
    expect(qb.andWhere).toHaveBeenCalledWith('e.visibility = :visibility', { visibility: 'public' });
    expect(qb.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 2 });
    expect(qb.andWhere).toHaveBeenCalledWith('e.is_favorite = true');
    expect(qb.andWhere).toHaveBeenCalledWith('e.is_archived = true');
    expect(qb.andWhere).toHaveBeenCalledWith('e.mood IN (:...moods)', { moods: [4, 5] });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('FROM life_eras era'), { eraId: 8 });
  });

  it('matches a search PostgreSQL cannot read as words literally, and the other mood and archive filters', async () => {
    entrySearch.prepare.mockResolvedValue({ kind: 'literal', text: '100%' });
    qb.getRawAndEntities.mockResolvedValue({ entities: [], raw: [] });

    await service.getMonth(4, { month: '2026-02', search: '100%', archiveStatus: 'active', mood: 'none' });
    expect(qb.andWhere).toHaveBeenCalledWith(
      '(e.content ILIKE :searchPattern OR e.title ILIKE :searchPattern OR e.tags @> :searchTags)',
      { searchPattern: '%100\\%%', searchTags: ['100%'] },
    );
    expect(qb.andWhere).toHaveBeenCalledWith('e.is_archived = false');
    expect(qb.andWhere).toHaveBeenCalledWith('e.mood IS NULL');

    await service.getMonth(4, { month: '2026-02', mood: 'any', archiveStatus: 'all' });
    expect(qb.andWhere).toHaveBeenCalledWith('e.mood IS NOT NULL');
  });
});
