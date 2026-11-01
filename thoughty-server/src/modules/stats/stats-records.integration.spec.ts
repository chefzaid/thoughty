import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Diary, Entry, User } from '@/database/entities';
import { StatsRecordsService } from './stats-records.service';

describePostgres('PostgreSQL personal records', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let service: StatsRecordsService;
  let writerId: number;
  let journal: Diary;
  let work: Diary;
  let capsules: Diary;
  const ids: Record<string, number> = {};

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    service = new StatsRecordsService(dataSource.getRepository(Entry));
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  /** An entry created at `createdAt`, set as an instant so it is stored the way `now()` stores it. */
  const write = async (name: string, values: Omit<Partial<Entry>, 'createdAt'> & { date: string; createdAt?: string }) => {
    const { createdAt, ...entry } = values;
    const saved = await dataSource.getRepository(Entry).save({ userId: writerId, content: 'Words', ...entry });
    await dataSource.query('UPDATE entries SET created_at = $1::timestamptz WHERE id = $2', [
      createdAt ?? `${values.date}T12:00:00Z`,
      saved.id,
    ]);
    ids[name] = saved.id;
  };

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const users = dataSource.getRepository(User);
    writerId = (await users.save({ username: 'writer', email: 'writer@example.com' })).id;
    const otherId = (await users.save({ username: 'other', email: 'other@example.com' })).id;
    const diaries = dataSource.getRepository(Diary);
    journal = await diaries.save({ userId: writerId, name: 'Journal', isDefault: true, position: 0 });
    work = await diaries.save({ userId: writerId, name: 'Work', position: 1 });
    capsules = await diaries.save({ userId: writerId, name: 'Capsules', position: 2 });
    const theirs = await diaries.save({ userId: otherId, name: 'Theirs', position: 0 });

    // 10:30 UTC on 31 October: 00:30 in Kiritimati (UTC+14), 23:30 the day before in Pago Pago (UTC-11)
    await write('lateOrEarly', { diaryId: journal.id, date: '2026-10-31', createdAt: '2026-10-31T10:30:00Z' });
    // Three on 27 October, in the day's order: the one without a time (#3), then 06:45 (#2), then 21:15 (#1)
    await write('typedEvening', { diaryId: journal.id, date: '2026-10-27', index: 1, timeOfDay: '21:15', content: 'A typed time of day' });
    await write('typedMorning', { diaryId: journal.id, date: '2026-10-27', index: 2, timeOfDay: '06:45', content: 'Morning pages' });
    await write('untimed', { diaryId: journal.id, date: '2026-10-27', index: 3, createdAt: '2026-10-27T20:00:00Z', content: 'Evening' });
    // 03:00 UTC: 17:00 in Kiritimati, 16:00 in Pago Pago; the longest entry
    await write('longest', { diaryId: work.id, date: '2026-10-26', createdAt: '2026-10-26T03:00:00Z', content: 'one two three\nfour five  six seven' });
    // A sealed time capsule keeps no text, so it is never the longest entry; it is the first, at noon
    await write('capsule', { diaryId: capsules.id, date: '2026-09-01', timeOfDay: '12:00', content: '' });
    // In the recycle bin: earlier, longer, earlier and later in the day than any other
    await write('binnedFirst', { diaryId: journal.id, date: '2026-08-01', timeOfDay: '00:05', content: 'word '.repeat(100), deletedAt: new Date() });
    await write('binnedLate', { diaryId: journal.id, date: '2026-10-29', timeOfDay: '23:59', deletedAt: new Date() });
    await dataSource.getRepository(Entry).save({
      userId: otherId,
      diaryId: theirs.id,
      date: '2020-01-01',
      timeOfDay: '00:01',
      content: 'word '.repeat(200),
    });
  });

  const at = (name: string, date: string, index: number) => ({ entryId: ids[name], date, index });

  it('finds the records of every diary in Kiritimati, a day ahead of UTC', async () => {
    const records = await service.analyze(writerId, undefined, { '2026-09-01': 1, '2026-10-26': 1, '2026-10-27': 3, '2026-10-31': 1 }, 'Pacific/Kiritimati');

    expect(records).toEqual({
      longestEntry: { ...at('longest', '2026-10-26', 1), words: 7 },
      busiestDay: { date: '2026-10-27', entries: 3 },
      longestStreak: { days: 2, startDate: '2026-10-26', endDate: '2026-10-27' },
      earliestEntry: { ...at('lateOrEarly', '2026-10-31', 1), time: '00:30' },
      latestEntry: { ...at('typedEvening', '2026-10-27', 1), time: '21:15' },
      firstEntry: at('capsule', '2026-09-01', 1),
    });
  });

  it('reads the same creation time as the latest in Pago Pago, a day behind UTC', async () => {
    const records = await service.analyze(writerId, undefined, {}, 'Pacific/Pago_Pago');

    expect(records.earliestEntry).toEqual({ ...at('typedMorning', '2026-10-27', 2), time: '06:45' });
    expect(records.latestEntry).toEqual({ ...at('lateOrEarly', '2026-10-31', 1), time: '23:30' });
    expect(records.busiestDay).toBeNull();
    expect(records.longestStreak).toBeNull();
  });

  it('reads the creation times in UTC without a zone', async () => {
    const records = await service.analyze(writerId, undefined, {});

    expect(records.earliestEntry).toEqual({ ...at('longest', '2026-10-26', 1), time: '03:00' });
    expect(records.latestEntry).toEqual({ ...at('typedEvening', '2026-10-27', 1), time: '21:15' });
  });

  it('keeps to one diary, and takes the first entry in the day’s order', async () => {
    const inJournal = await service.analyze(writerId, journal.id, { '2026-10-27': 3, '2026-10-31': 1 }, 'Pacific/Pago_Pago');
    expect(inJournal.firstEntry).toEqual(at('untimed', '2026-10-27', 3));
    expect(inJournal.longestEntry).toEqual({ ...at('typedEvening', '2026-10-27', 1), words: 5 });
    expect(inJournal.longestStreak).toEqual({ days: 1, startDate: '2026-10-27', endDate: '2026-10-27' });

    const atWork = await service.analyze(writerId, work.id, { '2026-10-26': 1 }, 'Pacific/Pago_Pago');
    expect(atWork.earliestEntry).toEqual({ ...at('longest', '2026-10-26', 1), time: '16:00' });
    expect(atWork.latestEntry).toEqual(atWork.earliestEntry);
  });

  it('has no longest entry while every entry is empty, and no records at all without entries', async () => {
    const sealed = await service.analyze(writerId, capsules.id, { '2026-09-01': 1 });
    expect(sealed.longestEntry).toBeNull();
    expect(sealed.firstEntry).toEqual(at('capsule', '2026-09-01', 1));

    await dataSource.query('UPDATE entries SET deleted_at = now() WHERE user_id = $1', [writerId]);
    await expect(service.analyze(writerId, undefined, {}, 'Pacific/Kiritimati')).resolves.toEqual({
      longestEntry: null,
      busiestDay: null,
      longestStreak: null,
      earliestEntry: null,
      latestEntry: null,
      firstEntry: null,
    });
  });
});
