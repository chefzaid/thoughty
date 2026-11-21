import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { WritingEngagementMetricsService } from './writing-engagement-metrics.service';

describePostgres('PostgreSQL writing engagement metrics', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let entryIndex = 0;

  /** An account created `daysAgo` days before now, optionally being deleted. */
  const account = async (name: string, daysAgo: number, deleted = false): Promise<number> => {
    const [{ id }] = await dataSource.query<{ id: number }[]>(
      `INSERT INTO users (username, email, created_at, deleted_at)
       VALUES ($1::text, $1::text || '@example.com', LOCALTIMESTAMP - make_interval(days => $2::int), CASE WHEN $3::boolean THEN LOCALTIMESTAMP END)
       RETURNING id`,
      [name, daysAgo, deleted],
    );
    return id;
  };

  /** An entry saved `daysAgo` days before now, dated `dateOffset` days from the day it was saved. */
  const entry = (userId: number, daysAgo: number, dateOffset = 0, inRecycleBin = false) =>
    dataSource.query(
      `INSERT INTO entries (user_id, date, index, content, created_at, deleted_at)
       VALUES ($1, (LOCALTIMESTAMP - make_interval(days => $2::int))::date + $3::int, $4, 'A thought',
               LOCALTIMESTAMP - make_interval(days => $2::int), CASE WHEN $5::boolean THEN LOCALTIMESTAMP END)`,
      [userId, daysAgo, dateOffset, ++entryIndex, inRecycleBin],
    );

  const snapshot = () => new WritingEngagementMetricsService(dataSource).getSnapshot();

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
  });

  it('counts writing days of the last week per writer active in the last four weeks', async () => {
    const regular = await account('regular', 100);
    await entry(regular, 0);
    await entry(regular, 0);
    await entry(regular, 1, -1);
    await entry(regular, 3);
    await entry(regular, 0, -2000);
    await entry(regular, 0, -5);

    const lastMonth = await account('last-month', 100);
    await entry(lastMonth, 10);

    const lapsed = await account('lapsed', 100);
    await entry(lapsed, 40);

    const leaving = await account('leaving', 100, true);
    await entry(leaving, 0);

    const tidy = await account('tidy', 100);
    await entry(tidy, 2, 0, true);

    const everyDay = await account('every-day', 100);
    for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
      await entry(everyDay, daysAgo, -1);
      await entry(everyDay, daysAgo, 1);
    }

    await expect(snapshot()).resolves.toMatchObject({ activeWriters7d: 3, activeWriters28d: 4, writingDays7d: 11 });
  });

  it('follows the accounts created four to eight weeks ago through their first four weeks', async () => {
    const steady = await account('steady', 40);
    for (let day = 0; day < 5; day++) await entry(steady, 40 - day);

    const lateStarter = await account('late-starter', 30);
    await entry(lateStarter, 30 - 22);

    const quiet = await account('quiet', 50);
    await entry(quiet, 10);

    const importer = await account('importer', 45);
    for (let item = 0; item < 6; item++) await entry(importer, 44, -3000 - item);

    await entry(await account('too-new', 20), 19);
    await entry(await account('too-old', 60), 59);
    await entry(await account('gone', 35, true), 34);

    await expect(snapshot()).resolves.toMatchObject({
      funnel: { signed_up: 4, first_entry: 2, fifth_entry: 1, week_four: 1 },
    });
  });

  it('reads an empty database as zero everywhere', async () => {
    await expect(snapshot()).resolves.toEqual({
      activeWriters7d: 0,
      activeWriters28d: 0,
      writingDays7d: 0,
      funnel: { signed_up: 0, first_entry: 0, fifth_entry: 0, week_four: 0 },
    });
  });
});
