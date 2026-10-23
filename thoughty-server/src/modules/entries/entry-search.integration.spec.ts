import { join } from 'node:path';
import { DataSource, type Repository } from 'typeorm';
import { Entry, EntryRevision, User } from '@/database/entities';
import { EntriesQueryService } from './entries-query.service';
import { EntrySearchService } from './entry-search.service';
import type { GetEntriesQueryDto } from './dto';

const url = process.env.THOUGHTY_PG_TEST_URL;
if (url && (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname) || new URL(url).pathname !== '/thoughty_ha_test')) {
  throw new Error('Use the isolated thoughty_ha_test localhost fixture');
}
const integration = url ? describe : describe.skip;

integration('PostgreSQL full-text entry search', () => {
  let dataSource: DataSource;
  let entries: Repository<Entry>;
  let queries: EntriesQueryService;
  let userId: number;
  let otherUserId: number;

  beforeAll(async () => {
    dataSource = await new DataSource({
      type: 'postgres',
      url,
      entities: [join(__dirname, '..', '..', 'database', 'entities', '*.entity.ts')],
      migrations: [join(__dirname, '..', '..', 'database', 'migrations', '*.ts')],
    }).initialize();
    await dataSource.runMigrations({ transaction: 'all' });
    entries = dataSource.getRepository(Entry);
    queries = new EntriesQueryService(entries, dataSource.getRepository(EntryRevision), new EntrySearchService(entries));
  });
  afterAll(async () => { await dataSource.destroy(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const users = dataSource.getRepository(User);
    userId = (await users.save({ username: 'writer', email: 'writer@example.com' })).id;
    otherUserId = (await users.save({ username: 'other', email: 'other@example.com' })).id;
  });

  let day = 0;
  const write = (content: string, overrides: Partial<Entry> = {}) => {
    day += 1;
    return entries.save({
      userId,
      date: `2024-01-${String(day).padStart(2, '0')}`,
      index: 1,
      tags: [],
      content,
      ...overrides,
    });
  };
  const search = async (text: string, extra: Partial<GetEntriesQueryDto> = {}) =>
    (await queries.getEntries(userId, { search: text, page: 1, limit: 20, ...extra })).entries;
  const contents = async (text: string, extra: Partial<GetEntriesQueryDto> = {}) =>
    (await search(text, extra)).map((entry) => entry.content);

  it('matches English and French word forms and ignores accents', async () => {
    await write('We were running along the river.');
    await write('Les souvenirs de cet été à Paris.');
    await write('Nothing to see here.');

    expect(await contents('runs')).toEqual(['We were running along the river.']);
    expect(await contents('souvenir')).toEqual(['Les souvenirs de cet été à Paris.']);
    expect(await contents('ete')).toEqual(['Les souvenirs de cet été à Paris.']);
    expect(await contents('Été')).toEqual(['Les souvenirs de cet été à Paris.']);
  });

  it('supports quoted phrases, exclusions, and OR', async () => {
    await write('A long morning run by the sea.');
    await write('The morning was long; no run today.');
    await write('Morning run in the rain.');
    await write('Swimming at the lake.');

    expect(await contents('"morning run"', { sort: 'date' })).toEqual([
      'Morning run in the rain.',
      'A long morning run by the sea.',
    ]);
    expect(await contents('"morning run" -rain')).toEqual(['A long morning run by the sea.']);
    expect(await contents('sea OR lake', { sort: 'date' })).toEqual([
      'Swimming at the lake.',
      'A long morning run by the sea.',
    ]);
  });

  it('matches the last word as the start of a longer word', async () => {
    await write('Journaling every evening.');
    await write('An unrelated note.');

    expect(await contents('journ')).toEqual(['Journaling every evening.']);
    expect(await contents('every journ')).toEqual(['Journaling every evening.']);
    expect(await contents('note OR journ', { sort: 'date' })).toEqual(['An unrelated note.', 'Journaling every evening.']);
    // A finished phrase is not read as a prefix.
    expect(await contents('"journ"')).toEqual([]);
  });

  it('ranks the best matches first unless date order is asked for', async () => {
    await write('Garden. Garden work, garden plans, and more garden.', { tags: ['garden'] });
    await write('A long day at the office that ended with a short walk past a garden on the way home.');
    await write('Garden notes.');

    expect((await contents('garden'))[0]).toBe('Garden. Garden work, garden plans, and more garden.');
    expect(await contents('garden', { sort: 'date' })).toEqual([
      'Garden notes.',
      'A long day at the office that ended with a short walk past a garden on the way home.',
      'Garden. Garden work, garden plans, and more garden.',
    ]);
  });

  it('keeps tag names searchable, including tags that hold no words', async () => {
    await write('Planning the quarter.', { tags: ['work-life'] });
    await write('Learning templates.', { tags: ['c++'] });
    await write('Weekend.', { tags: ['family'] });

    expect(await contents('families')).toEqual(['Weekend.']);
    expect(await contents('work-life')).toEqual(['Planning the quarter.']);
    expect(await contents('c++')).toEqual(['Learning templates.']);
    expect((await search('families'))[0].search_matches).toEqual([]);
  });

  it('falls back to a literal match for searches without words', async () => {
    await write('Party time 🎉 with friends.');
    await write('A quiet night.');

    const results = await search('🎉');
    expect(results.map((entry) => entry.content)).toEqual(['Party time 🎉 with friends.']);
    expect(results[0].search_matches).toBeUndefined();
    expect(await contents('100%')).toEqual([]);
  });

  it('returns the matched words and phrases as written in each entry', async () => {
    await write('The quick brown fox. A brown dog was quick to run. Quick brown cats running.');
    await write('Un été à Paris, les étés passés.');

    expect(await search('"quick brown" -fox')).toEqual([]);

    const [phrase] = await search('"quick brown" runn');
    expect(phrase.search_matches).toEqual(expect.arrayContaining(['quick brown', 'running']));
    expect(phrase.search_matches).not.toContain('brown');
    expect(phrase.search_matches).not.toContain('fox');

    const [summer] = await search('ete');
    expect(summer.search_matches).toEqual(['étés', 'été']);
  });

  it('combines with the other filters and leaves out other writers and the recycle bin', async () => {
    const kept = await write('Harbor walk at dawn.', { isFavorite: true, tags: ['sea'] });
    await write('Harbor walk at dusk.', { isArchived: true });
    const trashed = await write('Harbor walk at noon.');
    await entries.softDelete(trashed.id);
    await entries.save({ userId: otherUserId, date: '2024-02-01', index: 1, tags: [], content: 'Harbor walk elsewhere.' });

    expect(await contents('harbor')).toEqual(['Harbor walk at dusk.', 'Harbor walk at dawn.']);
    expect(await contents('harbor', { favorites: true, tags: 'sea' })).toEqual(['Harbor walk at dawn.']);
    expect(await contents('harbor', { archiveStatus: 'archived' })).toEqual(['Harbor walk at dusk.']);
    expect((await queries.getEntries(userId, { search: 'harbor', page: 1, limit: 1 })).total).toBe(2);
    expect(kept.searchVector).toBeUndefined();
  });

  it('keeps the search vector current when an entry changes', async () => {
    const entry = await write('Before the change.', { tags: ['old'] });
    await entries.update(entry.id, { content: 'After the rewrite.', tags: ['fresh'] });

    expect(await contents('change')).toEqual([]);
    expect(await contents('rewrite')).toEqual(['After the rewrite.']);
    expect(await contents('fresh')).toEqual(['After the rewrite.']);
  });
});
