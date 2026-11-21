import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import {
  CommentLike,
  Entry,
  EntryComment,
  EntryLike,
  SavedEntry,
  Setting,
  UserFollow,
} from '@/database/entities';
import { EntrySearchService } from '@/modules/entries';
import { CommentControlsService } from './comment-controls.service';
import { CommentPolicyService } from './comment-policy.service';
import { CommentsService } from './comments.service';
import { LikesService } from './likes.service';
import { PublicFeedService } from './public-feed.service';
import { SavedEntriesService } from './saved-entries.service';

describePostgres('Comment controls on PostgreSQL', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let comments: CommentsService;
  let controls: CommentControlsService;
  let feed: PublicFeedService;
  let writer = 0;
  let follower = 0;
  let stranger = 0;
  let entryId = 0;

  const insert = async (sql: string, parameters: unknown[]): Promise<number> =>
    (await dataSource.query(`${sql} RETURNING id`, parameters))[0].id;
  const code = (promise: Promise<unknown>) =>
    promise.then(
      () => 'allowed',
      (error: { response?: { code?: string } }) => error.response?.code,
    );

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    const user = (name: string) =>
      insert(`INSERT INTO users (username, email, auth_provider) VALUES ($1, $2, 'local')`, [
        name,
        `${name}@example.com`,
      ]);
    [writer, follower, stranger] = [
      await user('writer'),
      await user('follower'),
      await user('stranger'),
    ];
    const diary = await insert(
      'INSERT INTO diaries (user_id, name, is_default) VALUES ($1, $2, true)',
      [writer, 'Thoughts'],
    );
    entryId = await insert(
      `INSERT INTO entries (user_id, diary_id, date, content, visibility) VALUES ($1, $2, '2024-01-01', 'Out loud', 'public')`,
      [writer, diary],
    );
    await dataSource.query('INSERT INTO user_follows (follower_id, followed_id) VALUES ($1, $2)', [
      follower,
      writer,
    ]);

    const entries = dataSource.getRepository(Entry);
    const commentRepository = dataSource.getRepository(EntryComment);
    const likes = new LikesService(
      dataSource.getRepository(EntryLike),
      dataSource.getRepository(CommentLike),
      commentRepository,
      entries,
    );
    const policies = new CommentPolicyService(
      dataSource.getRepository(Setting),
      dataSource.getRepository(UserFollow),
    );
    comments = new CommentsService(commentRepository, entries, likes, policies);
    controls = new CommentControlsService(dataSource, commentRepository, entries, likes);
    feed = new PublicFeedService(
      entries,
      dataSource.getRepository(UserFollow),
      commentRepository,
      likes,
      new SavedEntriesService(dataSource.getRepository(SavedEntry), entries),
      new EntrySearchService(entries),
    );
  }, POSTGRES_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await database?.drop();
  });

  it('follows the writer’s default until the entry has its own choice', async () => {
    await dataSource.query(
      `INSERT INTO settings (user_id, key, value) VALUES ($1, 'defaultCommentPolicy', 'followers')`,
      [writer],
    );

    expect(await code(comments.create(stranger, entryId, 'Hi'))).toBe('COMMENTS_FOLLOWERS_ONLY');
    expect(await code(comments.create(follower, entryId, 'First'))).toBe('allowed');
    expect(await code(comments.create(writer, entryId, 'Thanks'))).toBe('allowed');
    expect(await comments.list(stranger, entryId)).toEqual(
      expect.objectContaining({
        commentPolicy: 'followers',
        canComment: false,
        canModerate: false,
      }),
    );

    await controls.setPolicy(writer, entryId, 'closed');
    expect(await code(comments.create(follower, entryId, 'More'))).toBe('COMMENTS_CLOSED');
    expect(await code(comments.create(writer, entryId, 'More'))).toBe('COMMENTS_CLOSED');
    // Closing keeps what is already there readable
    expect((await comments.list(stranger, entryId)).total).toBe(2);

    await controls.setPolicy(writer, entryId, 'everyone');
    expect(await code(comments.create(stranger, entryId, 'Hello'))).toBe('allowed');
    await expect(
      dataSource.query('UPDATE entries SET comment_policy = $1 WHERE id = $2', [
        'friends',
        entryId,
      ]),
    ).rejects.toThrow(/chk_entries_comment_policy/);
  });

  it('shows a hidden comment only to the writer and its own writer, and pins one comment on top', async () => {
    const listed = await comments.list(writer, entryId);
    const [first, , hello] = listed.comments;
    await controls.setHidden(writer, entryId, hello.id, true);

    const contents = async (userId: number) =>
      (await comments.list(userId, entryId)).comments.map((c) => c.content);
    expect(await contents(stranger)).toEqual(['First', 'Thanks', 'Hello']);
    expect(await contents(follower)).toEqual(['First', 'Thanks']);
    expect((await comments.list(follower, entryId)).total).toBe(2);
    const counts = async (userId: number) =>
      (await feed.getFeed(userId, { limit: 20 })).entries.find((entry) => entry.id === entryId)
        ?.commentCount;
    expect(await counts(follower)).toBe(2);
    expect(await counts(stranger)).toBe(3);

    expect(await code(controls.setPinned(writer, entryId, hello.id, true))).toBe(
      'COMMENT_PIN_HIDDEN',
    );
    await controls.setPinned(writer, entryId, hello.id, false);
    await controls.setHidden(writer, entryId, hello.id, false);
    await controls.setPinned(writer, entryId, hello.id, true);
    expect(await contents(follower)).toEqual(['Hello', 'First', 'Thanks']);

    // Pinning another takes the first off the top, even when both are asked at once
    await Promise.all([
      controls.setPinned(writer, entryId, first.id, true),
      controls.setPinned(writer, entryId, hello.id, true),
    ]);
    const pinned = await dataSource.query(
      'SELECT id FROM entry_comments WHERE entry_id = $1 AND pinned_at IS NOT NULL',
      [entryId],
    );
    expect(pinned).toHaveLength(1);

    // Hiding the pinned comment takes it off the top
    await controls.setHidden(writer, entryId, pinned[0].id, true);
    expect((await comments.list(writer, entryId)).comments.filter((c) => c.pinned)).toEqual([]);
    expect(await code(controls.setHidden(follower, entryId, first.id, true))).toBe(
      'ENTRY_NOT_FOUND',
    );
  });
});
