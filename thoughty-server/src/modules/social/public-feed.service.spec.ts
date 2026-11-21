import { PublicFeedService } from './public-feed.service';

function createQueryBuilder() {
  const qb: Record<string, jest.Mock> = {
    addOrderBy: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    getCount: jest.fn(),
    getMany: jest.fn(),
    innerJoin: jest.fn(() => qb),
    leftJoinAndSelect: jest.fn(() => qb),
    limit: jest.fn(() => qb),
    offset: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    select: jest.fn(() => qb),
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
  const savedEntriesService = { findSavedIds: jest.fn() };
  let service: PublicFeedService;

  beforeEach(() => {
    jest.clearAllMocks();
    for (const method of ['innerJoin', 'select', 'addSelect', 'where', 'andWhere', 'groupBy']) {
      commentQb[method] = jest.fn(() => commentQb);
    }
    commentQb.getRawMany = jest.fn().mockResolvedValue([]);
    followRepository.find.mockResolvedValue([]);
    likesService.summarizeEntryLikes.mockResolvedValue(new Map());
    savedEntriesService.findSavedIds.mockResolvedValue(new Set());
    service = new PublicFeedService(
      repository as never,
      followRepository as never,
      commentRepository as never,
      likesService as never,
      savedEntriesService as never,
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
        title: 'What I learned',
        timeOfDay: '21:15',
        tags: ['growth'],
        content: 'A public reflection ![The pier](attachment:5)',
        format: 'markdown',
        mood: 2,
        feelings: ['lonely'],
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
    savedEntriesService.findSavedIds.mockResolvedValue(new Set([8]));

    await expect(service.getFeed(7, { page: 2, limit: 5 })).resolves.toEqual({
      entries: [
        {
          id: 8,
          date: '2026-08-01',
          index: 1,
          title: 'What I learned',
          timeOfDay: '21:15',
          tags: ['growth'],
          // Attachments stay private: the feed gets the alt text
          content: 'A public reflection The pier',
          format: 'markdown',
          createdAt,
          commentCount: 4,
          likeCount: 6,
          liked: true,
          saved: true,
          author: { id: 3, username: 'writer', avatarUrl: '/avatar.png', isFollowed: true },
        },
      ],
      total: 12,
      page: 2,
      totalPages: 3,
      hasMore: true,
    });
    expect(qb.select).toHaveBeenCalledWith(
      expect.arrayContaining([
        'e.title',
        'e.timeOfDay',
        'e.content',
        'u.id',
        'u.username',
        'u.avatarUrl',
      ]),
    );
    // Recorded moods are private: the feed neither reads nor returns them
    expect(qb.select.mock.calls[0][0]).not.toEqual(expect.arrayContaining(['e.mood']));
    expect(qb.select.mock.calls[0][0]).not.toEqual(expect.arrayContaining(['e.feelings']));
    expect(qb.andWhere).toHaveBeenCalledWith('e.moderation_status = :moderationStatus', {
      moderationStatus: 'visible',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('e.user_id != :userId', { userId: 7 });
    expect(qb.andWhere).toHaveBeenCalledWith('u.deleted_at IS NULL');
    expect(qb.orderBy).toHaveBeenCalledWith('e.createdAt', 'DESC');
    expect(qb.addOrderBy).toHaveBeenCalledWith('e.id', 'DESC');
    expect(qb.offset).toHaveBeenCalledWith(5);
    expect(qb.limit).toHaveBeenCalledWith(5);
    expect(qb.innerJoin).not.toHaveBeenCalled();
    expect(savedEntriesService.findSavedIds).toHaveBeenCalledWith(7, [8]);
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
        content: 'Mine ![as typed](attachment:5)',
        format: 'plain',
        createdAt: new Date(),
        user: { id: 7, username: 'me', avatarUrl: null },
      },
    ]);
    repository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getFeed(7, { scope: 'mine' });

    expect(result.entries[0].author.isFollowed).toBe(false);
    expect(result.entries[0].content).toBe('Mine ![as typed](attachment:5)');
    expect(result.entries[0].commentCount).toBe(0);
    expect(result.entries[0]).toEqual(
      expect.objectContaining({ likeCount: 0, liked: false, saved: false }),
    );
    expect(followRepository.find).not.toHaveBeenCalled();
  });

  it('lists the reader’s saved entries by others, the most recently saved first', async () => {
    const qb = createQueryBuilder();
    qb.getCount.mockResolvedValue(1);
    qb.getMany.mockResolvedValue([
      {
        id: 4,
        date: '2026-08-02',
        index: 1,
        tags: [],
        content: 'Kept for later',
        format: 'plain',
        createdAt: new Date(),
        user: { id: 3, username: 'writer', avatarUrl: null },
      },
    ]);
    repository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getFeed(7, { scope: 'saved' });

    expect(qb.andWhere).toHaveBeenCalledWith('e.user_id != :userId', { userId: 7 });
    expect(qb.innerJoin).toHaveBeenCalledWith(
      'saved_entries',
      's',
      's.entry_id = e.id AND s.user_id = :userId',
      { userId: 7 },
    );
    expect(qb.orderBy).toHaveBeenCalledWith('s.created_at', 'DESC');
    expect(qb.addOrderBy).toHaveBeenCalledWith('e.id', 'DESC');
    expect(result.entries[0].saved).toBe(true);
    expect(savedEntriesService.findSavedIds).not.toHaveBeenCalled();
  });
});
