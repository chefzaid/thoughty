import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { BookVersion, Diary, Entry, SavedSearch, User } from '@/database/entities';
import { EntrySearchService } from '@/modules/entries';
import { SavedSearchesService } from '@/modules/saved-searches';
import { BookEntrySourceService } from './book-entry-source.service';
import { BooksService } from './books.service';
import { BookVersionsService } from './book-versions.service';

const keywordFilters = {
  search: 'river',
  searchMode: 'keyword' as const,
  sort: 'relevance' as const,
  tags: ['family'],
  date: null,
  visibility: 'all' as const,
  archiveStatus: 'active' as const,
  favorites: false,
  mood: '',
};

describePostgres('PostgreSQL book sources', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let source: BookEntrySourceService;
  let books: BooksService;
  let versions: BookVersionsService;
  let savedSearches: SavedSearchesService;
  let writerId: number;
  let otherId: number;
  let home: Diary;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    const entries = dataSource.getRepository(Entry);
    savedSearches = new SavedSearchesService(dataSource.getRepository(SavedSearch));
    source = new BookEntrySourceService(
      entries,
      dataSource.getRepository(Diary),
      savedSearches,
      new EntrySearchService(entries),
    );
    const noAi = { isConfigured: jest.fn().mockResolvedValue(false) };
    books = new BooksService(source, dataSource.getRepository(User), noAi as never, {} as never);
    versions = new BookVersionsService(dataSource.getRepository(BookVersion), books);
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const users = dataSource.getRepository(User);
    writerId = (await users.save({ username: 'writer', email: 'writer@example.com' })).id;
    otherId = (await users.save({ username: 'other', email: 'other@example.com' })).id;
    home = await dataSource.getRepository(Diary).save({ userId: writerId, name: 'Home', position: 0 });
  });

  const write = (date: string, content: string, overrides: Partial<Entry> = {}) =>
    dataSource.getRepository(Entry).save({
      userId: writerId,
      diaryId: home.id,
      date,
      index: 1,
      tags: [],
      content,
      ...overrides,
    });

  it('builds a book from a saved search’s filters as they are when it is built', async () => {
    await write('2024-01-03', 'Down by the river with mum.', { tags: ['family'] });
    await write('2024-02-10', 'The river was frozen.', { tags: ['family'], isArchived: true });
    await write('2024-03-01', 'River walk alone.', { tags: ['solo'] });
    await write('2024-04-01', 'Dinner with family.', { tags: ['family'] });
    const trashed = await write('2024-05-01', 'Rivers and family.', { tags: ['family'] });
    await dataSource.getRepository(Entry).softDelete({ id: trashed.id });
    const saved = await savedSearches.create(writerId, { name: 'Family rivers', diaryId: home.id, filters: keywordFilters });

    const preview = await books.preview(writerId, { source: 'savedSearch', savedSearchId: saved.id, chapterMode: 'single' });

    expect(preview).toEqual(expect.objectContaining({ title: 'Family rivers', chapterCount: 1, entryCount: 1 }));
    expect(preview.chapters[0]).toEqual(expect.objectContaining({ title: 'Family rivers', firstDate: '2024-01-03' }));

    await expectApiError(
      books.preview(otherId, { source: 'savedSearch', savedSearchId: saved.id }),
      NotFoundException,
      'SAVED_SEARCH_NOT_FOUND',
    );
  });

  it('builds a hand-picked book by month, refusing another writer’s entries and the recycle bin', async () => {
    const may = await write('2024-05-02', 'A May morning.', { isArchived: true });
    const june = await write('2024-06-12', 'A June evening.');
    await write('2024-06-13', 'Not picked.');
    const others = await dataSource.getRepository(Entry).save({
      userId: otherId, date: '2024-06-01', index: 1, tags: [], content: 'Someone else.',
    });

    const preview = await books.preview(writerId, {
      source: 'entries',
      entryIds: `${june.id},${may.id}`,
      chapterMode: 'month',
    });
    expect(preview.chapters.map((chapter) => [chapter.title, chapter.entryCount])).toEqual([['May 2024', 1], ['June 2024', 1]]);

    await expectApiError(
      books.preview(writerId, { source: 'entries', entryIds: `${june.id},${others.id}` }),
      BadRequestException,
      'BOOK_PICKED_ENTRIES_UNAVAILABLE',
    );
    await dataSource.getRepository(Entry).softDelete({ id: june.id });
    await expectApiError(
      books.preview(writerId, { source: 'entries', entryIds: `${june.id},${may.id}` }),
      BadRequestException,
      'BOOK_PICKED_ENTRIES_UNAVAILABLE',
    );

    const described = await source.describePickedEntries(writerId, `${may.id},${june.id},${others.id}`);
    expect(described.entries.map((entry) => [entry.id, entry.diaryName, entry.isArchived])).toEqual([[may.id, 'Home', true]]);
    expect(described.missingIds).toEqual([june.id, others.id]);
  });

  it('keeps each source’s versions apart and records the source of each', async () => {
    const first = await write('2024-01-01', 'First.');
    const second = await write('2024-01-02', 'Second.');
    const saved = await savedSearches.create(writerId, {
      name: 'Everything', diaryId: null, filters: { ...keywordFilters, search: '', tags: [] },
    });
    const plain = { format: 'md' as const, narrative: false };

    await versions.create(writerId, { ...plain, diaryId: home.id });
    await versions.create(writerId, { ...plain, source: 'entries', entryIds: `${first.id}` });
    const picked = await versions.create(writerId, { ...plain, source: 'entries', entryIds: `${first.id},${second.id}` });
    const fromSearch = await versions.create(writerId, { ...plain, source: 'savedSearch', savedSearchId: saved.id });

    expect(picked).toEqual(expect.objectContaining({
      versionNumber: 2,
      addedEntryCount: 1,
      source: { kind: 'entries', entryIds: [first.id, second.id] },
    }));
    expect(fromSearch).toEqual(expect.objectContaining({
      versionNumber: 1,
      entryCount: 2,
      title: 'Everything',
      source: { kind: 'savedSearch', savedSearchId: saved.id, savedSearchName: 'Everything' },
    }));
    expect((await versions.list(writerId, { diaryId: home.id })).map((version) => version.source))
      .toEqual([{ kind: 'journal', diaryId: home.id }]);
    expect((await versions.list(writerId, { source: 'entries' })).map((version) => version.versionNumber)).toEqual([2, 1]);
    expect(await versions.list(otherId, { source: 'entries' })).toEqual([]);
    const [stored] = await dataSource.query('SELECT source FROM book_versions WHERE id = $1', [picked.id]);
    expect(stored.source).toEqual({ kind: 'entries', entryIds: [first.id, second.id] });
  });
});
