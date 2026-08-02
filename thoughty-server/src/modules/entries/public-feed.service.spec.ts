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
  let service: PublicFeedService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PublicFeedService(repository as never);
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
          author: { id: 3, username: 'writer', avatarUrl: '/avatar.png' },
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
    expect(qb.orderBy).toHaveBeenCalledWith('e.created_at', 'DESC');
    expect(qb.skip).toHaveBeenCalledWith(5);
    expect(qb.take).toHaveBeenCalledWith(5);
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
});
