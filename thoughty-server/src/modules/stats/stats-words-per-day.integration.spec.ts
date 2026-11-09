import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Diary, Entry, User } from '@/database/entities';
import { timeCapsuleServiceOn } from '@/modules/time-capsules/time-capsules.test-helpers';
import { StatsService } from './stats.service';
import type { StatsJournalAnalysisService } from './stats-journal-analysis.service';
import type { StatsCorrelationService } from './stats-correlation.service';
import type { StatsMoodService } from './stats-mood.service';
import type { StatsGoalService } from './stats-goal.service';
import type { StatsWritingTimesService } from './stats-writing-times.service';
import type { StatsRecordsService } from './stats-records.service';
import type { StatsTopWordsService } from './stats-top-words.service';

/** The per-day counts are the stats service's own query; the other readings have their own specs. */
const elsewhere = <T>() => ({ analyze: jest.fn().mockResolvedValue(null) }) as unknown as T;

describePostgres('PostgreSQL entries and words per day', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let service: StatsService;
  let writerId: number;
  let journal: Diary;
  let work: Diary;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    service = new StatsService(
      dataSource.getRepository(Entry),
      elsewhere<StatsJournalAnalysisService>(),
      elsewhere<StatsCorrelationService>(),
      elsewhere<StatsMoodService>(),
      elsewhere<StatsGoalService>(),
      elsewhere<StatsWritingTimesService>(),
      elsewhere<StatsRecordsService>(),
      elsewhere<StatsTopWordsService>(),
    );
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  const write = (userId: number, diaryId: number, date: string, content: string, extra: Partial<Entry> = {}) =>
    dataSource.getRepository(Entry).save({ userId, diaryId, date, content, ...extra });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const users = dataSource.getRepository(User);
    writerId = (await users.save({ username: 'writer', email: 'writer@example.com' })).id;
    const otherId = (await users.save({ username: 'other', email: 'other@example.com' })).id;
    const diaries = dataSource.getRepository(Diary);
    journal = await diaries.save({ userId: writerId, name: 'Journal', isDefault: true, position: 0 });
    work = await diaries.save({ userId: writerId, name: 'Work', position: 1 });
    const theirs = await diaries.save({ userId: otherId, name: 'Theirs', position: 0 });

    // Words split on any whitespace, as the other word stats count them; an empty text has none
    await write(writerId, journal.id, '2026-11-01', '  The garden\nafter   the rain.  ');
    await write(writerId, work.id, '2026-11-01', 'Meeting notes', { index: 2 });
    await write(writerId, journal.id, '2026-11-02', '   ');
    // The recycle bin, a sealed capsule and another writer stay out
    await write(writerId, journal.id, '2026-11-01', 'Binned binned binned', { deletedAt: new Date(), index: 3 });
    await timeCapsuleServiceOn(dataSource).createSealed(
      writerId,
      { diaryId: journal.id, date: '2026-11-03', content: 'Secret words for later' },
      { opensOn: '2036-11-03', timeZone: 'UTC' },
    );
    await write(otherId, theirs.id, '2026-11-01', 'Theirs theirs theirs');
  });

  it('counts the words of each day beside its entries, without the bin, sealed capsules or other writers', async () => {
    const stats = await service.getStats(writerId, undefined, '2026-11-10');

    expect(stats.wordsPerDay).toEqual({ '2026-11-01': 7, '2026-11-02': 0, '2026-11-03': 0 });
    // The sealed capsule still counts as an entry on its day, as the heatmap always showed it
    expect(stats.thoughtsPerDay).toEqual({ '2026-11-01': 2, '2026-11-02': 1, '2026-11-03': 1 });
  });

  it('keeps to one diary', async () => {
    expect((await service.getStats(writerId, work.id, '2026-11-10')).wordsPerDay).toEqual({ '2026-11-01': 2 });
    expect((await service.getStats(writerId, journal.id, '2026-11-10')).wordsPerDay).toEqual({
      '2026-11-01': 5,
      '2026-11-02': 0,
      '2026-11-03': 0,
    });
  });
});
