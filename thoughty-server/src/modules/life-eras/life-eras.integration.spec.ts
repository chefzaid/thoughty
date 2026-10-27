import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { BookVersion, Diary, Entry, EntryRevision, LifeEra, SavedSearch, User } from '@/database/entities';
import { EntryListCacheService, EntrySearchService } from '@/modules/entries';
import { EntriesQueryService } from '@/modules/entries/entries-query.service';
import { EntryCalendarService } from '@/modules/entries/entry-calendar.service';
import { SavedSearchesService } from '@/modules/saved-searches';
import { BookEntrySourceService } from '@/modules/books/book-entry-source.service';
import { BooksService } from '@/modules/books/books.service';
import { LIFE_ERA_LIMIT } from './dto';
import { LifeErasService } from './life-eras.service';

const anyFilters = {
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

describePostgres('PostgreSQL life eras', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let service: LifeErasService;
  let queries: EntriesQueryService;
  let calendar: EntryCalendarService;
  let savedSearches: SavedSearchesService;
  let books: BooksService;
  let writerId: number;
  let otherId: number;
  let home: Diary;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    const entries = dataSource.getRepository(Entry);
    const search = new EntrySearchService(entries);
    service = new LifeErasService(dataSource.getRepository(LifeEra), new EntryListCacheService({}));
    queries = new EntriesQueryService(entries, dataSource.getRepository(EntryRevision), search);
    calendar = new EntryCalendarService(entries, search);
    savedSearches = new SavedSearchesService(dataSource.getRepository(SavedSearch), dataSource.getRepository(BookVersion));
    const source = new BookEntrySourceService(entries, dataSource.getRepository(Diary), savedSearches, search);
    const noAi = { isConfigured: jest.fn().mockResolvedValue(false) };
    books = new BooksService(source, dataSource.getRepository(User), noAi as never, {} as never, service);
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const users = dataSource.getRepository(User);
    writerId = (await users.save({ username: 'writer', email: 'writer@example.com' })).id;
    otherId = (await users.save({ username: 'other', email: 'other@example.com' })).id;
    home = await dataSource.getRepository(Diary).save({ userId: writerId, name: 'Home', position: 0 });
  });

  const write = (date: string, content: string, userId = writerId) =>
    dataSource.getRepository(Entry).save({ userId, diaryId: userId === writerId ? home.id : null, date, index: 1, tags: [], content });

  it('keeps each writer’s eras apart, by start date, with one name each whatever its case', async () => {
    const paris = await service.create(writerId, { name: 'The Paris years', startDate: '2015-01-01' });
    const university = await service.create(writerId, { name: 'University', startDate: '2010-09-01', endDate: '2014-06-30', color: '#2A9D8F', emoji: '🎓' });
    await service.create(otherId, { name: 'University', startDate: '2001-01-01' });

    const { lifeEras, limit } = await service.list(writerId);
    expect(limit).toBe(LIFE_ERA_LIMIT);
    expect(lifeEras.map((era) => [era.name, era.startDate, era.endDate])).toEqual([
      ['University', '2010-09-01', '2014-06-30'],
      ['The Paris years', '2015-01-01', null],
    ]);
    expect(lifeEras[0]).toEqual(expect.objectContaining({ color: '#2A9D8F', emoji: '🎓', note: null }));

    await expectApiError(service.create(writerId, { name: 'UNIVERSITY', startDate: '2020-01-01' }), ConflictException, 'LIFE_ERA_NAME_TAKEN');
    await expectApiError(service.update(writerId, paris.id, { name: 'university' }), ConflictException, 'LIFE_ERA_NAME_TAKEN');
    await expectApiError(service.update(writerId, university.id, { endDate: '2009-01-01' }), BadRequestException, 'LIFE_ERA_DATES_INVALID');
    await expectApiError(service.update(otherId, university.id, { name: 'Mine' }), NotFoundException, 'LIFE_ERA_NOT_FOUND');
    await expectApiError(service.delete(otherId, university.id), NotFoundException, 'LIFE_ERA_NOT_FOUND');

    await expect(service.update(writerId, paris.id, { endDate: '2019-12-31', note: 'Montmartre' }))
      .resolves.toEqual(expect.objectContaining({ endDate: '2019-12-31', note: 'Montmartre' }));
  });

  it('refuses an end before the start in the database too', async () => {
    await expect(dataSource.query(
      `INSERT INTO life_eras (user_id, name, start_date, end_date) VALUES ($1, 'Backwards', '2020-01-02', '2020-01-01')`,
      [writerId],
    )).rejects.toThrow(/chk_life_eras_dates/);
  });

  it('holds the limit for concurrent requests', async () => {
    await dataSource.query(
      `INSERT INTO life_eras (user_id, name, start_date) SELECT $1, 'Era ' || n, '2000-01-01' FROM generate_series(1, $2) n`,
      [writerId, LIFE_ERA_LIMIT - 1],
    );
    const results = await Promise.allSettled([
      service.create(writerId, { name: 'Last A', startDate: '2001-01-01' }),
      service.create(writerId, { name: 'Last B', startDate: '2001-01-01' }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const [{ count }] = await dataSource.query('SELECT COUNT(*)::int AS count FROM life_eras WHERE user_id = $1', [writerId]);
    expect(count).toBe(LIFE_ERA_LIMIT);
    await expectApiError(service.create(writerId, { name: 'Too many', startDate: '2001-01-01' }), BadRequestException, 'LIFE_ERA_LIMIT_REACHED');
  });

  it('filters the journal and the calendar to an era’s dates, its first and last days included', async () => {
    const university = await service.create(writerId, { name: 'University', startDate: '2010-09-01', endDate: '2014-06-30' });
    const paris = await service.create(writerId, { name: 'Paris', startDate: '2014-06-30' });
    await write('2010-08-31', 'Before.');
    await write('2010-09-01', 'First day.');
    await write('2014-06-30', 'Last day.');
    await write('2014-07-01', 'After.');
    await write('2024-01-01', 'Recent.');
    await write('2012-01-01', 'Someone else.', otherId);

    const listed = async (eraId: number, userId = writerId) =>
      (await queries.getEntries(userId, { eraId, limit: 20 })).entries.map((entry) => entry.content).sort();
    expect(await listed(university.id)).toEqual(['First day.', 'Last day.']);
    expect(await listed(paris.id)).toEqual(['After.', 'Last day.', 'Recent.']);
    // Another writer's era matches none of their own entries
    expect(await listed(university.id, otherId)).toEqual([]);

    const month = await calendar.getMonth(writerId, { month: '2014-06', eraId: paris.id });
    expect(month.entries.map((entry) => entry.date)).toEqual(['2014-06-30']);
  });

  it('keeps an era in saved searches and their books, and widens them when the era is deleted', async () => {
    const university = await service.create(writerId, { name: 'University', startDate: '2010-09-01', endDate: '2014-06-30' });
    await write('2011-03-01', 'Exams.');
    await write('2016-03-01', 'Later.');
    await expectApiError(
      savedSearches.create(otherId, { name: 'Theirs', diaryId: null, filters: { ...anyFilters, eraId: university.id } }),
      NotFoundException,
      'LIFE_ERA_NOT_FOUND',
    );
    const saved = await savedSearches.create(writerId, { name: 'Uni', diaryId: null, filters: { ...anyFilters, eraId: university.id } });
    const old = await savedSearches.create(writerId, { name: 'Before eras', diaryId: null, filters: anyFilters });
    await dataSource.query(`UPDATE saved_searches SET filters = filters - 'eraId' WHERE id = $1`, [old.id]);

    const preview = await books.preview(writerId, { source: 'savedSearch', savedSearchId: saved.id, chapterMode: 'single' });
    expect(preview.entryCount).toBe(1);
    expect((await savedSearches.list(writerId)).savedSearches.map((search) => [search.name, search.filters.eraId]))
      .toEqual([['Before eras', null], ['Uni', university.id]]);

    await service.delete(writerId, university.id);
    const widened = await savedSearches.findOwn(writerId, saved.id);
    expect(widened.filters.eraId).toBeNull();
    expect((await books.preview(writerId, { source: 'savedSearch', savedSearchId: saved.id, chapterMode: 'single' })).entryCount).toBe(2);
  });

  it('outlines a journal book with one chapter per era, overlaps going to the shortest era', async () => {
    await service.create(writerId, { name: 'University', startDate: '2010-09-01', endDate: '2014-06-30' });
    await service.create(writerId, { name: 'Erasmus', startDate: '2012-09-01', endDate: '2013-06-30' });
    await service.create(otherId, { name: 'Childhood', startDate: '1990-01-01', endDate: '2009-12-31' });
    await write('2011-01-01', 'Lectures.');
    await write('2013-01-01', 'Lisbon.');
    await write('2008-01-01', 'School.');

    const preview = await books.preview(writerId, { diaryId: home.id, chapterMode: 'eras' });
    expect(preview.chapters.map((chapter) => [chapter.title, chapter.entryCount])).toEqual([
      ['University', 1],
      ['Erasmus', 1],
      ['Other', 1],
    ]);
    const withoutOther = await books.preview(writerId, { diaryId: home.id, chapterMode: 'eras', includeUntagged: false });
    expect(withoutOther.chapters.map((chapter) => chapter.title)).toEqual(['University', 'Erasmus']);
  });
});
