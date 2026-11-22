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
  TopicFollow,
  UserBlock,
  UserFollow,
  UserMute,
} from '@/database/entities';
import { EntrySearchService } from '@/modules/entries';
import { CommentPolicyService } from './comment-policy.service';
import { CommentsService } from './comments.service';
import { FollowsService } from './follows.service';
import { LeaderboardService } from './leaderboard.service';
import { LikesService } from './likes.service';
import { PublicFeedService } from './public-feed.service';
import { SavedEntriesService } from './saved-entries.service';
import { TopicFollowsService } from './topic-follows.service';
import { WriterControlsService } from './writer-controls.service';

describePostgres('Muting and blocking writers on PostgreSQL', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let comments: CommentsService;
  let likes: LikesService;
  let feed: PublicFeedService;
  let saved: SavedEntriesService;
  let follows: FollowsService;
  let leaderboard: LeaderboardService;
  let controls: WriterControlsService;
  const ids = { alice: 0, bob: 0, carol: 0, quiet: 0 };
  const entries = { alice: 0, bob: 0, carol: 0 };

  const insert = async (sql: string, parameters: unknown[]): Promise<number> =>
    (await dataSource.query(`${sql} RETURNING id`, parameters))[0].id;
  const code = (promise: Promise<unknown>) =>
    promise.then(
      () => 'allowed',
      (error: { response?: { code?: string } }) => error.response?.code,
    );
  const feedIds = async (
    userId: number,
    scope: 'community' | 'following' | 'saved' = 'community',
  ) => (await feed.getFeed(userId, { scope, limit: 20 })).entries.map((entry) => entry.id);
  const commentsBy = async (userId: number, entryId: number) =>
    (await comments.list(userId, entryId)).comments.map((comment) => comment.author.username);

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    for (const name of Object.keys(ids) as (keyof typeof ids)[]) {
      ids[name] = await insert(
        `INSERT INTO users (username, email, auth_provider) VALUES ($1, $2, 'local')`,
        [name, `${name}@example.com`],
      );
    }
    for (const name of Object.keys(entries) as (keyof typeof entries)[]) {
      const diary = await insert(
        'INSERT INTO diaries (user_id, name, is_default) VALUES ($1, $2, true)',
        [ids[name], 'Thoughts'],
      );
      entries[name] = await insert(
        `INSERT INTO entries (user_id, diary_id, date, content, visibility) VALUES ($1, $2, '2024-01-01', $3, 'public')`,
        [ids[name], diary, `Out loud by ${name}`],
      );
    }

    const entryRepository = dataSource.getRepository(Entry);
    const commentRepository = dataSource.getRepository(EntryComment);
    const followRepository = dataSource.getRepository(UserFollow);
    likes = new LikesService(
      dataSource.getRepository(EntryLike),
      dataSource.getRepository(CommentLike),
      commentRepository,
      entryRepository,
    );
    const policies = new CommentPolicyService(dataSource.getRepository(Setting), followRepository);
    comments = new CommentsService(commentRepository, entryRepository, likes, policies);
    saved = new SavedEntriesService(dataSource.getRepository(SavedEntry), entryRepository);
    feed = new PublicFeedService(
      entryRepository,
      followRepository,
      commentRepository,
      likes,
      saved,
      new EntrySearchService(entryRepository),
    );
    follows = new FollowsService(
      followRepository,
      entryRepository,
      new TopicFollowsService(dataSource.getRepository(TopicFollow)),
    );
    leaderboard = new LeaderboardService(entryRepository);
    controls = new WriterControlsService(
      dataSource,
      dataSource.getRepository(UserMute),
      dataSource.getRepository(UserBlock),
      entryRepository,
      followRepository,
    );

    await comments.create(ids.carol, entries.alice, 'A comment by carol');
    await comments.create(ids.alice, entries.carol, 'A comment by alice');
    await follows.follow(ids.bob, ids.alice);
    await follows.follow(ids.alice, ids.bob);
    await saved.setSaved(ids.bob, entries.alice, true);
    await saved.setSaved(ids.alice, entries.bob, true);
    await saved.setSaved(ids.bob, entries.carol, true);
  }, POSTGRES_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await database?.drop();
  });

  it('mutes a writer out of the reader’s stream and comments, keeping the follow and the Saved list', async () => {
    await follows.follow(ids.bob, ids.carol);
    await controls.setMuted(ids.bob, ids.carol, true);
    await controls.setMuted(ids.bob, ids.carol, true);

    expect(await feedIds(ids.bob)).toEqual(expect.not.arrayContaining([entries.carol]));
    expect(await feedIds(ids.bob, 'following')).toEqual([entries.alice]);
    expect(await feedIds(ids.bob, 'saved')).toEqual(expect.arrayContaining([entries.carol]));
    expect(await commentsBy(ids.bob, entries.alice)).toEqual([]);
    expect(await commentsBy(ids.alice, entries.alice)).toEqual(['carol']);
    const aliceEntry = (await feed.getFeed(ids.bob, { limit: 20 })).entries.find(
      (entry) => entry.id === entries.alice,
    );
    expect(aliceEntry?.commentCount).toBe(0);
    expect((await follows.list(ids.carol)).followers.map((user) => user.username)).toEqual(['bob']);

    await controls.setMuted(ids.bob, ids.carol, false);
    expect(await feedIds(ids.bob)).toEqual(expect.arrayContaining([entries.carol]));
    await follows.unfollow(ids.bob, ids.carol);
  });

  it('blocks both ways: no follows, saves, feed, comments, likes or leaderboard between the two', async () => {
    await controls.setBlocked(ids.bob, ids.alice, true);

    expect(await dataSource.query('SELECT * FROM user_follows')).toEqual([]);
    const saves = await dataSource.query('SELECT user_id, entry_id FROM saved_entries');
    expect(saves).toEqual([{ user_id: ids.bob, entry_id: entries.carol }]);
    expect(await feedIds(ids.bob)).toEqual([entries.carol]);
    expect(await feedIds(ids.alice)).toEqual([entries.carol]);
    expect(await feedIds(ids.carol)).toEqual(expect.arrayContaining([entries.alice, entries.bob]));
    expect(await commentsBy(ids.bob, entries.carol)).toEqual([]);
    expect(await commentsBy(ids.carol, entries.carol)).toEqual(['alice']);

    const [aliceComment] = (await comments.list(ids.carol, entries.carol)).comments;
    expect(await code(likes.setCommentLike(ids.bob, entries.carol, aliceComment.id, true))).toBe(
      'COMMENT_NOT_FOUND',
    );
    expect(await code(comments.create(ids.bob, entries.alice, 'Hi'))).toBe('ENTRY_NOT_FOUND');
    expect(await code(comments.list(ids.alice, entries.bob))).toBe('ENTRY_NOT_FOUND');
    expect(await code(likes.setEntryLike(ids.alice, entries.bob, true))).toBe('ENTRY_NOT_FOUND');
    expect(await code(saved.setSaved(ids.alice, entries.bob, true))).toBe('ENTRY_NOT_FOUND');
    expect(await code(follows.follow(ids.alice, ids.bob))).toBe('USER_NOT_FOUND');
    expect(await code(follows.follow(ids.bob, ids.alice))).toBe('USER_NOT_FOUND');

    const authors = async (userId: number) =>
      (await leaderboard.getLeaderboard(userId, 'all')).mostActiveAuthors.map(
        (row) => row.author.username,
      );
    expect(await authors(ids.bob)).toEqual(['bob', 'carol']);
    expect(await authors(ids.carol)).toEqual(['alice', 'bob', 'carol']);
  });

  it('lists muted and blocked writers only to the one who chose, and unblocks without bringing follows back', async () => {
    await controls.setMuted(ids.bob, ids.carol, true);
    expect(await controls.list(ids.bob)).toEqual({
      muted: [expect.objectContaining({ id: ids.carol, username: 'carol' })],
      blocked: [expect.objectContaining({ id: ids.alice, username: 'alice' })],
    });
    expect(await controls.list(ids.alice)).toEqual({ muted: [], blocked: [] });

    await controls.setBlocked(ids.bob, ids.alice, false);
    expect(await feedIds(ids.alice)).toEqual(expect.arrayContaining([entries.bob]));
    expect((await follows.list(ids.alice)).following).toEqual([]);
    expect(await code(follows.follow(ids.alice, ids.bob))).toBe('allowed');
  });

  it('refuses writers the reader cannot come across, and removes a follower quietly', async () => {
    expect(await code(controls.setMuted(ids.bob, ids.quiet, true))).toBe('USER_NOT_FOUND');
    expect(await code(controls.setBlocked(ids.bob, 999_999, true))).toBe('USER_NOT_FOUND');
    await expect(
      dataSource.query('INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $1)', [
        ids.bob,
      ]),
    ).rejects.toThrow(/chk_user_blocks_not_self/);

    await dataSource.query('INSERT INTO user_follows (follower_id, followed_id) VALUES ($1, $2)', [
      ids.quiet,
      ids.bob,
    ]);
    // A follower with nothing in the feed can still be muted by the one they follow
    expect(await code(controls.setMuted(ids.bob, ids.quiet, true))).toBe('allowed');
    await follows.removeFollower(ids.bob, ids.quiet);
    expect((await follows.list(ids.bob)).followers.map((user) => user.username)).toEqual(['alice']);
  });

  it('shows one entry asked for by its id, a muted writer’s or the reader’s own, never across a block', async () => {
    const oneEntry = async (userId: number, entryId: number) =>
      (await feed.getFeed(userId, { entry: entryId })).entries.map((entry) => entry.id);

    // Bob still mutes carol, and her entry is not in his stream, but a link to it opens it
    expect(await feedIds(ids.bob)).toEqual(expect.not.arrayContaining([entries.carol]));
    expect(await oneEntry(ids.bob, entries.carol)).toEqual([entries.carol]);
    expect(await oneEntry(ids.bob, entries.bob)).toEqual([entries.bob]);

    await controls.setBlocked(ids.carol, ids.bob, true);
    expect(await oneEntry(ids.bob, entries.carol)).toEqual([]);
    expect(await oneEntry(ids.carol, entries.bob)).toEqual([]);
    await controls.setBlocked(ids.carol, ids.bob, false);
  });
});
