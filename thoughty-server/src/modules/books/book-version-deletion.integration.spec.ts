import { BadRequestException } from '@nestjs/common';
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

const everything = {
  search: '',
  searchMode: 'keyword' as const,
  sort: 'relevance' as const,
  tags: [],
  date: null,
  visibility: 'all' as const,
  archiveStatus: 'active' as const,
  favorites: false,
  mood: '',
};
const plain = { format: 'md' as const, narrative: false };

/** What happens to each book version history when the place its books came from goes away. */
describePostgres('PostgreSQL book versions of deleted sources', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let versions: BookVersionsService;
  let savedSearches: SavedSearchesService;
  let writerId: number;
  let otherId: number;
  let home: Diary;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    const entries = dataSource.getRepository(Entry);
    savedSearches = new SavedSearchesService(dataSource.getRepository(SavedSearch), dataSource.getRepository(BookVersion));
    const source = new BookEntrySourceService(entries, dataSource.getRepository(Diary), savedSearches, new EntrySearchService(entries));
    const noAi = { isConfigured: jest.fn().mockResolvedValue(false) };
    const books = new BooksService(source, dataSource.getRepository(User), noAi as never, {} as never, { findAll: async () => [] } as never);
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

  const write = (date: string, content: string) =>
    dataSource.getRepository(Entry).save({ userId: writerId, diaryId: home.id, date, index: 1, tags: [], content });

  const scopeKeys = async (userId: number): Promise<string[]> =>
    (await dataSource.query('SELECT scope_key FROM book_versions WHERE user_id = $1 ORDER BY scope_key', [userId]))
      .map((row: { scope_key: string }) => row.scope_key);

  it('counts each saved search’s book versions and deletes them with it, leaving every other history', async () => {
    await write('2024-01-01', 'First.');
    const family = await savedSearches.create(writerId, { name: 'Family', diaryId: null, filters: everything });
    const trips = await savedSearches.create(writerId, { name: 'Trips', diaryId: null, filters: everything });
    await versions.create(writerId, { ...plain, source: 'savedSearch', savedSearchId: family.id });
    await versions.create(writerId, { ...plain, source: 'savedSearch', savedSearchId: family.id });
    await versions.create(writerId, { ...plain, source: 'savedSearch', savedSearchId: trips.id });
    await versions.create(writerId, plain);

    const listed = await savedSearches.list(writerId);
    expect(listed.savedSearches.map((saved) => [saved.name, saved.bookVersionCount])).toEqual([['Family', 2], ['Trips', 1]]);
    await expect(savedSearches.rename(writerId, family.id, { name: 'Kin' })).resolves.toEqual(
      expect.objectContaining({ bookVersionCount: 2 }),
    );

    await savedSearches.delete(writerId, family.id);

    expect(await scopeKeys(writerId)).toEqual(['all', `search:${trips.id}`]);
    expect(await versions.list(writerId, { source: 'savedSearch', savedSearchId: family.id })).toEqual([]);
    expect((await savedSearches.list(writerId)).savedSearches.map((saved) => [saved.name, saved.bookVersionCount]))
      .toEqual([['Trips', 1]]);
  });

  it('leaves the saved search and its versions in place when another writer tries to delete it', async () => {
    await write('2024-01-01', 'First.');
    const family = await savedSearches.create(writerId, { name: 'Family', diaryId: null, filters: everything });
    await versions.create(writerId, { ...plain, source: 'savedSearch', savedSearchId: family.id });

    await expect(savedSearches.delete(otherId, family.id)).rejects.toThrow();

    expect(await scopeKeys(writerId)).toEqual([`search:${family.id}`]);
  });

  it('deletes a diary’s journal versions with the diary and keeps the all-diaries history', async () => {
    await write('2024-01-01', 'First.');
    const travel = await dataSource.getRepository(Diary).save({ userId: writerId, name: 'Travel', position: 1 });
    await versions.create(writerId, { ...plain, diaryId: travel.id });
    await versions.create(writerId, { ...plain, diaryId: home.id });
    await versions.create(writerId, plain);

    await dataSource.getRepository(Diary).delete({ id: travel.id });

    expect(await scopeKeys(writerId)).toEqual(['all', `diary:${home.id}`]);
  });

  it('keeps hand-picked versions listed and downloadable once their entries are gone, refusing only a new one', async () => {
    const first = await write('2024-01-01', 'First.');
    const second = await write('2024-01-02', 'Second.');
    const picked = await versions.create(writerId, { ...plain, source: 'entries', entryIds: `${first.id},${second.id}` });

    await dataSource.getRepository(Entry).softDelete({ id: second.id });
    await dataSource.getRepository(Entry).delete({ id: first.id });

    expect((await versions.list(writerId, { source: 'entries' })).map((version) => version.id)).toEqual([picked.id]);
    const file = await versions.download(writerId, picked.id);
    expect(file.content.toString('utf8')).toContain('Second.');
    await expectApiError(
      versions.create(writerId, { ...plain, source: 'entries', entryIds: `${first.id},${second.id}` }),
      BadRequestException,
      'BOOK_PICKED_ENTRIES_UNAVAILABLE',
    );
  });
});
