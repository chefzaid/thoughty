import { PublicFeedService } from './public-feed.service';

function createQueryBuilder() {
  const qb: Record<string, jest.Mock> = {
    addOrderBy: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    getCount: jest.fn(),
    getMany: jest.fn(),
    leftJoinAndSelect: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    select: jest.fn(() => qb),
    skip: jest.fn(() => qb),
    take: jest.fn(() => qb),
    where: jest.fn(() => qb),
  };
  return qb;
}

describe('PublicFeedService', () => {
  const repository = { createQueryBuilder: jest.fn() };
  const followRepository = { find: jest.fn() };
  const commentQb: Record<string, jest.Mock> = {};
  const commentRepository = { createQueryBuilder: jest.fn(() => commentQb) };
  const likesService = { summarizeEntryLikes: jest.fn() };
  let service: PublicFeedService;

  beforeEach(() => {
    jest.clearAllMocks();
    for (const method of ['innerJoin', 'select', 'addSelect', 'where', 'andWhere', 'groupBy']) {
      commentQb[method] = jest.fn(() => commentQb);
    }
    commentQb.getRawMany = jest.fn().mockResolvedValue([]);
    followRepository.find.mockResolvedValue([]);
    likesService.summarizeEntryLikes.mockResolvedValue(new Map());
    service = new PublicFeedService(
      repository as never,
      followRepository as never,
      commentRepository as never,
      likesService as never,
    );
  });

  it('returns a narrow, paginated community feed', async () => {
    const qb = createQueryBuilder();
    const createdAt = new Date('2026-08-01T10:00:00Z');
    qb.getCount.mockResolvedValue(12);
    qb.getMany.mockResolvedValue([
      {
        id: 8,
        date: '2026-08-01',
        index: 1,
        tags: ['growth'],
        content: 'A public reflection',
        format: 'markdown',
        createdAt,
        user: { id: 3, username: 'writer', avatarUrl: '/avatar.png', email: 'private@example.com' },
      },
    ]);
    repository.createQueryBuilder.mockReturnValue(qb);
    followRepository.find.mockResolvedValue([{ followedId: 3 }]);
    commentQb.getRawMany.mockResolvedValue([{ entryId: '8', count: '4' }]);
    likesService.summarizeEntryLikes.mockResolvedValue(
      new Map([[8, { likeCount: 6, liked: true }]]),
    );

    await expect(service.getFeed(7, { page: 2, limit: 5 })).resolves.toEqual({
      entries: [
        {
          id: 8,
          date: '2026-08-01',
          index: 1,
          tags: ['growth'],
          content: 'A public reflection',
          format: 'markdown',
          createdAt,
          commentCount: 4,
          likeCount: 6,
          liked: true,
          author: { id: 3, username: 'writer', avatarUrl: '/avatar.png', isFollowed: true },
        },
      ],
      total: 12,
      page: 2,
      totalPages: 3,
      hasMore: true,
    });
    expect(qb.select).toHaveBeenCalledWith(
      expect.arrayContaining(['e.content', 'u.id', 'u.username', 'u.avatarUrl']),
    );
    expect(qb.andWhere).toHaveBeenCalledWith('e.moderation_status = :moderationStatus', {
      moderationStatus: 'visible',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('e.user_id != :userId', { userId: 7 });
    expect(qb.andWhere).toHaveBeenCalledWith('u.deleted_at IS NULL');
    // A property path, not a column name: TypeORM cannot resolve column names
    // when ordering a joined, paginated query.
    expect(qb.orderBy).toHaveBeenCalledWith('e.createdAt', 'DESC');
    expect(qb.skip).toHaveBeenCalledWith(5);
    expect(qb.take).toHaveBeenCalledWith(5);
    expect(followRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ select: { followedId: true } }),
    );
    expect(commentQb.where).toHaveBeenCalledWith('c.entry_id IN (:...entryIds)', { entryIds: [8] });
    expect(commentQb.andWhere).toHaveBeenCalledWith('u.deleted_at IS NULL');
  });

  it('limits the following scope to followed authors', async () => {
    const qb = createQueryBuilder();
    qb.getCount.mockResolvedValue(0);
    qb.getMany.mockResolvedValue([]);
    repository.createQueryBuilder.mockReturnValue(qb);

    await service.getFeed(7, { scope: 'following' });

    expect(qb.andWhere).toHaveBeenCalledWith(
      'e.user_id IN (SELECT f.followed_id FROM user_follows f WHERE f.follower_id = :userId)',
      { userId: 7 },
    );
    expect(followRepository.find).not.toHaveBeenCalled();
    expect(commentRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('scopes the preview to the authenticated user', async () => {
    const qb = createQueryBuilder();
    qb.getCount.mockResolvedValue(0);
    qb.getMany.mockResolvedValue([]);
    repository.createQueryBuilder.mockReturnValue(qb);

    await expect(service.getFeed(7, { scope: 'mine' })).resolves.toEqual({
      entries: [],
      total: 0,
      page: 1,
      totalPages: 0,
      hasMore: false,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('e.user_id = :userId', { userId: 7 });
  });

  it('never marks the current user as followed', async () => {
    const qb = createQueryBuilder();
    qb.getCount.mockResolvedValue(1);
    qb.getMany.mockResolvedValue([
      {
        id: 1,
        date: '2026-08-01',
        index: 1,
        tags: [],
        content: 'Mine',
        format: 'plain',
        createdAt: new Date(),
        user: { id: 7, username: 'me', avatarUrl: null },
      },
    ]);
    repository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getFeed(7, { scope: 'mine' });

    expect(result.entries[0].author.isFollowed).toBe(false);
    expect(result.entries[0].commentCount).toBe(0);
    expect(result.entries[0]).toEqual(expect.objectContaining({ likeCount: 0, liked: false }));
    expect(followRepository.find).not.toHaveBeenCalled();
  });
});
