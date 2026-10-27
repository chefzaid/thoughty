import { DataSource, type Logger } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Entry, EntryRevision, User } from '@/database/entities';
import { timeCapsuleServiceOn } from '@/modules/time-capsules/time-capsules.test-helpers';
import type { EntriesListResponseDto, GetEntriesQueryDto } from './dto';
import { EntriesQueryService } from './entries-query.service';
import { EntryListCacheService } from './entry-list-cache.service';
import { EntrySearchService } from './entry-search.service';

/** Every journal filter at once, so the list query reads every table it can. */
const EVERY_FILTER: GetEntriesQueryDto = {
  search: 'walk',
  sort: 'date',
  tags: 'outside',
  visibility: 'private',
  diaryId: 1,
  favorites: true,
  archiveStatus: 'active',
  mood: '4',
  eraId: 1,
  personId: 1,
  ids: '1,2',
  date: '2024-05-01',
};

/** Records the SQL a data source runs. */
class QueryRecorder implements Logger {
  readonly queries: string[] = [];
  logQuery(query: string): void {
    this.queries.push(query);
  }
  logQueryError(): void {}
  logQuerySlow(): void {}
  logSchemaBuild(): void {}
  logMigration(): void {}
  log(): void {}
}

/**
 * The journal list cache against the triggers that version each writer's list: whichever table the
 * list reads, and whoever writes it (another connection stands in for another API replica or the
 * worker, and raw SQL for any service), the next read after the commit is fresh.
 */
describePostgres('PostgreSQL entry list cache', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  /** A second connection pool: another replica, the worker, or any process writing the database. */
  let elsewhere: DataSource;
  let recorder: QueryRecorder;
  let queries: EntriesQueryService;
  let cache: EntryListCacheService;
  let writerId: number;
  let otherId: number;
  let diaryId: number;
  let loads: number;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    recorder = new QueryRecorder();
    elsewhere = await new DataSource({ ...dataSource.options, migrations: [], logger: recorder } as never).initialize();
    const entries = dataSource.getRepository(Entry);
    queries = new EntriesQueryService(entries, dataSource.getRepository(EntryRevision), new EntrySearchService(entries), timeCapsuleServiceOn(dataSource));
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => {
    await elsewhere?.destroy();
    await database?.drop();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const users = dataSource.getRepository(User);
    writerId = (await users.save({ username: 'writer', email: 'writer@example.com' })).id;
    otherId = (await users.save({ username: 'other', email: 'other@example.com' })).id;
    [{ id: diaryId }] = await dataSource.query(`INSERT INTO diaries (user_id, name) VALUES ($1, 'Home') RETURNING id`, [writerId]);
    cache = new EntryListCacheService(dataSource, { ENTRIES_CACHE_TTL_SECONDS: '600' });
    loads = 0;
  });

  /** The writer's list through the cache, counting the reads that reached the entries. */
  const list = (query: GetEntriesQueryDto = {}, userId = writerId): Promise<EntriesListResponseDto> =>
    cache.getOrLoad(userId, query, () => {
      loads += 1;
      return queries.getEntries(userId, query);
    });

  const insertEntry = async (content: string, date = '2024-05-01', userId = writerId): Promise<number> => {
    const [{ id }] = await elsewhere.query(
      `INSERT INTO entries (user_id, diary_id, date, "index", content) VALUES ($1, $2, $3, 1, $4) RETURNING id`,
      [userId, userId === writerId ? diaryId : null, date, content],
    );
    return id;
  };

  const version = async (userId = writerId): Promise<string | undefined> =>
    (await dataSource.query('SELECT version FROM entry_list_versions WHERE user_id = $1', [userId]))[0]?.version;

  it('watches every table the journal list reads', async () => {
    const elsewhereQueries = new EntriesQueryService(
      elsewhere.getRepository(Entry),
      elsewhere.getRepository(EntryRevision),
      new EntrySearchService(elsewhere.getRepository(Entry)),
      timeCapsuleServiceOn(elsewhere),
    );
    recorder.queries.length = 0;
    await elsewhereQueries.getEntries(writerId, EVERY_FILTER);
    await elsewhereQueries.getEntries(writerId, { ...EVERY_FILTER, search: '"walk"', ids: undefined });

    const tables: string[] = (await dataSource.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = current_schema()`,
    )).map(({ tablename }: { tablename: string }) => tablename);
    const read = new Set(
      recorder.queries.flatMap((sql) => [...sql.matchAll(/\b(?:FROM|JOIN)\s+"?(\w+)"?/gi)].map((match) => match[1]!)),
    );
    const readTables = tables.filter((table) => read.has(table)).sort();
    const watched: string[] = (await dataSource.query(
      `SELECT DISTINCT event_object_table AS "table" FROM information_schema.triggers
        WHERE trigger_name = 'trg_' || event_object_table || '_entry_list_version'`,
    )).map(({ table }: { table: string }) => table).sort();

    expect(readTables).toEqual(expect.arrayContaining(['attachments', 'diaries', 'entries', 'entry_people', 'life_eras']));
    expect(watched).toEqual(readTables);
  });

  it('serves the cached list while nothing changes', async () => {
    await insertEntry('Morning walk');
    await list();
    await list();

    expect(loads).toBe(1);
  });

  it('shows entries written, changed and moved to the recycle bin from another connection at once', async () => {
    expect((await list()).total).toBe(0);
    const id = await insertEntry('Morning walk');
    expect((await list()).entries.map((entry) => entry.content)).toEqual(['Morning walk']);

    await elsewhere.query(`UPDATE entries SET content = 'Evening walk', tags = '{outside}' WHERE id = $1`, [id]);
    expect((await list()).entries[0]).toEqual(expect.objectContaining({ content: 'Evening walk', tags: ['outside'] }));
    expect((await list()).allTags).toEqual(['outside']);

    await elsewhere.query('UPDATE entries SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    expect((await list()).total).toBe(0);
    await elsewhere.query('UPDATE entries SET deleted_at = NULL WHERE id = $1', [id]);
    expect((await list()).total).toBe(1);
    await elsewhere.query('DELETE FROM entries WHERE id = $1', [id]);
    expect((await list()).total).toBe(0);
  });

  it('shows attachments added to or taken from an entry at once', async () => {
    const id = await insertEntry('Pier');
    expect((await list()).entries[0]!.attachments).toEqual([]);

    const [{ id: attachmentId }] = await elsewhere.query(
      `INSERT INTO attachments (user_id, entry_id, original_filename, stored_filename, mimetype, size)
       VALUES ($1, $2, 'pier.png', 'stored.png', 'image/png', 1) RETURNING id`,
      [writerId, id],
    );
    expect((await list()).entries[0]!.attachments!.map((attachment) => attachment.id)).toEqual([attachmentId]);

    await elsewhere.query(`UPDATE attachments SET transcript = 'Waves' WHERE id = $1`, [attachmentId]);
    expect((await list()).entries[0]!.attachments![0]!.transcript).toBe('Waves');

    await elsewhere.query('DELETE FROM attachments WHERE id = $1', [attachmentId]);
    expect((await list()).entries[0]!.attachments).toEqual([]);
  });

  it('shows a renamed diary at once', async () => {
    await insertEntry('Pier');
    expect((await list()).entries[0]!.diary_name).toBe('Home');

    await elsewhere.query(`UPDATE diaries SET name = 'Travel' WHERE id = $1`, [diaryId]);
    expect((await list()).entries[0]!.diary_name).toBe('Travel');
  });

  it('follows a life era’s dates at once', async () => {
    await insertEntry('Pier', '2024-05-01');
    const [{ id: eraId }] = await elsewhere.query(
      `INSERT INTO life_eras (user_id, name, start_date) VALUES ($1, 'Seaside', '2024-06-01') RETURNING id`,
      [writerId],
    );
    expect((await list({ eraId })).total).toBe(0);

    await elsewhere.query(`UPDATE life_eras SET start_date = '2024-01-01' WHERE id = $1`, [eraId]);
    expect((await list({ eraId })).total).toBe(1);

    await elsewhere.query('DELETE FROM life_eras WHERE id = $1', [eraId]);
    expect((await list({ eraId })).total).toBe(0);
  });

  it('follows the people an entry mentions at once, also when the person goes', async () => {
    const id = await insertEntry('Lunch with @sam');
    const [{ id: personId }] = await elsewhere.query(
      `INSERT INTO people (user_id, name) VALUES ($1, 'Sam') RETURNING id`,
      [writerId],
    );
    expect((await list({ personId })).total).toBe(0);

    await elsewhere.query('INSERT INTO entry_people (entry_id, person_id) VALUES ($1, $2)', [id, personId]);
    expect((await list({ personId })).total).toBe(1);

    await elsewhere.query('DELETE FROM people WHERE id = $1', [personId]);
    expect((await list({ personId })).total).toBe(0);
  });

  it('moves the version once per transaction, in its commit, and not at all when it rolls back', async () => {
    await insertEntry('First');
    const before = Number(await version());

    const runner = elsewhere.createQueryRunner();
    await runner.startTransaction();
    for (const content of ['Second', 'Third', 'Fourth']) {
      await runner.query(
        `INSERT INTO entries (user_id, diary_id, date, "index", content) VALUES ($1, $2, '2024-05-02', 1, $3)`,
        [writerId, diaryId, content],
      );
    }
    expect(Number(await version())).toBe(before);
    await runner.commitTransaction();
    expect(Number(await version())).toBe(before + 1);

    await runner.startTransaction();
    await runner.query(`UPDATE entries SET content = 'Gone' WHERE user_id = $1`, [writerId]);
    await runner.rollbackTransaction();
    await runner.release();
    expect(Number(await version())).toBe(before + 1);
  });

  it('keeps each writer’s cached lists when only another writer’s journal changes', async () => {
    await list();
    await insertEntry('Not yours', '2024-05-01', otherId);
    await list();

    expect(loads).toBe(1);
    expect(await version(otherId)).toBe('1');
  });

  it('lets an account go with its journal, leaving no version behind', async () => {
    const id = await insertEntry('Pier');
    const [{ id: personId }] = await elsewhere.query(`INSERT INTO people (user_id, name) VALUES ($1, 'Sam') RETURNING id`, [writerId]);
    await elsewhere.query('INSERT INTO entry_people (entry_id, person_id) VALUES ($1, $2)', [id, personId]);
    expect(await version()).toBeDefined();

    await elsewhere.query('DELETE FROM users WHERE id = $1', [writerId]);

    expect(await version()).toBeUndefined();
  });

  it('rolls back to a schema without the versions, and forward again', async () => {
    const executed = (await dataSource.query('SELECT name FROM migrations ORDER BY id DESC')) as Array<{ name: string }>;
    for (const { name } of executed) {
      await dataSource.undoLastMigration({ transaction: 'all' });
      if (name === 'EntryListVersions1787270400000') break;
    }
    const left = await dataSource.query(
      `SELECT tgname FROM pg_trigger WHERE tgname LIKE '%entry_list_version'
       UNION ALL SELECT proname FROM pg_proc WHERE proname IN ('entry_list_changed', 'bump_entry_list_version')
       UNION ALL SELECT tablename FROM pg_tables WHERE tablename = 'entry_list_versions'`,
    );
    expect(left).toEqual([]);
    await insertEntry('Written without versions');

    await dataSource.runMigrations({ transaction: 'all' });
    await insertEntry('Versioned again');
    expect(await version()).toBe('1');
  });
});
