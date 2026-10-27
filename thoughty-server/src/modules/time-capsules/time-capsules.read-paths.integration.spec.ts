import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Diary, User } from '@/database/entities';
import { BookEntrySourceService } from '@/modules/books/book-entry-source.service';
import { EntrySearchService } from '@/modules/entries/entry-search.service';
import { StatsMoodService } from '@/modules/stats/stats-mood.service';
import { buildTimeCapsuleBed } from './time-capsules.integration.test-helpers';

/** Words only the sealed entry holds, in its title, text, tag, feeling and mention. */
const SECRETS = ['Thalassa', 'marzipan', 'lighthouse-keeper', 'wistful', 'Rosalind'];

/** Every `GET /api/entries…` route the API documents, so a new one fails this spec until it is checked here. */
function documentedEntryReadPaths(): string[] {
  const openapi = JSON.parse(readFileSync(join(__dirname, '../../../openapi/openapi.json'), 'utf8')) as {
    paths: Record<string, Record<string, unknown>>;
  };
  return Object.entries(openapi.paths)
    .filter(([path, methods]) => path.startsWith('/api/entries') && 'get' in methods)
    .map(([path]) => path)
    .sort();
}

/** What a read answers, or the error it gave: neither may carry anything of the sealed entry. */
async function answerOf(read: () => Promise<unknown>): Promise<string> {
  try {
    return JSON.stringify(await read());
  } catch (error) {
    return JSON.stringify((error as { getResponse?: () => unknown }).getResponse?.() ?? String(error));
  }
}

describePostgres('PostgreSQL time capsules: every entry read path', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let bed: ReturnType<typeof buildTimeCapsuleBed>;
  let books: BookEntrySourceService;
  let writerId: number;
  let sealedId: number;
  let openId: number;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    bed = buildTimeCapsuleBed(dataSource);
    books = new BookEntrySourceService(bed.entries, dataSource.getRepository(Diary), {} as never, new EntrySearchService(bed.entries));

    writerId = (await dataSource.getRepository(User).save({ username: 'writer', email: 'writer@example.com', emailVerified: true })).id;
    await dataSource.getRepository(Diary).save({ userId: writerId, name: 'Journal', isDefault: true, position: 0 });
    // A year ago today, so On this day would show it (the 28th for a 29 February)
    const lastYear = `${new Date().getFullYear() - 1}${new Date().toISOString().slice(4, 10).replace('-02-29', '-02-28')}`;
    ({ entryId: sealedId } = await bed.journal.create(writerId, {
      text: 'Dear me, remember marzipan at the harbor with @Rosalind. See [[2025-01-01]].',
      title: 'Thalassa',
      tags: ['lighthouse-keeper'],
      mood: 5,
      feelings: ['wistful'],
      date: lastYear,
      format: 'markdown',
      visibility: 'public',
      seal: { opensOn: `${new Date().getFullYear() + 40}-01-01`, timeZone: 'Europe/Paris' },
    }));
    ({ entryId: openId } = await bed.journal.create(writerId, { text: 'An ordinary day, see [[2025-01-01]].', tags: ['daily'], date: '2025-01-01' }));
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  it('keeps nothing of the sealed entry on its row, and keeps it private', async () => {
    const [row] = await dataSource.query('SELECT title, content, tags, mood, feelings, visibility, sealed_until FROM entries WHERE id = $1', [sealedId]);

    expect(row).toEqual({ title: null, content: '', tags: [], mood: null, feelings: [], visibility: 'private', sealed_until: expect.any(Date) });
    await expect(dataSource.query("UPDATE entries SET visibility = 'public' WHERE id = $1", [sealedId])).rejects.toThrow(/chk_entries_sealed_private/);
  });

  it('shows no word of it on any documented entry read path, and every path is checked', async () => {
    const date = (await bed.entries.findOneByOrFail({ id: sealedId })).date;
    const readers: Record<string, Array<() => Promise<unknown>>> = {
      '/api/entries': SECRETS.map((secret) => () => bed.journal.getEntries(writerId, { search: secret, page: 1, limit: 50 })).concat([
        () => bed.journal.getEntries(writerId, { page: 1, limit: 50 }),
        () => bed.journal.getEntries(writerId, { tags: 'lighthouse-keeper', page: 1, limit: 50 }),
        () => bed.journal.getEntries(writerId, { mood: '5', page: 1, limit: 50 }),
      ]),
      '/api/entries/dates': [() => bed.journal.getDates(writerId)],
      '/api/entries/calendar': [() => bed.journal.getCalendarMonth(writerId, { month: date.slice(0, 7) })],
      '/api/entries/first': [() => bed.journal.getFirstEntry(writerId, { year: date.slice(0, 4), month: date.slice(5, 7) } as never)],
      '/api/entries/by-date': [() => bed.journal.getEntryByDate(writerId, { date, index: 1 } as never), () => bed.journal.getEntryByDate(writerId, { id: sealedId } as never)],
      '/api/entries/highlights': [() => bed.journal.getHighlights(writerId, {})],
      '/api/entries/tags': [() => bed.journal.getTagUsage(writerId)],
      '/api/entries/{id}/backlinks': [() => bed.journal.getBacklinks(writerId, openId), () => bed.journal.getBacklinks(writerId, sealedId)],
      '/api/entries/{id}/history': [() => bed.journal.getRevisions(writerId, sealedId)],
      '/api/entries/feed': [() => bed.feed.getFeed(writerId, { scope: 'all', page: 1, limit: 50 } as never)],
      '/api/entries/{entryId}/comments': [() => bed.comments.list(writerId, sealedId)],
    };

    expect(Object.keys(readers).sort()).toEqual(documentedEntryReadPaths());
    // The journal still lists it, as a placeholder that says when it opens
    const listed = (await bed.journal.getEntries(writerId, { page: 1, limit: 50 })).entries.find((entry) => entry.id === sealedId);
    expect(listed).toMatchObject({ content: '', title: null, tags: [], sealed_until: expect.any(Date) });
    for (const [path, reads] of Object.entries(readers)) {
      for (const read of reads) {
        const answer = await answerOf(read);
        for (const secret of SECRETS) {
          expect(`${path}: ${answer}`).not.toContain(secret);
        }
      }
    }
  });

  it('shows no word of it in people, mood stats, books, the recycle bin, or the journal writes that read entries', async () => {
    await expect(answerOf(() => bed.people.list(writerId))).resolves.not.toContain('Rosalind');
    const elsewhere = [
      await answerOf(() => new StatsMoodService(bed.entries).analyze(writerId)),
      await answerOf(() => books.describePickedEntries(writerId, String(sealedId))),
      await answerOf(() => books.select(writerId, { source: 'journal' } as never)),
    ];
    for (const secret of SECRETS) expect(elsewhere.join('\n')).not.toContain(secret);
    expect(JSON.parse(elsewhere[1])).toEqual({ entries: [], missingIds: [sealedId] });
    await expect(bed.journal.update(writerId, sealedId, { text: 'x', tags: [], date: '2025-01-01' })).rejects.toMatchObject({ response: { code: 'ENTRY_SEALED' } });
    await expect(bed.journal.updateVisibility(writerId, sealedId, 'public')).rejects.toMatchObject({ response: { code: 'ENTRY_SEALED' } });

    await bed.journal.delete(writerId, sealedId);
    const binned = await answerOf(() => bed.bin.list(writerId));
    for (const secret of SECRETS) expect(binned).not.toContain(secret);
    expect(JSON.parse(binned).entries[0]).toMatchObject({ id: sealedId, sealedUntil: expect.any(String) });
    await bed.bin.restore(writerId, [sealedId]);

    const [{ sealed_until: sealedUntil }] = await dataSource.query('SELECT sealed_until FROM entries WHERE id = $1', [sealedId]);
    expect(sealedUntil).toBeInstanceOf(Date);
  });
});
