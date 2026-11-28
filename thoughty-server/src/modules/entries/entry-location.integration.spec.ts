import { DataSource, type Repository } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Entry, User } from '@/database/entities';
import { entryListOn } from './entry-list.test-helpers';
import { writtenEntryDetails } from './entry-details';

describePostgres('PostgreSQL entry places', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let entries: Repository<Entry>;
  let userId: number;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    entries = dataSource.getRepository(Entry);
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    userId = (await dataSource.getRepository(User).save({ username: 'writer', email: 'writer@example.com' })).id;
  });

  const write = (overrides: Partial<Entry>) =>
    entries.save({ userId, date: '2025-01-06', index: 1, tags: [], content: 'Text', ...overrides });

  it('stores a place and lists it with the entry, as a number pair the browser can read', async () => {
    const location = { name: 'Lake Annecy', latitude: 45.899_247, longitude: 6.129_384 };
    await write({ content: 'By the lake', ...writtenEntryDetails({ location }) });
    await write({ date: '2025-01-07', content: 'At home' });

    const listed = (await entryListOn(entries).getEntries(userId, { limit: 10 })).entries;

    expect(listed.map((entry) => [entry.content, entry.location])).toEqual([
      ['At home', null],
      ['By the lake', location],
    ]);
  });

  it('refuses a lone coordinate or one out of range in the database too', async () => {
    await expect(write({ latitude: 45 })).rejects.toThrow(/chk_entries_coordinates/);
    await expect(write({ latitude: 91, longitude: 0 })).rejects.toThrow(/chk_entries_coordinates/);
    await expect(write({ latitude: 0, longitude: -180.5 })).rejects.toThrow(/chk_entries_coordinates/);
  });
});
