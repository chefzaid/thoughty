import { DataSource, type Repository } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Entry, EntryRevision, User } from '@/database/entities';
import { EntriesQueryService } from './entries-query.service';
import { EntrySearchService } from './entry-search.service';

describePostgres('PostgreSQL entry titles and times of day', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let entries: Repository<Entry>;
  let queries: EntriesQueryService;
  let userId: number;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    entries = dataSource.getRepository(Entry);
    queries = new EntriesQueryService(entries, dataSource.getRepository(EntryRevision), new EntrySearchService(entries));
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    userId = (await dataSource.getRepository(User).save({ username: 'writer', email: 'writer@example.com' })).id;
  });

  const write = (overrides: Partial<Entry>) =>
    entries.save({ userId, date: '2024-01-15', index: 1, tags: [], content: 'Text', ...overrides });

  it('stores the time as HH:MM and lists a day untimed entries first, then by time, without renumbering', async () => {
    await write({ index: 1, content: 'evening', timeOfDay: '21:00' });
    await write({ index: 2, content: 'untimed' });
    await write({ index: 3, content: 'morning', timeOfDay: '07:30' });
    await write({ index: 4, content: 'also untimed' });
    await write({ date: '2024-01-16', index: 1, content: 'next day', timeOfDay: '06:00' });

    const { entries: listed } = await queries.getEntries(userId, { page: 1, limit: 10 });

    expect(listed.map((entry) => [entry.content, entry.index, entry.time_of_day])).toEqual([
      ['next day', 1, '06:00'],
      ['untimed', 2, null],
      ['also untimed', 4, null],
      ['morning', 3, '07:30'],
      ['evening', 1, '21:00'],
    ]);
  });

  it('finds the page of an entry by the same order, timed or not', async () => {
    await write({ index: 1, content: 'evening', timeOfDay: '21:00' });
    await write({ index: 2, content: 'untimed' });
    await write({ index: 3, content: 'morning', timeOfDay: '07:30' });
    await write({ date: '2024-01-16', index: 1, content: 'pinned', isPinned: true });

    const pageOf = async (date: string, index: number) =>
      (await queries.getEntryByDate(userId, { date, index, limit: 1 })).page;

    expect(await pageOf('2024-01-16', 1)).toBe(1);
    expect(await pageOf('2024-01-15', 2)).toBe(2);
    expect(await pageOf('2024-01-15', 3)).toBe(3);
    expect(await pageOf('2024-01-15', 1)).toBe(4);
  });

  it('searches titles with the weight of tags and highlights title words apart from the text', async () => {
    await write({ date: '2024-01-10', content: 'A long walk to the harbour and back home.' });
    await write({ date: '2024-01-11', title: 'Harbour', content: 'Grey sky, a few boats.' });

    const { entries: found } = await queries.getEntries(userId, { search: 'harbour', page: 1, limit: 10 });

    expect(found.map((entry) => entry.title)).toEqual(['Harbour', null]);
    expect(found[0].search_matches).toEqual(['Harbour']);
    expect(found[1].search_matches).toEqual(['harbour']);
  });

  it('matches titles literally for searches without words', async () => {
    await write({ title: 'Plans 🎉', content: 'Nothing special' });

    const { entries: found } = await queries.getEntries(userId, { search: '🎉', page: 1, limit: 10 });

    expect(found).toHaveLength(1);
  });

  it('rolls back to the content and tags vector and applies again', async () => {
    await write({ title: 'Lighthouse', content: 'Fog all day' });

    // Later migrations are undone first, down to the one that added titles and times
    const executed = (await dataSource.query('SELECT name FROM migrations ORDER BY id DESC')) as Array<{ name: string }>;
    for (const { name } of executed) {
      await dataSource.undoLastMigration({ transaction: 'all' });
      if (name === 'EntryTitleAndTime1786060800000') break;
    }
    const columns = (await dataSource.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'entries' AND column_name IN ('title', 'time_of_day', 'search_vector')`,
    )) as Array<{ column_name: string }>;
    expect(columns.map((column) => column.column_name)).toEqual(['search_vector']);
    const [{ count }] = (await dataSource.query(
      `SELECT COUNT(*)::int AS count FROM entries WHERE search_vector @@ to_tsquery('thoughty_en', 'fog')`,
    )) as Array<{ count: number }>;
    expect(count).toBe(1);

    await dataSource.runMigrations({ transaction: 'all' });
    await entries.update({ userId }, { title: 'Lighthouse' });
    const { entries: found } = await queries.getEntries(userId, { search: 'lighthouse', page: 1, limit: 10 });
    expect(found).toHaveLength(1);
  });
});
