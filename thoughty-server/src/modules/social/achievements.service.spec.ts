import { AchievementsService, BADGES } from './achievements.service';

function createQueryBuilder(result: { count?: number; raw?: unknown } = {}) {
  const qb: Record<string, jest.Mock> = {};
  for (const method of ['andWhere', 'innerJoin', 'select', 'where']) {
    qb[method] = jest.fn(() => qb);
  }
  qb.getCount = jest.fn().mockResolvedValue(result.count ?? 0);
  qb.getRawOne = jest.fn().mockResolvedValue(result.raw);
  return qb;
}

describe('AchievementsService', () => {
  const entryRepository = { createQueryBuilder: jest.fn(), count: jest.fn(), query: jest.fn() };
  const commentRepository = { count: jest.fn() };
  const followsService = { countFollowers: jest.fn() };
  let service: AchievementsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AchievementsService(
      entryRepository as never,
      commentRepository as never,
      followsService as never,
    );
  });

  it('derives stats, karma, and badge progress from the user’s own data', async () => {
    // Query builders are created in order: public entries, entry likes, comment likes, comments received.
    const publicEntries = createQueryBuilder({ count: 30 });
    const commentLikes = createQueryBuilder({ raw: { count: '2' } });
    const entryLikes = createQueryBuilder({ raw: { count: '9' } });
    const commentsReceived = createQueryBuilder({ raw: { count: 4 } });
    entryRepository.createQueryBuilder
      .mockReturnValueOnce(publicEntries)
      .mockReturnValueOnce(entryLikes)
      .mockReturnValueOnce(commentLikes)
      .mockReturnValueOnce(commentsReceived);
    entryRepository.count.mockResolvedValue(120);
    entryRepository.query.mockResolvedValue([{ streak: '8' }]);
    commentRepository.count.mockResolvedValue(3);
    followsService.countFollowers.mockResolvedValue(5);

    const result = await service.getAchievements(7);

    expect(result.stats).toEqual({
      publicEntries: 30,
      totalEntries: 120,
      longestStreak: 8,
      likesReceived: 11,
      commentsReceived: 4,
      commentsWritten: 3,
      followers: 5,
    });
    expect(result.karma).toBe(20);
    expect(result.badges).toHaveLength(BADGES.length);
    expect(result.badges.filter((badge) => badge.earned).map((badge) => badge.id)).toEqual([
      'first-public-entry',
      'storyteller',
      'hundred-entries',
      'week-streak',
      'well-liked',
    ]);
    expect(result.badges.find((badge) => badge.id === 'month-streak')).toEqual({
      id: 'month-streak',
      metric: 'longestStreak',
      threshold: 30,
      progress: 8,
      earned: false,
    });
    expect(result.badges.find((badge) => badge.id === 'storyteller')?.progress).toBe(25);

    expect(publicEntries.where).toHaveBeenCalledWith('e.user_id = :userId', { userId: 7 });
    expect(publicEntries.andWhere).toHaveBeenCalledWith('u.deleted_at IS NULL');
    expect(entryLikes.innerJoin).toHaveBeenCalledWith(
      'entry_likes',
      'x',
      'x.entry_id = e.id AND x.user_id <> e.user_id',
    );
    expect(commentsReceived.innerJoin).toHaveBeenCalledWith(
      'entry_comments',
      'x',
      'x.entry_id = e.id AND x.user_id <> e.user_id',
    );
    expect(commentLikes.innerJoin).toHaveBeenCalledWith(
      'entry_comments',
      'c',
      'c.entry_id = e.id AND c.user_id = :userId',
      { userId: 7 },
    );
    expect(entryRepository.count).toHaveBeenCalledWith({ where: { userId: 7 } });
    expect(entryRepository.query).toHaveBeenCalledWith(
      expect.stringContaining('ROW_NUMBER()'),
      [7],
    );
    expect(followsService.countFollowers).toHaveBeenCalledWith(7);
  });

  it('reports zeros for a new account', async () => {
    entryRepository.createQueryBuilder.mockImplementation(() => createQueryBuilder());
    entryRepository.count.mockResolvedValue(0);
    entryRepository.query.mockResolvedValue([{ streak: null }]);
    commentRepository.count.mockResolvedValue(0);
    followsService.countFollowers.mockResolvedValue(0);

    const result = await service.getAchievements(9);

    expect(result.karma).toBe(0);
    expect(Object.values(result.stats).every((value) => value === 0)).toBe(true);
    expect(result.badges.some((badge) => badge.earned)).toBe(false);
  });
});
