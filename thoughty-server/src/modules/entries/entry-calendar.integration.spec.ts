import { DataSource, type Repository } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Diary, Entry, User } from '@/database/entities';
import { EntryCalendarService } from './entry-calendar.service';
import { EntrySearchService } from './entry-search.service';

describePostgres('PostgreSQL journal calendar', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let entries: Repository<Entry>;
  let calendar: EntryCalendarService;
  let userId: number;
  let otherUserId: number;
  let workDiaryId: number;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    entries = dataSource.getRepository(Entry);
    calendar = new EntryCalendarService(entries, new EntrySearchService(entries));
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const users = dataSource.getRepository(User);
    userId = (await users.save({ username: 'writer', email: 'writer@example.com' })).id;
    otherUserId = (await users.save({ username: 'other', email: 'other@example.com' })).id;
    workDiaryId = (await dataSource.getRepository(Diary).save({ userId, name: 'Work', position: 1 })).id;
  });

  const write = (overrides: Partial<Entry>) =>
    entries.save({ userId, date: '2026-10-05', index: 1, tags: [], content: 'Text', ...overrides });

  it("returns only the month's entries of the writer, outside the recycle bin, in each day's order", async () => {
    await write({ date: '2026-09-30', content: 'September' });
    await write({ date: '2026-10-01', index: 1, content: 'Late note', timeOfDay: '22:00' });
    await write({ date: '2026-10-01', index: 2, content: '# Morning\n\nCoffee **first**', title: null, mood: 4 });
    await write({ date: '2026-10-31', content: 'Halloween', title: 'Costumes', diaryId: workDiaryId });
    await write({ date: '2026-11-01', content: 'November' });
    await write({ userId: otherUserId, date: '2026-10-10', content: 'Not mine' });
    const binned = await write({ date: '2026-10-15', content: 'In the bin' });
    await entries.softDelete(binned.id);

    const month = await calendar.getMonth(userId, { month: '2026-10' });

    expect(month.month).toBe('2026-10');
    expect(month.entries.map(({ date, index, time_of_day, title, snippet, mood, diary_id }) =>
      ({ date, index, time_of_day, title, snippet, mood, diary_id }))).toEqual([
      { date: '2026-10-01', index: 2, time_of_day: null, title: null, snippet: 'Morning Coffee first', mood: 4, diary_id: null },
      { date: '2026-10-01', index: 1, time_of_day: '22:00', title: null, snippet: 'Late note', mood: null, diary_id: null },
      { date: '2026-10-31', index: 1, time_of_day: null, title: 'Costumes', snippet: 'Halloween', mood: null, diary_id: workDiaryId },
    ]);
  });

  it('applies the diary, search, tag, flag, archive and mood filters', async () => {
    await write({ date: '2026-10-02', content: 'A run by the harbor', tags: ['running'], mood: 5, isFavorite: true, diaryId: workDiaryId });
    await write({ date: '2026-10-03', content: 'Harbor walk in the rain', tags: ['walking'], visibility: 'public' });
    await write({ date: '2026-10-04', content: 'Old harbor notes', isArchived: true });

    const dates = async (query: Omit<Parameters<EntryCalendarService['getMonth']>[1], 'month'>) =>
      (await calendar.getMonth(userId, { month: '2026-10', ...query })).entries.map((entry) => entry.date);

    expect(await dates({ search: 'harbor' })).toEqual(['2026-10-02', '2026-10-03', '2026-10-04']);
    expect(await dates({ search: 'harbor', archiveStatus: 'active' })).toEqual(['2026-10-02', '2026-10-03']);
    expect(await dates({ archiveStatus: 'archived' })).toEqual(['2026-10-04']);
    expect(await dates({ diaryId: workDiaryId })).toEqual(['2026-10-02']);
    expect(await dates({ tags: 'walking' })).toEqual(['2026-10-03']);
    expect(await dates({ visibility: 'public' })).toEqual(['2026-10-03']);
    expect(await dates({ favorites: true })).toEqual(['2026-10-02']);
    expect(await dates({ mood: '5' })).toEqual(['2026-10-02']);
    expect(await dates({ mood: 'none' })).toEqual(['2026-10-03', '2026-10-04']);
    expect(await dates({ search: 'rain -walk' })).toEqual([]);
  });
});
