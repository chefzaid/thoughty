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
  NotificationRead,
  SavedEntry,
  Setting,
  TopicFollow,
  User,
  UserBlock,
  UserFollow,
  UserMute,
} from '@/database/entities';
import { FollowApproval1790553600000 } from '@/database/migrations/1790553600000-follow-approval';
import { EntrySearchService } from '@/modules/entries';
import { CommentPolicyService } from './comment-policy.service';
import { CommentsService } from './comments.service';
import { FollowsService } from './follows.service';
import { LeaderboardService } from './leaderboard.service';
import { LikesService } from './likes.service';
import { NotificationsService } from './notifications.service';
import { PublicFeedService } from './public-feed.service';
import { SavedEntriesService } from './saved-entries.service';
import { TopicFollowsService } from './topic-follows.service';
import { WriterControlsService } from './writer-controls.service';

describePostgres('Followers by approval on PostgreSQL', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let comments: CommentsService;
  let likes: LikesService;
  let feed: PublicFeedService;
  let saved: SavedEntriesService;
  let follows: FollowsService;
  let topics: TopicFollowsService;
  let leaderboard: LeaderboardService;
  let notifications: NotificationsService;
  let controls: WriterControlsService;
  const ids = { noor: 0, old: 0, pia: 0, sam: 0 };
  let noorEntry = 0;

  const insert = async (sql: string, parameters: unknown[]): Promise<number> =>
    (await dataSource.query(`${sql} RETURNING id`, parameters))[0].id;
  const code = (promise: Promise<unknown>) =>
    promise.then(
      () => 'allowed',
      (error: { response?: { code?: string } }) => error.response?.code,
    );
  const noorInFeed = async (userId: number, query: Parameters<PublicFeedService['getFeed']>[1] = {}) =>
    (await feed.getFeed(userId, { limit: 20, ...query })).entries.find((entry) => entry.id === noorEntry);
  const status = async (followerId: number) =>
    (
      await dataSource.query('SELECT status FROM user_follows WHERE follower_id = $1 AND followed_id = $2', [
        followerId,
        ids.noor,
      ])
    )[0]?.status as string | undefined;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    for (const name of Object.keys(ids) as (keyof typeof ids)[]) {
      ids[name] = await insert(
        `INSERT INTO users (username, email, auth_provider) VALUES ($1, $2, 'local')`,
        [name, `${name}@example.com`],
      );
    }
    const diary = await insert('INSERT INTO diaries (user_id, name, is_default) VALUES ($1, $2, true)', [
      ids.noor,
      'Thoughts',
    ]);
    noorEntry = await insert(
      `INSERT INTO entries (user_id, diary_id, date, title, content, tags, visibility)
       VALUES ($1, $2, '2024-01-01', 'Letters to my sister', 'A secret only followers read', '{family}', 'public')`,
      [ids.noor, diary],
    );

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
    topics = new TopicFollowsService(dataSource.getRepository(TopicFollow));
    follows = new FollowsService(followRepository, entryRepository, dataSource.getRepository(User), topics);
    leaderboard = new LeaderboardService(entryRepository);
    notifications = new NotificationsService(dataSource.getRepository(NotificationRead));
    controls = new WriterControlsService(
      dataSource,
      dataSource.getRepository(UserMute),
      dataSource.getRepository(UserBlock),
      entryRepository,
      followRepository,
    );

    // A follower from before the switch, a like and a save by sam made while anyone could read
    await follows.follow(ids.old, ids.noor);
    await likes.setEntryLike(ids.sam, noorEntry, true);
    await saved.setSaved(ids.sam, noorEntry, true);
  }, POSTGRES_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await database?.drop();
  });

  it('keeps follows approved through the migration and drops only waiting requests going back', async () => {
    const queryRunner = dataSource.createQueryRunner();
    const migration = new FollowApproval1790553600000();
    await dataSource.query(
      `INSERT INTO user_follows (follower_id, followed_id, status) VALUES ($1, $2, 'pending')`,
      [ids.pia, ids.sam],
    );
    await migration.down(queryRunner);
    await expect(
      dataSource.query('SELECT follower_id FROM user_follows WHERE followed_id = $1', [ids.sam]),
    ).resolves.toEqual([]);
    await expect(
      dataSource.query(`SELECT column_name FROM information_schema.columns WHERE column_name = 'followers_by_approval'`),
    ).resolves.toEqual([]);

    await migration.up(queryRunner);
    await expect(status(ids.old)).resolves.toBe('approved');
    await expect(
      dataSource.query('SELECT followers_by_approval FROM users WHERE id = $1', [ids.noor]),
    ).resolves.toEqual([{ followers_by_approval: false }]);
    await expect(
      dataSource.query(`INSERT INTO user_follows (follower_id, followed_id, status) VALUES ($1, $2, 'maybe')`, [
        ids.pia,
        ids.sam,
      ]),
    ).rejects.toThrow(/chk_user_follows_status/);
    await queryRunner.release();
  });

  it('keeps existing followers approved and turns new follows into requests', async () => {
    await expect(follows.setApproval(ids.noor, true)).resolves.toEqual({ required: true, approved: 0 });
    await expect(follows.follow(ids.pia, ids.noor)).resolves.toEqual({
      userId: ids.noor,
      following: false,
      requested: true,
    });
    await expect(status(ids.old)).resolves.toBe('approved');

    const listed = await follows.list(ids.noor);
    expect(listed).toEqual(
      expect.objectContaining({
        approvalRequired: true,
        followerCount: 1,
        followers: [expect.objectContaining({ id: ids.old })],
        requests: [expect.objectContaining({ id: ids.pia })],
      }),
    );
    expect((await follows.list(ids.pia)).requested).toEqual([expect.objectContaining({ id: ids.noor })]);
    await expect(follows.countFollowers(ids.noor)).resolves.toBe(1);
    expect((await notifications.list(ids.noor)).notifications.map((item) => item.id)).toEqual(
      expect.arrayContaining([`followRequest:${ids.pia}`, `follow:${ids.old}`]),
    );
  });

  it('shows a writer not approved only a teaser, and keeps it out of what would tell its words', async () => {
    expect(await noorInFeed(ids.pia)).toEqual(
      expect.objectContaining({
        locked: true,
        title: 'Letters to my sister',
        content: '',
        tags: [],
        likeCount: 0,
        author: expect.objectContaining({ followRequested: true, approvalRequired: true }),
      }),
    );
    expect(JSON.stringify(await feed.getFeed(ids.pia, {}))).not.toContain('secret');
    await expect(noorInFeed(ids.pia, { tag: 'family' })).resolves.toBeUndefined();
    await expect(noorInFeed(ids.pia, { search: 'secret' })).resolves.toBeUndefined();
    await topics.follow(ids.pia, 'family');
    await expect(noorInFeed(ids.pia, { scope: 'following' })).resolves.toBeUndefined();
    // sam's Saved list keeps it, as a teaser
    expect(await noorInFeed(ids.sam, { scope: 'saved' })).toEqual(expect.objectContaining({ locked: true, saved: true }));
    expect(await noorInFeed(ids.old)).toEqual(expect.objectContaining({ locked: false, content: 'A secret only followers read' }));

    await expect(code(comments.list(ids.pia, noorEntry))).resolves.toBe('FOLLOW_APPROVAL_REQUIRED');
    await expect(code(comments.create(ids.pia, noorEntry, 'Hi'))).resolves.toBe('FOLLOW_APPROVAL_REQUIRED');
    await expect(code(likes.setEntryLike(ids.pia, noorEntry, true))).resolves.toBe('FOLLOW_APPROVAL_REQUIRED');
    await expect(code(saved.setSaved(ids.pia, noorEntry, true))).resolves.toBe('FOLLOW_APPROVAL_REQUIRED');
    // What sam did before the switch can be taken back
    await expect(likes.setEntryLike(ids.sam, noorEntry, false)).resolves.toEqual({ liked: false, likeCount: 0 });
    await expect(saved.setSaved(ids.sam, noorEntry, false)).resolves.toEqual({ saved: false });
    await likes.setEntryLike(ids.old, noorEntry, true);
    const ranks = async (userId: number) =>
      (await leaderboard.getLeaderboard(userId, 'all')).mostLikedEntries.map((entry) => entry.id);
    await expect(ranks(ids.pia)).resolves.toEqual([]);
    await expect(ranks(ids.sam)).resolves.toEqual([]);
  });

  it('counts only approved followers for comments from followers', async () => {
    await dataSource.query(`UPDATE entries SET comment_policy = 'followers' WHERE id = $1`, [noorEntry]);
    await expect(code(comments.create(ids.old, noorEntry, 'From an old friend'))).resolves.toBe('allowed');

    await expect(code(follows.approveFollower(ids.noor, ids.sam))).resolves.toBe('FOLLOW_REQUEST_NOT_FOUND');
    await expect(follows.approveFollower(ids.noor, ids.pia)).resolves.toEqual({
      userId: ids.pia,
      following: true,
      requested: false,
    });
    expect(await noorInFeed(ids.pia)).toEqual(expect.objectContaining({ locked: false, tags: ['family'] }));
    await expect(code(comments.create(ids.pia, noorEntry, 'Thank you'))).resolves.toBe('allowed');
    await expect(noorInFeed(ids.pia, { scope: 'following' })).resolves.toEqual(expect.objectContaining({ id: noorEntry }));
    await dataSource.query('UPDATE entries SET comment_policy = NULL WHERE id = $1', [noorEntry]);
  });

  it('declines and withdraws requests quietly, and lets a block end one', async () => {
    await follows.follow(ids.sam, ids.noor);
    await expect(follows.removeFollower(ids.noor, ids.sam)).resolves.toEqual(
      expect.objectContaining({ following: false, requested: false }),
    );
    await expect(status(ids.sam)).resolves.toBeUndefined();

    await follows.follow(ids.sam, ids.noor);
    await follows.unfollow(ids.sam, ids.noor);
    await expect(status(ids.sam)).resolves.toBeUndefined();

    await follows.follow(ids.sam, ids.noor);
    await controls.setBlocked(ids.noor, ids.sam, true);
    await expect(status(ids.sam)).resolves.toBeUndefined();
    await expect(code(follows.follow(ids.sam, ids.noor))).resolves.toBe('USER_NOT_FOUND');
    await controls.setBlocked(ids.noor, ids.sam, false);
  });

  it('approves every request still waiting when turned off, and deletes requests with an account', async () => {
    await follows.follow(ids.sam, ids.noor);
    await expect(follows.setApproval(ids.noor, false)).resolves.toEqual({ required: false, approved: 1 });
    await expect(status(ids.sam)).resolves.toBe('approved');
    await expect(follows.follow(ids.sam, ids.noor)).resolves.toEqual(expect.objectContaining({ following: true }));

    await follows.setApproval(ids.noor, true);
    await follows.unfollow(ids.sam, ids.noor);
    await follows.follow(ids.sam, ids.noor);
    await expect(status(ids.sam)).resolves.toBe('pending');
    await dataSource.query('DELETE FROM users WHERE id = $1', [ids.sam]);
    await expect(status(ids.sam)).resolves.toBeUndefined();
  });
});
