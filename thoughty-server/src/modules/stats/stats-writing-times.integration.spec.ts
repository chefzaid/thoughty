import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Diary, Entry, User } from '@/database/entities';
import { StatsWritingTimesService } from './stats-writing-times.service';

/** The hours and weekdays (1 = Monday) that hold entries, as `[hour, count]` and `[weekday, count]` pairs. */
function counted(times: { hours: number[]; weekdays: number[] }) {
  return {
    hours: times.hours.flatMap((count, hour) => (count > 0 ? [[hour, count]] : [])),
    weekdays: times.weekdays.flatMap((count, index) => (count > 0 ? [[index + 1, count]] : [])),
  };
}

describePostgres('PostgreSQL writing times', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let service: StatsWritingTimesService;
  let writerId: number;
  let journal: Diary;
  let work: Diary;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    service = new StatsWritingTimesService(dataSource.getRepository(Entry));
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  /** An entry created at `createdAt`, set as an instant so it is stored the way `now()` stores it. */
  const write = async (userId: number, diaryId: number, date: string, createdAt: string, extra: Partial<Entry> = {}) => {
    const entry = await dataSource.getRepository(Entry).save({ userId, diaryId, date, content: 'Words', ...extra });
    await dataSource.query('UPDATE entries SET created_at = $1::timestamptz WHERE id = $2', [createdAt, entry.id]);
  };

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const users = dataSource.getRepository(User);
    writerId = (await users.save({ username: 'writer', email: 'writer@example.com' })).id;
    const otherId = (await users.save({ username: 'other', email: 'other@example.com' })).id;
    const diaries = dataSource.getRepository(Diary);
    journal = await diaries.save({ userId: writerId, name: 'Journal', isDefault: true, position: 0 });
    work = await diaries.save({ userId: writerId, name: 'Work', position: 1 });
    const theirs = await diaries.save({ userId: otherId, name: 'Theirs', position: 0 });

    // 10:30 UTC on Saturday 31 October: 00:30 on Sunday 1 November in Kiritimati (UTC+14), 23:30 on Friday 30 October in Pago Pago (UTC-11)
    await write(writerId, journal.id, '2026-10-31', '2026-10-31T10:30:00Z');
    // A time typed by the writer counts as written, on its own date (Tuesday 27 October), wherever they are now
    await write(writerId, journal.id, '2026-10-27', '2026-10-31T10:30:00Z', { timeOfDay: '21:15' });
    // 03:00 UTC on Monday 26 October: 17:00 that Monday in Kiritimati, 16:00 on Sunday 25 October in Pago Pago
    await write(writerId, work.id, '2026-10-26', '2026-10-26T03:00:00Z');
    await write(writerId, journal.id, '2026-10-29', '2026-10-29T08:00:00Z', { deletedAt: new Date() });
    await write(otherId, theirs.id, '2026-10-31', '2026-10-31T10:30:00Z', { timeOfDay: '06:00' });
  });

  it('reads creation times in Kiritimati, a day ahead of UTC', async () => {
    expect(counted(await service.analyze(writerId, undefined, 'Pacific/Kiritimati'))).toEqual({
      hours: [[0, 1], [17, 1], [21, 1]],
      weekdays: [[1, 1], [2, 1], [7, 1]],
    });
  });

  it('reads creation times in Pago Pago, a day behind UTC', async () => {
    expect(counted(await service.analyze(writerId, undefined, 'Pacific/Pago_Pago'))).toEqual({
      hours: [[16, 1], [21, 1], [23, 1]],
      weekdays: [[2, 1], [5, 1], [7, 1]],
    });
  });

  it('reads them in UTC without a zone, and on the half hour in Kolkata (UTC+5:30)', async () => {
    expect(counted(await service.analyze(writerId))).toEqual({
      hours: [[3, 1], [10, 1], [21, 1]],
      weekdays: [[1, 1], [2, 1], [6, 1]],
    });
    expect(counted(await service.analyze(writerId, undefined, 'Asia/Kolkata'))).toEqual({
      hours: [[8, 1], [16, 1], [21, 1]],
      weekdays: [[1, 1], [2, 1], [6, 1]],
    });
  });

  it('keeps to one diary, without the recycle bin or another writer’s entries', async () => {
    expect(counted(await service.analyze(writerId, work.id, 'Pacific/Kiritimati'))).toEqual({
      hours: [[17, 1]],
      weekdays: [[1, 1]],
    });
    expect(counted(await service.analyze(writerId, journal.id, 'Pacific/Pago_Pago'))).toEqual({
      hours: [[21, 1], [23, 1]],
      weekdays: [[2, 1], [5, 1]],
    });
  });
});
