import { TopicFollowsService } from './topic-follows.service';

describe('TopicFollowsService', () => {
  const repository = { find: jest.fn(), query: jest.fn() };
  const service = new TopicFollowsService(repository as never);

  beforeEach(() => jest.clearAllMocks());

  it('lists the topics followed by name', async () => {
    repository.find.mockResolvedValue([
      { userId: 1, tag: 'gratitude', createdAt: new Date('2026-09-01T08:30:00Z') },
    ]);

    await expect(service.list(1)).resolves.toEqual([
      { tag: 'gratitude', followedAt: '2026-09-01T08:30:00.000Z' },
    ]);
    expect(repository.find).toHaveBeenCalledWith({ where: { userId: 1 }, order: { tag: 'ASC' } });
  });

  it('follows a topic in lower case, keeping one row per tag', async () => {
    repository.query.mockResolvedValue([{ tag: 'gratitude' }]);

    await expect(service.follow(1, 'Gratitude')).resolves.toEqual({ tag: 'gratitude', following: true });

    const [sql, parameters] = repository.query.mock.calls[0];
    expect(sql).toContain('VALUES ($1, lower($2))');
    expect(sql).toContain('ON CONFLICT (user_id, tag) DO UPDATE SET tag = EXCLUDED.tag');
    expect(sql).toContain('RETURNING tag');
    expect(parameters).toEqual([1, 'Gratitude']);
  });

  it('unfollows a topic whatever its case, followed or not', async () => {
    repository.query.mockResolvedValue([{ tag: 'gratitude' }]);

    await expect(service.unfollow(1, 'GRATITUDE')).resolves.toEqual({ tag: 'gratitude', following: false });

    const [sql, parameters] = repository.query.mock.calls[0];
    expect(sql).toContain('SELECT lower($2::text) AS tag');
    expect(sql).toContain('DELETE FROM topic_follows f USING topic WHERE f.user_id = $1 AND f.tag = topic.tag');
    expect(parameters).toEqual([1, 'GRATITUDE']);
  });
});
