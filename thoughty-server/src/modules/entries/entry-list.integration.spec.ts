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
import type { EntriesListResponseDto, GetEntriesQueryDto } from './dto';
import { EntryListService } from './entry-list.service';
import { entryListOn } from './entry-list.test-helpers';

describePostgres('PostgreSQL journal list batches', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let entries: Repository<Entry>;
  let list: EntryListService;
  let userId: number;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    entries = dataSource.getRepository(Entry);
    list = entryListOn(entries);
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    userId = (await dataSource.getRepository(User).save({ username: 'writer', email: 'writer@example.com' })).id;
  });

  const write = (overrides: Partial<Entry>) =>
    entries.save({ userId, date: '2026-10-05', index: 1, tags: [], content: 'Text', ...overrides });

  /** Reads the whole list batch after batch, as the infinite scroll does. */
  const scrollThrough = async (query: GetEntriesQueryDto, limit: number): Promise<{ ids: number[]; batches: EntriesListResponseDto[] }> => {
    const batches = [await list.getEntries(userId, { ...query, limit })];
    while (batches.at(-1)!.nextCursor) {
      batches.push(await list.getEntries(userId, { ...query, limit, after: batches.at(-1)!.nextCursor! }));
    }
    return { ids: batches.flatMap((batch) => batch.entries.map((entry) => entry.id)), batches };
  };

  it('reads the list in order, pinned first, then newest day first and each day in its own order', async () => {
    const pinned = await write({ date: '2026-01-01', content: 'Pinned', isPinned: true });
    const evening = await write({ date: '2026-10-05', index: 1, timeOfDay: '21:00' });
    const untimed = await write({ date: '2026-10-05', index: 2 });
    const morning = await write({ date: '2026-10-05', index: 3, timeOfDay: '07:30' });
    const older = await write({ date: '2026-10-01' });
    const oldest = await write({ date: '1969-07-20', content: 'Before 1970' });

    const { ids, batches } = await scrollThrough({}, 2);

    expect(ids).toEqual([pinned.id, untimed.id, morning.id, evening.id, older.id, oldest.id]);
    expect(batches.map((batch) => batch.offset)).toEqual([0, 2, 4]);
    expect(batches.map((batch) => batch.total)).toEqual([6, 6, 6]);
    expect(batches[0]!.prevCursor).toBeNull();
    expect(batches[1]!.prevCursor).not.toBeNull();
    expect(batches[2]!.nextCursor).toBeNull();
  });

  it('neither repeats nor skips an entry when entries are written or deleted between batches', async () => {
    const written: Entry[] = [];
    for (let day = 1; day <= 6; day += 1) {
      written.push(await write({ date: `2026-10-0${day}`, content: `Day ${day}` }));
    }
    const first = await list.getEntries(userId, { limit: 3 });
    expect(first.entries.map((entry) => entry.content)).toEqual(['Day 6', 'Day 5', 'Day 4']);

    // A newer entry and a deleted one above the cursor would shift an offset by one either way
    await write({ date: '2026-10-09', content: 'Written meanwhile' });
    await entries.softDelete(written[5]!.id);
    const next = await list.getEntries(userId, { limit: 3, after: first.nextCursor! });

    expect(next.entries.map((entry) => entry.content)).toEqual(['Day 3', 'Day 2', 'Day 1']);
    expect(next.nextCursor).toBeNull();
  });

  it('opens a window around an entry and scrolls both ways from it', async () => {
    const written: Entry[] = [];
    for (let day = 1; day <= 9; day += 1) {
      written.push(await write({ date: `2026-10-0${day}`, content: `Day ${day}` }));
    }
    const target = written[4]!; // Day 5, the fifth entry listed

    const around = await list.getEntries(userId, { around: target.id, limit: 4 });
    expect(around.entries.map((entry) => entry.content)).toEqual(['Day 7', 'Day 6', 'Day 5', 'Day 4']);
    expect(around.offset).toBe(2);

    const newer = await list.getEntries(userId, { before: around.prevCursor!, limit: 4 });
    expect(newer.entries.map((entry) => entry.content)).toEqual(['Day 9', 'Day 8']);
    expect(newer.offset).toBe(0);
    expect(newer.prevCursor).toBeNull();
    expect(newer.nextCursor).not.toBeNull();

    // Read again from its own first entry, the window keeps its entries, and the ones written since
    await write({ date: '2026-10-06', index: 2, content: 'Day 6, later' });
    const again = await list.getEntries(userId, { from: around.prevCursor!, limit: 5 });
    expect(again.entries.map((entry) => entry.content)).toEqual(['Day 7', 'Day 6', 'Day 6, later', 'Day 5', 'Day 4']);

    const older = await list.getEntries(userId, { after: around.nextCursor!, limit: 4 });
    expect(older.entries.map((entry) => entry.content)).toEqual(['Day 3', 'Day 2', 'Day 1']);
    expect(older.nextCursor).toBeNull();
  });

  it('opens at the first and the last entries without an empty side', async () => {
    const newest = await write({ date: '2026-10-09', content: 'Newest' });
    await write({ date: '2026-10-05', content: 'Middle' });
    const oldest = await write({ date: '2026-10-01', content: 'Oldest' });

    const atTop = await list.getEntries(userId, { around: newest.id, limit: 4 });
    expect(atTop.entries.map((entry) => entry.content)).toEqual(['Newest', 'Middle', 'Oldest']);
    expect(atTop).toMatchObject({ offset: 0, prevCursor: null, nextCursor: null });

    const atBottom = await list.getEntries(userId, { around: oldest.id, limit: 2 });
    expect(atBottom.entries.map((entry) => entry.content)).toEqual(['Middle', 'Oldest']);
    expect(atBottom.nextCursor).toBeNull();
    expect(atBottom.prevCursor).not.toBeNull();
  });

  it('answers 404 when the filters leave out the entry to open at', async () => {
    const archived = await write({ content: 'Archived', isArchived: true });
    const binned = await write({ content: 'Binned', date: '2026-10-06' });
    await entries.softDelete(binned.id);

    await expectApiError(list.getEntries(userId, { around: archived.id, archiveStatus: 'active' }), NotFoundException, 'ENTRY_NOT_FOUND');
    await expectApiError(list.getEntries(userId, { around: binned.id }), NotFoundException, 'ENTRY_NOT_FOUND');
    expect((await list.getEntries(userId, { around: archived.id, archiveStatus: 'all' })).entries).toHaveLength(1);
  });

  it('pages a word search by relevance, every match once, then by date when asked', async () => {
    const contents = ['harbor', 'harbor harbor harbor', 'harbor walk', 'harbor harbor', 'the old harbor at dusk', 'no match'];
    for (const [day, content] of contents.entries()) {
      await write({ date: `2026-10-0${day + 1}`, content });
    }

    const byRelevance = await scrollThrough({ search: 'harbor' }, 2);
    const single = await list.getEntries(userId, { search: 'harbor', limit: 10 });
    expect(byRelevance.ids).toEqual(single.entries.map((entry) => entry.id));
    expect(new Set(byRelevance.ids).size).toBe(5);
    expect(byRelevance.batches[0]!.entries[0]!.search_matches).toEqual(expect.arrayContaining(['harbor']));

    const byDate = await scrollThrough({ search: 'harbor', sort: 'date' }, 2);
    expect(byDate.ids).toEqual([...byDate.ids].sort((left, right) => right - left));
  });

  it('pages a meaning search in the order of its IDs', async () => {
    const written: Entry[] = [];
    for (let day = 1; day <= 4; day += 1) {
      written.push(await write({ date: `2026-10-0${day}`, content: `Day ${day}` }));
    }
    const order = [written[1]!.id, written[3]!.id, written[0]!.id];

    const { ids } = await scrollThrough({ ids: order.join(',') }, 2);

    expect(ids).toEqual(order);
  });

  it('keeps every journal filter across batches', async () => {
    for (let day = 1; day <= 6; day += 1) {
      await write({ date: `2026-10-0${day}`, content: `Day ${day}`, tags: day % 2 ? ['odd'] : ['even'], isFavorite: day > 2 });
    }

    const { ids, batches } = await scrollThrough({ tags: 'odd', favorites: true }, 1);
    const contents = (await Promise.all(ids.map((id) => entries.findOneByOrFail({ id })))).map((entry) => entry.content);

    expect(contents).toEqual(['Day 5', 'Day 3']);
    expect(batches[0]!.total).toBe(2);
  });
});
