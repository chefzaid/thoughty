import { DataSource, type Repository } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Attachment, Diary, Entry, EntryRevision, User, YearReviewMood } from '@/database/entities';
import { StatsMoodService } from '@/modules/stats/stats-mood.service';
import { YearReviewService } from '@/modules/review/year-review.service';
import { EntriesQueryService } from './entries-query.service';
import { EntrySearchService } from './entry-search.service';

describePostgres('PostgreSQL entry moods', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let entries: Repository<Entry>;
  let queries: EntriesQueryService;
  let stats: StatsMoodService;
  let review: YearReviewService;
  let userId: number;
  let otherDiaryId: number;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    entries = dataSource.getRepository(Entry);
    queries = new EntriesQueryService(entries, dataSource.getRepository(EntryRevision), new EntrySearchService(entries));
    stats = new StatsMoodService(entries);
    review = new YearReviewService(
      entries,
      dataSource.getRepository(Diary),
      dataSource.getRepository(Attachment),
      dataSource.getRepository(YearReviewMood),
      { getStatus: async () => ({ aiAvailable: false }) } as never,
    );
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    userId = (await dataSource.getRepository(User).save({ username: 'writer', email: 'writer@example.com' })).id;
    otherDiaryId = (await dataSource.getRepository(Diary).save({ userId, name: 'Work', position: 1 })).id;
  });

  const write = (overrides: Partial<Entry>) =>
    entries.save({ userId, date: '2025-01-06', index: 1, tags: [], content: 'Text', ...overrides });

  it('stores the mood and feelings and filters the journal by level, any mood, or none', async () => {
    await write({ date: '2025-01-06', content: 'low', mood: 1, feelings: ['tired', 'anxious'] });
    await write({ date: '2025-01-07', content: 'good', mood: 4, feelings: ['calm'] });
    await write({ date: '2025-01-08', content: 'great', mood: 5 });
    await write({ date: '2025-01-09', content: 'unrecorded' });

    const contents = async (mood?: string) =>
      (await queries.getEntries(userId, { mood, page: 1, limit: 10 })).entries.map((entry) => entry.content);

    expect(await contents('4,5')).toEqual(['great', 'good']);
    expect(await contents('1')).toEqual(['low']);
    expect(await contents('any')).toEqual(['great', 'good', 'low']);
    expect(await contents('none')).toEqual(['unrecorded']);
    const [low] = (await queries.getEntries(userId, { mood: '1', page: 1, limit: 10 })).entries;
    expect(low).toMatchObject({ mood: 1, feelings: ['tired', 'anxious'] });
    expect((await queries.getEntries(userId, { mood: 'none', page: 1, limit: 10 })).entries[0].feelings).toEqual([]);
  });

  it('rejects moods off the scale in the database too', async () => {
    await expect(write({ mood: 6 })).rejects.toThrow(/chk_entries_mood/);
  });

  it('sums up recorded moods per diary, leaving out entries in the recycle bin', async () => {
    await write({ date: '2025-01-06', mood: 2, feelings: ['tired'] });
    await write({ date: '2025-01-13', mood: 4, feelings: ['tired', 'calm'] });
    await write({ date: '2025-02-01', mood: 5, feelings: ['joyful'] });
    await write({ date: '2025-02-02', feelings: ['calm'] });
    const trashed = await write({ date: '2025-02-03', mood: 1, feelings: ['angry'] });
    await entries.softDelete(trashed.id);
    await write({ date: '2025-02-04', mood: 1, diaryId: otherDiaryId, feelings: ['sad'] });

    const all = await stats.analyze(userId);

    expect(all.recordedEntries).toBe(4);
    expect(all.averageMood).toBe(3);
    expect(all.levels).toEqual([1, 1, 0, 1, 1]);
    expect(all.months).toEqual([
      { month: '2025-01', average: 3, entries: 2 },
      { month: '2025-02', average: 3, entries: 2 },
    ]);
    // 2025-01-06 and 2025-01-13 are Mondays, 2025-02-01 a Saturday, 2025-02-04 a Tuesday
    expect(all.weekdays[0]).toEqual({ average: 3, entries: 2 });
    expect(all.weekdays[1]).toEqual({ average: 1, entries: 1 });
    expect(all.weekdays[5]).toEqual({ average: 5, entries: 1 });
    expect(all.topFeelings).toEqual([
      { feeling: 'calm', count: 2 },
      { feeling: 'tired', count: 2 },
      { feeling: 'joyful', count: 1 },
      { feeling: 'sad', count: 1 },
    ]);

    const work = await stats.analyze(userId, otherDiaryId);
    expect(work).toMatchObject({ recordedEntries: 1, averageMood: 1, topFeelings: [{ feeling: 'sad', count: 1 }] });
  });

  it('draws the year in review mood arc from recorded moods', async () => {
    await write({ date: '2025-03-02', mood: 3, feelings: ['calm'] });
    await write({ date: '2025-03-20', mood: 4 });
    await write({ date: '2025-07-14', content: 'Summer.' });

    const { recordedMood } = await review.getReview(userId, 2025);

    expect(recordedMood).toEqual({
      entries: 2,
      average: 3.5,
      months: [{ month: '2025-03', average: 3.5, entries: 2 }],
      topFeelings: [{ feeling: 'calm', count: 1 }],
    });
    expect((await review.getReview(userId, 2024)).recordedMood).toBeNull();
  });

  it('rolls back to entries without moods and applies again', async () => {
    await write({ mood: 3, feelings: ['calm'] });

    await dataSource.undoLastMigration({ transaction: 'all' });
    const columns = (await dataSource.query(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_name IN ('entries', 'entry_revisions') AND column_name IN ('mood', 'feelings')`,
    )) as unknown[];
    expect(columns).toEqual([]);

    await dataSource.runMigrations({ transaction: 'all' });
    await write({ mood: 2 });
    expect(await entries.count({ where: { userId } })).toBe(2);
  });
});
