import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Entry, EntryComment, EntryLike, CommentLike, SavedEntry, TopicFollow, UserFollow } from '@/database/entities';
import { EntrySearchService } from '@/modules/entries';
import { LikesService } from './likes.service';
import { PublicFeedService } from './public-feed.service';
import { SavedEntriesService } from './saved-entries.service';
import { TopicFollowsService } from './topic-follows.service';

describePostgres('Feed topics and search on PostgreSQL', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let feed: PublicFeedService;
  let topics: TopicFollowsService;
  let reader = 0;
  let author = 0;
  const ids: Record<string, number> = {};

  const insert = async (sql: string, parameters: unknown[]): Promise<number> =>
    (await dataSource.query(`${sql} RETURNING id`, parameters))[0].id;

  const feedIds = async (query: Parameters<PublicFeedService['getFeed']>[1]) =>
    (await feed.getFeed(reader, { limit: 20, ...query })).entries.map((entry) => entry.id);

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    const user = (name: string) =>
      insert(`INSERT INTO users (username, email, auth_provider) VALUES ($1, $2, 'local')`, [name, `${name}@example.com`]);
    [reader, author] = [await user('reader'), await user('author')];
    const diary = (owner: number) =>
      insert('INSERT INTO diaries (user_id, name, is_default) VALUES ($1, $2, true)', [owner, 'Thoughts']);
    const [authorDiary, readerDiary] = [await diary(author), await diary(reader)];
    const entry = (owner: number, diaryId: number, content: string, tags: string[], visibility = 'public', mood: number | null = null) =>
      insert(
        'INSERT INTO entries (user_id, diary_id, date, content, tags, visibility, mood) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [owner, diaryId, '2024-01-01', content, tags, visibility, mood],
      );
    ids.thanks = await entry(author, authorDiary, 'Thankful for the walk by the river', ['Gratitude']);
    ids.lower = await entry(author, authorDiary, 'A quiet morning', ['gratitude', 'morning']);
    ids.other = await entry(author, authorDiary, 'Rain all day', ['weather'], 'public', 1);
    ids.hidden = await entry(author, authorDiary, 'Grateful in private by the river', ['gratitude'], 'private');
    ids.mine = await entry(reader, readerDiary, 'My own gratitude by the river', ['gratitude']);

    const entries = dataSource.getRepository(Entry);
    const comments = dataSource.getRepository(EntryComment);
    const likes = new LikesService(dataSource.getRepository(EntryLike), dataSource.getRepository(CommentLike), comments, entries);
    feed = new PublicFeedService(
      entries,
      dataSource.getRepository(UserFollow),
      comments,
      likes,
      new SavedEntriesService(dataSource.getRepository(SavedEntry), entries),
      new EntrySearchService(entries),
    );
    topics = new TopicFollowsService(dataSource.getRepository(TopicFollow));
  }, POSTGRES_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await database?.drop();
  });

  it('opens the public entries carrying a tag, ignoring case', async () => {
    expect((await feedIds({ tag: 'GRATITUDE' })).sort()).toEqual([ids.thanks, ids.lower].sort());
    expect(await feedIds({ scope: 'mine', tag: 'Gratitude' })).toEqual([ids.mine]);
    expect(await feedIds({ tag: 'nothing' })).toEqual([]);
  });

  it('finds public entries by their words in both languages, never by mood', async () => {
    expect(await feedIds({ search: 'rivers' })).toEqual([ids.thanks]);
    expect(await feedIds({ search: 'morn' })).toEqual([ids.lower]);
    expect(await feedIds({ search: 'river', tag: 'morning' })).toEqual([]);
    expect(await feedIds({ search: '1' })).toEqual([]);
  });

  it('brings a followed topic into the Following tab, without the reader’s own entries', async () => {
    expect(await feedIds({ scope: 'following' })).toEqual([]);

    await expect(topics.follow(reader, 'Gratitude')).resolves.toEqual({ tag: 'gratitude', following: true });
    await expect(topics.follow(reader, 'gratitude')).resolves.toEqual({ tag: 'gratitude', following: true });
    expect(await topics.list(reader)).toEqual([{ tag: 'gratitude', followedAt: expect.any(String) }]);
    expect((await feedIds({ scope: 'following' })).sort()).toEqual([ids.thanks, ids.lower].sort());

    await expect(topics.unfollow(reader, 'GRATITUDE')).resolves.toEqual({ tag: 'gratitude', following: false });
    expect(await topics.list(reader)).toEqual([]);
    expect(await feedIds({ scope: 'following' })).toEqual([]);
  });

  it('keeps followed authors in the Following tab beside the topics', async () => {
    await dataSource.query('INSERT INTO user_follows (follower_id, followed_id) VALUES ($1, $2)', [reader, author]);
    await topics.follow(reader, 'weather');

    expect((await feedIds({ scope: 'following' })).sort()).toEqual([ids.thanks, ids.lower, ids.other].sort());
    expect(await feedIds({ scope: 'following', tag: 'weather' })).toEqual([ids.other]);
  });

  it('refuses a topic that is not in lower case or is blank', async () => {
    await expect(
      dataSource.query(`INSERT INTO topic_follows (user_id, tag) VALUES ($1, 'Mixed')`, [reader]),
    ).rejects.toThrow(/chk_topic_follows_tag/);
    await expect(
      dataSource.query(`INSERT INTO topic_follows (user_id, tag) VALUES ($1, '  ')`, [reader]),
    ).rejects.toThrow(/chk_topic_follows_tag/);
  });
});
