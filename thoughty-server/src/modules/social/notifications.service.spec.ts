import { NOTIFICATION_LIST_LIMIT, NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const repository = { query: jest.fn() };
  const service = new NotificationsService(repository as never);
  const sql = (call: number) => repository.query.mock.calls[call][0] as string;

  beforeEach(() => jest.clearAllMocks());

  const row = (overrides: Record<string, unknown>) => ({
    type: 'comment',
    created_at: new Date('2026-11-21T08:30:00Z'),
    unread: true,
    actor_id: 2,
    username: 'maya',
    avatar_url: null,
    entry_id: null,
    entry_date: null,
    entry_index: null,
    entry_title: null,
    comment_id: null,
    comment_excerpt: null,
    ...overrides,
  });

  it('lists the newest notifications of each kind, with what each is about and whether it is new', async () => {
    repository.query
      .mockResolvedValueOnce([
        row({ entry_id: '42', entry_date: '2026-11-20', entry_index: 1, entry_title: 'Walk', comment_id: '7', comment_excerpt: 'Lovely' }),
        row({ type: 'entryLike', unread: false, actor_id: '3', username: 'sam', avatar_url: '/a.png', entry_id: 42, entry_date: '2026-11-20', entry_index: 1 }),
        row({ type: 'commentLike', entry_id: 50, entry_date: '2026-11-19', entry_index: 2, entry_title: 'Theirs', comment_id: 8, comment_excerpt: 'Mine' }),
        row({ type: 'follow', actor_id: 4, username: 'lee' }),
        row({ type: 'followRequest', actor_id: 6, username: 'pia' }),
      ])
      .mockResolvedValueOnce([{ count: '3' }]);

    const result = await service.list(5);

    expect(repository.query).toHaveBeenCalledTimes(2);
    expect(repository.query.mock.calls.every(([, parameters]) => parameters[0] === 5)).toBe(true);
    expect(sql(0)).toContain(`LIMIT ${NOTIFICATION_LIST_LIMIT}`);
    expect(sql(0)).toContain('ORDER BY a.created_at DESC');
    expect(sql(0)).toContain('left(c.content, 140)');
    expect(result.unreadCount).toBe(3);
    expect(result.notifications).toEqual([
      {
        id: 'comment:7',
        type: 'comment',
        createdAt: '2026-11-21T08:30:00.000Z',
        unread: true,
        actor: { id: 2, username: 'maya', avatarUrl: null },
        entry: { id: 42, date: '2026-11-20', index: 1, title: 'Walk' },
        comment: { id: 7, excerpt: 'Lovely' },
      },
      expect.objectContaining({
        id: 'entryLike:42:3',
        unread: false,
        actor: { id: 3, username: 'sam', avatarUrl: '/a.png' },
        entry: { id: 42, date: '2026-11-20', index: 1, title: null },
        comment: null,
      }),
      expect.objectContaining({ id: 'commentLike:8:2', comment: { id: 8, excerpt: 'Mine' } }),
      expect.objectContaining({ id: 'follow:4', entry: null, comment: null }),
      expect.objectContaining({ id: 'followRequest:6', type: 'followRequest', entry: null, comment: null }),
    ]);
  });

  it('reads every kind from where it is kept and leaves out what the reader must not be told about', async () => {
    repository.query.mockResolvedValueOnce([{ count: 0 }]);

    await expect(service.countUnread(5)).resolves.toBe(0);

    const statement = sql(0);
    expect(statement).toContain('SELECT COUNT(*)::int AS count');
    for (const table of ['entry_comments c', 'entry_likes l', 'comment_likes cl', 'user_follows f']) {
      expect(statement).toContain(`FROM ${table}`);
    }
    // A request waiting for the reader's approval is told apart from a follow
    expect(statement).toContain("CASE f.status WHEN 'pending' THEN 'followRequest' ELSE 'follow' END");
    // A comment the writer hid, the reader's own doings, deleted accounts, blocks and mutes
    expect(statement).toContain('c.hidden_at IS NULL');
    expect(statement).toContain('a.actor_id <> $1');
    expect(statement).toContain('u.deleted_at IS NULL');
    expect(statement).toContain('a.actor_id NOT IN (SELECT id FROM hidden)');
    expect(statement).toContain('UNION SELECT muted_id FROM user_mutes WHERE user_id = $1');
    // Only about entries the feed still shows
    expect(statement).toContain("e.visibility = 'public'");
    expect(statement).toContain("e.moderation_status = 'visible'");
    expect(statement).toContain('e.is_archived = false');
    expect(statement).toContain('e.deleted_at IS NULL');
    expect(statement).toContain('e.user_id NOT IN (SELECT id FROM blocked)');
    // New since last opened, or since ever without a row
    expect(statement).toContain("a.created_at > COALESCE(r.read_at, '-infinity'::timestamptz)");
  });

  it('counts nothing when the database answers no row', async () => {
    repository.query.mockResolvedValueOnce([]);

    await expect(service.countUnread(5)).resolves.toBe(0);
  });

  it('marks everything until now as read, never moving the time back', async () => {
    repository.query.mockResolvedValueOnce([]);

    await service.markRead(5);

    expect(repository.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO notification_reads'), [5]);
    expect(sql(0)).toContain('GREATEST(notification_reads.read_at, EXCLUDED.read_at)');
  });
});
