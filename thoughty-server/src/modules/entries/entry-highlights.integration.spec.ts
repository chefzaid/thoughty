import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Diary, Entry, User } from '@/database/entities';
import { buildTimeCapsuleBed } from '@/modules/time-capsules/time-capsules.integration.test-helpers';

/** Highlights on the writer's own day, for writers in the time zones furthest from UTC on either side of midnight. */
describePostgres('PostgreSQL Highlights on the writer’s day', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let bed: ReturnType<typeof buildTimeCapsuleBed>;
  let writerId: number;
  const ids: Record<string, number> = {};

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    bed = buildTimeCapsuleBed(dataSource);
    writerId = (await dataSource.getRepository(User).save({ username: 'writer', email: 'writer@example.com' })).id;
    const diary = await dataSource.getRepository(Diary).save({ userId: writerId, name: 'Journal', isDefault: true, position: 0 });
    for (const date of ['2025-10-30', '2025-10-31', '2025-11-01', '2026-01-01', '2026-12-31']) {
      ids[date] = (await dataSource.getRepository(Entry).save({ userId: writerId, diaryId: diary.id, date, content: `Written on ${date}` })).id;
    }
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  const onThisDayIds = async (today: string) => {
    const highlights = await bed.journal.getHighlights(writerId, { today });
    return { currentDate: highlights.currentDate, onThisDay: Object.fromEntries(Object.entries(highlights.onThisDay).map(([years, entries]) => [years, entries.map((entry) => entry.id)])) };
  };

  it('shows 1 November in Kiritimati and 30 October in Pago Pago while it is 31 October in UTC', async () => {
    // 10:30 UTC on 31 October 2026: 00:30 on 1 November in Kiritimati (UTC+14), 23:30 on 30 October in Pago Pago (UTC-11)
    await expect(onThisDayIds('2026-11-01')).resolves.toEqual({ currentDate: { year: 2026, month: '11', day: '01' }, onThisDay: { 1: [ids['2025-11-01']] } });
    await expect(onThisDayIds('2026-10-30')).resolves.toEqual({ currentDate: { year: 2026, month: '10', day: '30' }, onThisDay: { 1: [ids['2025-10-30']] } });
  });

  it('counts the years from the writer’s year across New Year', async () => {
    // New Year's Day 2027 in Kiritimati: last year's 1 January is a year ago, this year's 31 December is not a memory yet
    await expect(onThisDayIds('2027-01-01')).resolves.toEqual({ currentDate: { year: 2027, month: '01', day: '01' }, onThisDay: { 1: [ids['2026-01-01']] } });
    // Still 31 December 2026 in Pago Pago: nothing from an earlier year on that day
    await expect(onThisDayIds('2026-12-31')).resolves.toEqual({ currentDate: { year: 2026, month: '12', day: '31' }, onThisDay: {} });
  });
});
