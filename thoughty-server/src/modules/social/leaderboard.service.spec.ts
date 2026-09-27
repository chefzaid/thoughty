import { EXCERPT_LENGTH, LEADERBOARD_SIZE, LeaderboardService } from './leaderboard.service';

function createQueryBuilder(rows: unknown[]) {
  const qb: Record<string, jest.Mock> = {};
  for (const method of [
    'addGroupBy',
    'addOrderBy',
    'addSelect',
    'andWhere',
    'groupBy',
    'innerJoin',
    'limit',
    'orderBy',
    'select',
  ]) {
    qb[method] = jest.fn(() => qb);
  }
  qb.getRawMany = jest.fn().mockResolvedValue(rows);
  return qb;
}

const author = { authorId: '2', username: 'maya', avatarUrl: null };

describe('LeaderboardService', () => {
  const entryRepository = { createQueryBuilder: jest.fn() };
  const now = new Date('2026-09-27T12:00:00Z');
  let service: LeaderboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LeaderboardService(entryRepository as never);
  });

  it('ranks authors and entries within the period from feed-visible content only', async () => {
    const authors = createQueryBuilder([{ ...author, count: '5' }]);
    const liked = createQueryBuilder([
      {
        ...author,
        id: '8',
        date: '2026-09-20',
        content: '## Title\n\n**Bold** words',
        format: 'markdown',
        count: '3',
      },
    ]);
    const commented = createQueryBuilder([
      {
        ...author,
        id: '9',
        date: '2026-09-21',
        content: '# Not a heading',
        format: 'plain',
        count: 2,
      },
    ]);
    entryRepository.createQueryBuilder
      .mockReturnValueOnce(authors)
      .mockReturnValueOnce(liked)
      .mockReturnValueOnce(commented);

    await expect(service.getLeaderboard('week', now)).resolves.toEqual({
      period: 'week',
      mostActiveAuthors: [
        { author: { id: 2, username: 'maya', avatarUrl: null }, publicEntries: 5 },
      ],
      mostLikedEntries: [
        {
          id: 8,
          date: '2026-09-20',
          excerpt: 'Title Bold words',
          author: { id: 2, username: 'maya', avatarUrl: null },
          count: 3,
        },
      ],
      mostCommentedEntries: [
        {
          id: 9,
          date: '2026-09-21',
          excerpt: '# Not a heading',
          author: { id: 2, username: 'maya', avatarUrl: null },
          count: 2,
        },
      ],
    });

    for (const qb of [authors, liked, commented]) {
      expect(qb.andWhere).toHaveBeenCalledWith('e.visibility = :visibility', {
        visibility: 'public',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('u.deleted_at IS NULL');
      expect(qb.andWhere).toHaveBeenCalledWith('e.created_at >= :since', {
        since: new Date('2026-09-20T12:00:00Z'),
      });
      expect(qb.limit).toHaveBeenCalledWith(LEADERBOARD_SIZE);
    }
    expect(liked.innerJoin).toHaveBeenCalledWith(
      'entry_likes',
      'x',
      'x.entry_id = e.id AND x.user_id <> e.user_id',
    );
    expect(commented.innerJoin).toHaveBeenCalledWith(
      'entry_comments',
      'x',
      'x.entry_id = e.id AND x.user_id <> e.user_id',
    );
    expect(liked.innerJoin).toHaveBeenCalledWith(
      'users',
      'xu',
      'xu.id = x.user_id AND xu.deleted_at IS NULL',
    );
  });

  it('covers all time without a date bound and defaults to the last month', async () => {
    const builders = [createQueryBuilder([]), createQueryBuilder([]), createQueryBuilder([])];
    entryRepository.createQueryBuilder.mockImplementation(() => builders.shift());

    const all = await service.getLeaderboard('all', now);
    expect(all.mostActiveAuthors).toEqual([]);
    expect(
      entryRepository.createQueryBuilder.mock.results[0].value.andWhere,
    ).not.toHaveBeenCalledWith('e.created_at >= :since', expect.anything());

    const monthly = [createQueryBuilder([]), createQueryBuilder([]), createQueryBuilder([])];
    builders.push(...monthly);
    await expect(service.getLeaderboard(undefined, now)).resolves.toEqual(
      expect.objectContaining({ period: 'month' }),
    );
    expect(monthly[0].andWhere).toHaveBeenCalledWith('e.created_at >= :since', {
      since: new Date('2026-08-28T12:00:00Z'),
    });
  });

  it('collapses whitespace and bounds excerpts', async () => {
    const long = 'word '.repeat(200);
    entryRepository.createQueryBuilder
      .mockReturnValueOnce(createQueryBuilder([]))
      .mockReturnValueOnce(
        createQueryBuilder([
          { ...author, id: 1, date: '2026-09-20', content: long, format: 'plain', count: 1 },
        ]),
      )
      .mockReturnValueOnce(createQueryBuilder([]));

    const result = await service.getLeaderboard('year', now);

    expect(result.mostLikedEntries[0].excerpt).toHaveLength(EXCERPT_LENGTH);
    expect(result.mostLikedEntries[0].excerpt).not.toMatch(/\s{2}/);
  });
});
