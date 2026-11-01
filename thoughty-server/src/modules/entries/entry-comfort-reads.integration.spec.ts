import { DataSource, type Repository } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Entry, User } from '@/database/entities';
import { EntryComfortReadsService } from './entry-comfort-reads.service';

describePostgres('PostgreSQL comfort reads', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let entries: Repository<Entry>;
  let comfort: EntryComfortReadsService;
  let userId: number;
  let otherUserId: number;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    entries = dataSource.getRepository(Entry);
    comfort = new EntryComfortReadsService(entries);
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const users = dataSource.getRepository(User);
    userId = (await users.save({ username: 'writer', email: 'writer@example.com' })).id;
    otherUserId = (await users.save({ username: 'other', email: 'other@example.com' })).id;
  });

  const write = (overrides: Partial<Entry>) =>
    entries.save({ userId, date: '2026-10-05', index: 1, tags: [], content: 'Text', ...overrides });

  /** Picks many times and gathers every entry offered. */
  const offeredIds = async (excludeId?: number, times = 30) => {
    const ids = new Set<number>();
    for (let attempt = 0; attempt < times; attempt += 1) {
      const { entries: picked } = await comfort.pick(userId, { excludeId });
      expect(picked.length).toBeLessThanOrEqual(3);
      expect(new Set(picked.map((entry) => entry.id)).size).toBe(picked.length);
      for (const entry of picked) ids.add(entry.id);
    }
    return [...ids].sort((a, b) => a - b);
  };

  it("offers the writer's favorites and gratitude entries only, never a sealed capsule, one in the bin or the one just written", async () => {
    const favorite = await write({ content: 'Swimming at dawn', isFavorite: true, date: '2025-06-14' });
    const grateful = await write({ content: 'Thankful for Lea', tags: ['Gratitude', 'friends'], date: '2025-06-15' });
    const english = await write({ content: 'Warm soup', tags: ['grateful'], date: '2025-06-16' });
    const french = await write({ content: 'Un café offert', tags: ['reconnaissance'], date: '2025-06-17' });
    await write({ content: 'Errands', tags: ['chores'] });
    await write({ content: 'Sealed', isFavorite: true, sealedUntil: new Date('2040-01-01T00:00:00Z') });
    const binned = await write({ content: 'Binned', isFavorite: true });
    await entries.softDelete(binned.id);
    await write({ userId: otherUserId, content: 'Not mine', isFavorite: true, tags: ['gratitude'] });
    const justWritten = await write({ content: 'Today, a hard one', mood: 1, isFavorite: true, date: '2026-11-01' });

    await expect(offeredIds(justWritten.id)).resolves.toEqual([favorite.id, grateful.id, english.id, french.id]);
  });

  it('gives each pick its day, index, title and a plain excerpt', async () => {
    const entry = await write({
      content: '# Morning\n\n**We swam** before anyone else was up, and the [lake](https://example.com) was ours.',
      format: 'markdown',
      title: 'The lake',
      index: 2,
      isFavorite: true,
      date: '2025-06-14',
    });

    await expect(comfort.pick(userId, {})).resolves.toEqual({
      entries: [{
        id: entry.id,
        date: '2025-06-14',
        index: 2,
        title: 'The lake',
        excerpt: 'Morning We swam before anyone else was up, and the lake was ours.',
      }],
    });
  });

  it('answers an empty list when there is nothing to offer', async () => {
    await write({ content: 'An ordinary day', tags: ['daily'] });
    const only = await write({ content: 'Just written', isFavorite: true });

    await expect(comfort.pick(userId, { excludeId: only.id })).resolves.toEqual({ entries: [] });
  });
});
