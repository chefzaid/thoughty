import { DataSource, type Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { Entry, User } from '@/database/entities';
import { EntryRandomService } from './entry-random.service';
import { EntrySearchService } from './entry-search.service';
import type { GetRandomEntryQueryDto } from './dto';
import { entryListOn } from './entry-list.test-helpers';

describePostgres('PostgreSQL random entry', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let entries: Repository<Entry>;
  let random: EntryRandomService;
  let userId: number;
  let otherUserId: number;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    entries = dataSource.getRepository(Entry);
    const search = new EntrySearchService(entries);
    random = new EntryRandomService(entries, search);
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

  /** Picks many times and gathers the entries picked. */
  const pickedIds = async (query: GetRandomEntryQueryDto, times = 40) => {
    const ids = new Set<number>();
    for (let attempt = 0; attempt < times; attempt += 1) {
      ids.add((await random.pick(userId, query)).id);
    }
    return ids;
  };

  it("picks among the writer's matching entries only, never a sealed capsule or one in the recycle bin", async () => {
    const walk = await write({ content: 'A walk', tags: ['walks'], date: '2026-10-01' });
    const hike = await write({ content: 'A hike', tags: ['walks'], date: '2026-10-02' });
    await write({ content: 'Groceries', tags: ['chores'], date: '2026-10-03' });
    await write({ content: 'Sealed walk', tags: ['walks'], date: '2026-10-04', sealedUntil: new Date('2040-01-01T00:00:00Z') });
    const binned = await write({ content: 'Binned walk', tags: ['walks'], date: '2026-10-06' });
    await entries.softDelete(binned.id);
    await write({ userId: otherUserId, content: 'Not mine', tags: ['walks'] });

    expect([...(await pickedIds({ tags: 'walks' }))].sort((a, b) => a - b)).toEqual([walk.id, hike.id]);
  });

  it('moves on from the entry picked last, unless it is the only match', async () => {
    const only = await write({ content: 'Only one', mood: 5 });
    const other = await write({ content: 'Another', date: '2026-10-06' });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect((await random.pick(userId, { excludeId: only.id })).id).toBe(other.id);
    }
    expect((await random.pick(userId, { mood: '5', excludeId: only.id })).id).toBe(only.id);
  });

  it('picks an entry the journal list opens around, with the same filters and order', async () => {
    const written: Entry[] = [];
    for (let day = 1; day <= 7; day += 1) {
      written.push(await write({ date: `2026-10-0${day}`, content: `Harbor day ${day}`, tags: ['harbor'] }));
    }
    await write({ date: '2026-10-08', content: 'Elsewhere' });
    await entries.update(written[0]!.id, { isPinned: true });

    const queries: GetRandomEntryQueryDto[] = [
      { tags: 'harbor' },
      { search: 'harbor' },
      { search: 'harbor', sort: 'date' },
      { ids: [written[2]!.id, written[5]!.id, written[0]!.id].join(',') },
    ];
    for (const query of queries) {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const pick = await random.pick(userId, query);
        const batch = await entryListOn(entries).getEntries(userId, { ...query, around: pick.id, limit: 3 });
        expect(batch.entries.map((entry) => entry.id)).toContain(pick.id);
        expect(pick).toMatchObject({ date: expect.stringMatching(/^2026-10-0\d$/), index: 1 });
      }
    }
  });

  it('answers 404 when nothing matches', async () => {
    await write({ content: 'Calm', mood: 3 });
    await write({ content: 'Sealed', mood: 1, sealedUntil: new Date('2040-01-01T00:00:00Z') });

    await expectApiError(random.pick(userId, { mood: '1' }), NotFoundException, 'ENTRY_RANDOM_NO_MATCH');
    await expectApiError(random.pick(userId, { date: '2020-01-01' }), NotFoundException, 'ENTRY_RANDOM_NO_MATCH');
  });
});
