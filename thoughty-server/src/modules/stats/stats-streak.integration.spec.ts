import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Diary, Entry, User } from '@/database/entities';
import { StatsStreakService } from './stats-streak.service';

describePostgres('PostgreSQL writing streak', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let service: StatsStreakService;
  let writerId: number;
  let otherId: number;
  let journal: Diary;
  let work: Diary;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    service = new StatsStreakService(dataSource.getRepository(Entry));
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  const write = (userId: number, diaryId: number, date: string, content: string, extra: Partial<Entry> = {}) =>
    dataSource.getRepository(Entry).save({ userId, diaryId, date, content, ...extra });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const users = dataSource.getRepository(User);
    writerId = (await users.save({ username: 'writer', email: 'writer@example.com' })).id;
    otherId = (await users.save({ username: 'other', email: 'other@example.com' })).id;
    const diaries = dataSource.getRepository(Diary);
    journal = await diaries.save({ userId: writerId, name: 'Journal', isDefault: true, position: 0 });
    work = await diaries.save({ userId: writerId, name: 'Work', position: 1 });
    const theirs = await diaries.save({ userId: otherId, name: 'Theirs', position: 0 });

    await write(writerId, journal.id, '2026-10-24', 'Saturday market');
    await write(writerId, work.id, '2026-10-25', 'Sunday planning');
    await write(writerId, journal.id, '2026-10-26', 'Morning coffee', { index: 1 });
    await write(writerId, journal.id, '2026-10-26', 'A **long** evening walk', { index: 2, title: 'Evening' });
    await write(writerId, journal.id, '2026-10-27', 'Binned today', { deletedAt: new Date() });
    await write(writerId, journal.id, '2026-10-29', 'Dated ahead');
    await write(otherId, theirs.id, '2026-10-27', 'Someone else’s day');
  });

  it('counts the days in a row up to today across diaries, leaving out binned and later entries', async () => {
    await expect(service.getStreak(writerId, undefined, '2026-10-27')).resolves.toEqual({
      currentStreak: 3,
      writtenToday: false,
      daysSinceLastEntry: 1,
      lastEntry: { id: expect.any(Number), date: '2026-10-26', title: 'Evening', snippet: 'A long evening walk' },
    });
  });

  it('measures one diary on its own', async () => {
    await expect(service.getStreak(writerId, journal.id, '2026-10-27')).resolves.toEqual(
      expect.objectContaining({ currentStreak: 1, daysSinceLastEntry: 1 }),
    );
    await expect(service.getStreak(writerId, work.id, '2026-10-29')).resolves.toEqual(
      expect.objectContaining({ currentStreak: 0, daysSinceLastEntry: 4, lastEntry: expect.objectContaining({ date: '2026-10-25' }) }),
    );
  });

  it('never reads another writer’s diary', async () => {
    await expect(service.getStreak(otherId, journal.id, '2026-10-27')).resolves.toEqual({
      currentStreak: 0, writtenToday: false, daysSinceLastEntry: null, lastEntry: null,
    });
  });
});
