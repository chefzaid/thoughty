import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Attachment, BookVersion, Diary, Entry, EntryRevision, Person, SavedSearch, Setting, User } from '@/database/entities';
import { EntryInlineImagesService, EntryListCacheService, EntryMentionsService, EntrySearchService } from '@/modules/entries';
import { EntriesCommandService } from '@/modules/entries/entries-command.service';
import { EntriesQueryService } from '@/modules/entries/entries-query.service';
import { EntryCalendarService } from '@/modules/entries/entry-calendar.service';
import { IoService } from '@/modules/io/io.service';
import { RecycleBinService } from '@/modules/recycle-bin/recycle-bin.service';
import { SavedSearchesService } from '@/modules/saved-searches';
import { PeopleService } from './people.service';
import { timeCapsuleServiceOn } from '@/modules/time-capsules/time-capsules.test-helpers';

const anyFilters = {
  search: '',
  searchMode: 'keyword' as const,
  sort: 'relevance' as const,
  tags: [],
  date: null,
  visibility: 'all' as const,
  archiveStatus: 'all' as const,
  favorites: false,
  mood: '',
};

describePostgres('PostgreSQL people', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let people: PeopleService;
  let commands: EntriesCommandService;
  let queries: EntriesQueryService;
  let calendar: EntryCalendarService;
  let bin: RecycleBinService;
  let io: IoService;
  let savedSearches: SavedSearchesService;
  let writerId: number;
  let otherId: number;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    const entries = dataSource.getRepository(Entry);
    const mentions = new EntryMentionsService(entries);
    const configService = { getConfig: jest.fn().mockResolvedValue({ maxPinnedEntries: '3' }) };
    const cache = new EntryListCacheService({});
    commands = new EntriesCommandService(
      entries,
      dataSource.getRepository(EntryRevision),
      dataSource.getRepository(Diary),
      { resolveSavedTags: async (_user: number, _text: string, tags: string[]) => tags } as never,
      configService as never,
      mentions,
      timeCapsuleServiceOn(dataSource),
      new EntryInlineImagesService(dataSource.getRepository(Attachment), entries),
    );
    const search = new EntrySearchService(entries);
    queries = new EntriesQueryService(entries, dataSource.getRepository(EntryRevision), search, timeCapsuleServiceOn(dataSource));
    calendar = new EntryCalendarService(entries, search);
    bin = new RecycleBinService(
      dataSource,
      entries,
      dataSource.getRepository(Attachment),
      { removeStoredFiles: jest.fn() } as never,
      configService as never,
      cache,
    );
    io = new IoService(entries, dataSource.getRepository(Setting), dataSource.getRepository(Diary), dataSource.getRepository(User), mentions, timeCapsuleServiceOn(dataSource), { getFileBuffer: jest.fn() } as never);
    savedSearches = new SavedSearchesService(dataSource.getRepository(SavedSearch), dataSource.getRepository(BookVersion));
    people = new PeopleService(dataSource.getRepository(Person), cache);
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const users = dataSource.getRepository(User);
    writerId = (await users.save({ username: 'writer', email: 'writer@example.com' })).id;
    otherId = (await users.save({ username: 'other', email: 'other@example.com' })).id;
    await dataSource.getRepository(Diary).save({ userId: writerId, name: 'Home', isDefault: true, position: 0 });
  });

  const write = async (date: string, text: string, userId = writerId) =>
    (await commands.create(userId, { date, text, tags: [] })).entryId;
  const edit = (id: number, date: string, text: string) => commands.update(writerId, id, { date, text, tags: [] });
  const summary = async (userId = writerId) =>
    (await people.list(userId)).people.map((person) => [person.name, person.handles, person.entryCount, person.lastMentionedOn]);
  const mentioning = async (personId: number, userId = writerId) =>
    (await queries.getEntries(userId, { personId, archiveStatus: 'all', limit: 20 })).entries.map((entry) => entry.content).sort();
  const personNamed = async (name: string) => (await people.list(writerId)).people.find((person) => person.name === name)!;

  it('adds people from mentions whatever their case, and counts the entries that mention them', async () => {
    await write('2026-10-01', 'Coffee with @Marie and @Jean-Paul.');
    await write('2026-10-05', 'Called @marie, mail marie@example.com, `@code`.');
    await write('2026-10-03', 'Met @Marie at the market.', otherId);

    expect(await summary()).toEqual([
      ['Jean-Paul', ['jean-paul'], 1, '2026-10-01'],
      ['Marie', ['marie'], 2, '2026-10-05'],
    ]);
    expect(await summary(otherId)).toEqual([['Marie', ['marie'], 1, '2026-10-03']]);

    const marie = await personNamed('Marie');
    expect(await mentioning(marie.id)).toEqual([
      'Called @marie, mail marie@example.com, `@code`.',
      'Coffee with @Marie and @Jean-Paul.',
    ]);
    // Another writer's person matches none of the writer's entries, and the reverse
    expect(await mentioning(marie.id, otherId)).toEqual([]);
    const month = await calendar.getMonth(writerId, { month: '2026-10', personId: marie.id });
    expect(month.entries.map((entry) => entry.date)).toEqual(['2026-10-01', '2026-10-05']);
  });

  it('follows edits, the recycle bin and purges', async () => {
    const first = await write('2026-10-01', 'Lunch with @Marie.');
    const second = await write('2026-10-02', 'Walk with @Marie.');
    await edit(second, '2026-10-02', 'Walk with @Paul.');
    expect(await summary()).toEqual([['Marie', ['marie'], 1, '2026-10-01'], ['Paul', ['paul'], 1, '2026-10-02']]);

    await commands.delete(writerId, first);
    expect(await summary()).toEqual([['Marie', ['marie'], 0, null], ['Paul', ['paul'], 1, '2026-10-02']]);
    await bin.restore(writerId, [first]);
    expect((await personNamed('Marie')).entryCount).toBe(1);

    await commands.delete(writerId, first);
    await bin.deletePermanently(writerId, [first]);
    const [{ count }] = await dataSource.query('SELECT COUNT(*)::int AS count FROM entry_people WHERE entry_id = $1', [first]);
    expect(count).toBe(0);
    expect((await personNamed('Marie')).entryCount).toBe(0);
  });

  it('links imported entries too', async () => {
    await io.import(writerId, {
      content: JSON.stringify([{ date: '2026-09-01', content: 'Trip with @Élodie' }, { date: '2026-09-02', content: '@élodie again' }]),
    });

    expect(await summary()).toEqual([['Élodie', ['élodie'], 2, '2026-09-02']]);
  });

  it('adds one person when two entries mention someone new at the same time', async () => {
    await Promise.all([write('2026-10-01', 'Hi @Newcomer'), write('2026-10-01', 'Bye @newcomer')]);

    // Whichever save takes the people lock first adds the person, so the name is its spelling.
    const [[name, ...rest], ...others] = await summary();
    expect(['Newcomer', 'newcomer']).toContain(name);
    expect(rest).toEqual([['newcomer'], 2, '2026-10-01']);
    expect(others).toEqual([]);
  });

  it('renames the name shown and merges a duplicate whose handle then names the person kept', async () => {
    await write('2026-10-01', 'With @Marie');
    await write('2026-10-02', 'With @MarieC and @Marie');
    const marie = await personNamed('Marie');
    const duplicate = await personNamed('MarieC');
    const saved = await savedSearches.create(writerId, { name: 'Duplicate', diaryId: null, filters: { ...anyFilters, personId: duplicate.id } });

    await expect(people.rename(writerId, marie.id, { name: 'Marie Curie' })).resolves.toEqual(expect.objectContaining({ name: 'Marie Curie' }));
    await expectApiError(people.rename(otherId, marie.id, { name: 'Mine' }), NotFoundException, 'PERSON_NOT_FOUND');
    await expectApiError(people.merge(writerId, marie.id, { duplicateId: marie.id }), BadRequestException, 'PERSON_MERGE_SAME');
    await expectApiError(people.merge(otherId, marie.id, { duplicateId: duplicate.id }), NotFoundException, 'PERSON_NOT_FOUND');

    const merged = await people.merge(writerId, marie.id, { duplicateId: duplicate.id });
    expect([merged.name, merged.handles, merged.entryCount]).toEqual(['Marie Curie', ['marie', 'mariec'], 2]);
    expect((await savedSearches.findOwn(writerId, saved.id)).filters.personId).toBe(marie.id);

    await write('2026-10-03', 'Later with @mariec');
    expect(await summary()).toEqual([['Marie Curie', ['marie', 'mariec'], 3, '2026-10-03']]);
  });

  it('deletes a person, keeping the text and widening saved searches, and a new mention adds them again', async () => {
    const entryId = await write('2026-10-01', 'With @Marie');
    const marie = await personNamed('Marie');
    const saved = await savedSearches.create(writerId, { name: 'Marie', diaryId: null, filters: { ...anyFilters, personId: marie.id } });
    await expectApiError(
      savedSearches.create(otherId, { name: 'Theirs', diaryId: null, filters: { ...anyFilters, personId: marie.id } }),
      NotFoundException,
      'PERSON_NOT_FOUND',
    );

    await expectApiError(people.delete(otherId, marie.id), NotFoundException, 'PERSON_NOT_FOUND');
    await expect(people.delete(writerId, marie.id)).resolves.toEqual({ success: true });

    expect(await summary()).toEqual([]);
    expect((await dataSource.getRepository(Entry).findOneByOrFail({ id: entryId })).content).toBe('With @Marie');
    expect((await savedSearches.findOwn(writerId, saved.id)).filters.personId).toBeNull();

    await edit(entryId, '2026-10-01', 'With @Marie, again');
    expect(await summary()).toEqual([['Marie', ['marie'], 1, '2026-10-01']]);
  });

  it('links the entries written before people existed when the migration runs, leaving e-mails, code and links alone', async () => {
    await dataSource.query(
      `INSERT INTO entries (user_id, date, content, deleted_at) VALUES ($1, '2026-01-01', 'Old note on @Ana', NULL),
         ($1, '2026-01-02', 'Binned note on @ana', NOW()), ($2, '2026-01-03', '@Bo', NULL),
         ($1, '2026-01-04', 'Mail ana@x.org, see \`@code\`, https://x.com/@web and [[2026-01-01]]', NULL)`,
      [writerId, otherId],
    );

    // Roll back to just before the people migration (any later one first), then run them all again
    let undone: string | undefined;
    while (undone !== 'People1786665600000') {
      [{ name: undone }] = (await dataSource.query('SELECT name FROM migrations ORDER BY id DESC LIMIT 1')) as Array<{ name: string }>;
      await dataSource.undoLastMigration({ transaction: 'all' });
    }
    await dataSource.runMigrations({ transaction: 'all' });

    expect(await summary()).toEqual([['Ana', ['ana'], 1, '2026-01-01']]);
    const [{ links }] = await dataSource.query('SELECT COUNT(*)::int AS links FROM entry_people');
    expect(links).toBe(3);
    expect(await summary(otherId)).toEqual([['Bo', ['bo'], 1, '2026-01-03']]);
  });
});
