import { DataSource, type Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { Attachment, Diary, Entry, User } from '@/database/entities';
import { EntryReaderService } from './entry-reader.service';
import { EntrySearchService } from './entry-search.service';
import type { GetEntryReaderQueryDto } from './dto';

describePostgres('PostgreSQL entry reader', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let entries: Repository<Entry>;
  let reader: EntryReaderService;
  let userId: number;
  let otherUserId: number;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    entries = dataSource.getRepository(Entry);
    reader = new EntryReaderService(entries, new EntrySearchService(entries));
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

  /** Every entry read from the first, following the next ones. */
  const readThrough = async (query: GetEntryReaderQueryDto) => {
    const ids: number[] = [];
    let page = await reader.read(userId, query);
    ids.push(page.entry.id);
    while (page.nextId !== null) {
      page = await reader.read(userId, { ...query, entryId: page.nextId });
      ids.push(page.entry.id);
    }
    return { ids, total: page.total };
  };

  it("reads the writer's matches oldest first in each day's order, whatever the pins, leaving out capsules and the bin", async () => {
    const late = await write({ date: '2026-10-03', timeOfDay: '21:00', index: 2, tags: ['walks'], isPinned: true });
    const untimed = await write({ date: '2026-10-03', index: 1, tags: ['walks'] });
    const first = await write({ date: '2026-10-01', tags: ['walks'] });
    const morning = await write({ date: '2026-10-03', timeOfDay: '08:00', index: 3, tags: ['walks'] });
    await write({ date: '2026-10-02', tags: ['walks'], sealedUntil: new Date('2040-01-01T00:00:00Z') });
    const binned = await write({ date: '2026-10-04', tags: ['walks'] });
    await entries.softDelete(binned.id);
    await write({ date: '2026-10-02', tags: ['chores'] });
    await write({ userId: otherUserId, date: '2026-09-01', tags: ['walks'] });

    await expect(readThrough({ tags: 'walks' })).resolves.toEqual({ ids: [first.id, untimed.id, morning.id, late.id], total: 4 });
    await expect(reader.read(userId, { tags: 'walks', entryId: morning.id })).resolves.toMatchObject({
      entry: { id: morning.id },
      previousId: untimed.id,
      nextId: late.id,
      position: 3,
      total: 4,
    });
  });

  it('narrows to a month or a day, and searches as the journal does', async () => {
    const september = await write({ date: '2026-09-30', content: 'Harbor in September' });
    const october = await write({ date: '2026-10-01', content: 'Harbor in October' });
    const later = await write({ date: '2026-10-31', content: 'Quiet evening' });
    await write({ date: '2026-11-01', content: 'Harbor in November' });

    await expect(readThrough({ month: '2026-10' })).resolves.toEqual({ ids: [october.id, later.id], total: 2 });
    await expect(readThrough({ date: '2026-09-30' })).resolves.toEqual({ ids: [september.id], total: 1 });
    await expect(readThrough({ search: 'harbor', month: '2026-10' })).resolves.toEqual({ ids: [october.id], total: 1 });
  });

  it('gives the entry whole, with its diary and attachments', async () => {
    const diary = await dataSource.getRepository(Diary).save({ userId, name: 'Travels', icon: 'map', position: 0 });
    const entry = await write({ diaryId: diary.id, title: 'Lisbon', content: '![tram](attachment:1)', format: 'markdown' });
    await dataSource.getRepository(Attachment).save({
      userId,
      entryId: entry.id,
      originalFilename: 'tram.jpg',
      storedFilename: 'stored-tram.jpg',
      mimetype: 'image/jpeg',
      size: 100,
    });

    const { entry: shown } = await reader.read(userId, { diaryId: diary.id });
    expect(shown).toMatchObject({ id: entry.id, title: 'Lisbon', diary_name: 'Travels', format: 'markdown' });
    expect(shown.attachments).toEqual([expect.objectContaining({ original_filename: 'tram.jpg', stored_filename: 'stored-tram.jpg' })]);
  });

  it('answers 404 when nothing matches, or for an entry that is sealed, filtered out or not the writer’s', async () => {
    const open = await write({ content: 'Calm', mood: 3 });
    const sealed = await write({ date: '2026-10-06', sealedUntil: new Date('2040-01-01T00:00:00Z') });
    const theirs = await write({ userId: otherUserId });

    await expectApiError(reader.read(userId, { mood: '1' }), NotFoundException, 'ENTRY_READER_NO_MATCH');
    for (const entryId of [sealed.id, theirs.id]) {
      await expectApiError(reader.read(userId, { entryId }), NotFoundException, 'ENTRY_READER_NOT_FOUND');
    }
    await expectApiError(reader.read(userId, { entryId: open.id, mood: '1' }), NotFoundException, 'ENTRY_READER_NOT_FOUND');
  });
});
