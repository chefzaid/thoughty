import { EntryListCacheService } from './entry-list-cache.service';
import type { DataSource } from 'typeorm';
import type { EntriesListResponseDto, GetEntriesQueryDto } from './dto';

describe('EntryListCacheService', () => {
  const response: EntriesListResponseDto = {
    entries: [{
      id: 1,
      user_id: 7,
      diary_id: null,
      date: '2024-01-15',
      index: 1,
      title: null,
      time_of_day: null,
      mood: null,
      feelings: [],
      tags: ['focus'],
      content: 'Cached entry',
      format: 'plain',
      visibility: 'public',
      is_favorite: false,
      is_archived: false,
      is_pinned: false,
      created_at: new Date('2024-01-15T10:00:00Z'),
      sealed_until: null,
      attachments: [],
    }],
    total: 1,
    page: 1,
    totalPages: 1,
    allTags: ['focus'],
  };

  /** The writers' list versions as `entry_list_versions` would hold them. */
  let versions: Map<number, string>;
  let dataSource: { query: jest.Mock };

  const cacheWith = (env: NodeJS.ProcessEnv = { ENTRIES_CACHE_TTL_SECONDS: '30' }) =>
    new EntryListCacheService(dataSource as unknown as DataSource, env);

  /** Reads the list through the cache with a loader that hands back `value`. */
  const store = (cache: EntryListCacheService, userId: number, query: GetEntriesQueryDto, value = response) =>
    cache.getOrLoad(userId, query, async () => value);

  /** The cached copy for the query, or `undefined` when the cache had to load the list. */
  const cached = async (cache: EntryListCacheService, userId: number, query: GetEntriesQueryDto) => {
    const load = jest.fn().mockResolvedValue({ ...response, total: -1 });
    const result = await cache.getOrLoad(userId, query, load);
    return load.mock.calls.length === 0 ? result : undefined;
  };

  beforeEach(() => {
    versions = new Map();
    dataSource = {
      query: jest.fn(async (_sql: string, [userId]: [number]) =>
        versions.has(userId) ? [{ version: versions.get(userId) }] : [],
      ),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reads the writer’s list version from entry_list_versions, before loading the list', async () => {
    const cache = cacheWith();
    const load = jest.fn(async () => {
      expect(dataSource.query).toHaveBeenCalledWith('SELECT version FROM entry_list_versions WHERE user_id = $1', [7]);
      return response;
    });

    await expect(cache.getOrLoad(7, {}, load)).resolves.toBe(response);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('returns cached entry lists with normalized tag and default pagination keys', async () => {
    const cache = cacheWith();
    await store(cache, 7, { tags: 'work, focus', visibility: 'public' });

    expect(await cached(cache, 7, { tags: 'focus,work', visibility: 'public', page: 1, limit: 10 })).toEqual(response);
    expect(await cached(cache, 8, { tags: 'focus,work', visibility: 'public', page: 1, limit: 10 })).toBeUndefined();
  });

  it('hands out copies, so a caller changing one leaves the cache as it was', async () => {
    const cache = cacheWith();
    const first = await store(cache, 7, {}, structuredClone(response));
    first.entries[0]!.content = 'Changed by the caller';
    const served = await cached(cache, 7, {});
    served!.total = 99;

    expect(await cached(cache, 7, {})).toEqual(response);
  });

  it('loads the list again once the writer’s version moves on, for every query of theirs only', async () => {
    const cache = cacheWith();
    versions.set(7, '3');
    versions.set(8, '1');
    await store(cache, 7, { page: 1 });
    await store(cache, 7, { page: 2 }, { ...response, page: 2 });
    await store(cache, 8, { page: 1 }, { ...response, total: 2 });

    versions.set(7, '4');

    expect(await cached(cache, 7, { page: 1 })).toBeUndefined();
    expect(await cached(cache, 7, { page: 2 })).toBeUndefined();
    expect(await cached(cache, 8, { page: 1 })).toEqual({ ...response, total: 2 });
  });

  it('keeps a list read before the writer’s first change only until that change', async () => {
    const cache = cacheWith();
    await store(cache, 7, {});
    expect(await cached(cache, 7, {})).toEqual(response);

    versions.set(7, '1');

    expect(await cached(cache, 7, {})).toBeUndefined();
  });

  it('never serves a list loaded while a change committed: it is kept under the version read before', async () => {
    const cache = cacheWith();
    versions.set(7, '1');
    await cache.getOrLoad(7, {}, async () => {
      versions.set(7, '2');
      return response;
    });

    expect(await cached(cache, 7, {})).toBeUndefined();
    expect(await cached(cache, 7, {})).toEqual({ ...response, total: -1 });
  });

  it('keeps search orders and meaning-search results apart', async () => {
    const cache = cacheWith();
    await store(cache, 7, { search: 'walk' });
    await store(cache, 7, { ids: '3,1' }, { ...response, total: 2 });

    expect(await cached(cache, 7, { search: 'walk', sort: 'relevance' })).toEqual(response);
    expect(await cached(cache, 7, { search: 'walk', sort: 'date' })).toBeUndefined();
    expect((await cached(cache, 7, { ids: '3,1' }))?.total).toBe(2);
    expect(await cached(cache, 7, { ids: '1,3' })).toBeUndefined();
  });

  it('keeps mood filters apart', async () => {
    const cache = cacheWith();
    await store(cache, 7, { mood: '4,5' });

    expect(await cached(cache, 7, { mood: '4,5' })).toEqual(response);
    expect(await cached(cache, 7, { mood: '1' })).toBeUndefined();
    expect(await cached(cache, 7, { eraId: 9 })).toBeUndefined();
  });

  it('keeps life era filters apart', async () => {
    const cache = cacheWith();
    await store(cache, 7, { eraId: 3 });

    expect(await cached(cache, 7, { eraId: 3 })).toEqual(response);
    expect(await cached(cache, 7, { eraId: 4 })).toBeUndefined();
  });

  it('keeps person filters apart', async () => {
    const cache = cacheWith();
    await store(cache, 7, { personId: 12 });

    expect(await cached(cache, 7, { personId: 12 })).toEqual(response);
    expect(await cached(cache, 7, { personId: 13 })).toBeUndefined();
  });

  it('expires cached entries after the configured ttl', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T10:00:00Z'));

    const cache = cacheWith({ ENTRIES_CACHE_TTL_SECONDS: '1' });
    await store(cache, 7, {});

    expect(await cached(cache, 7, {})).toEqual(response);

    jest.setSystemTime(new Date('2024-01-15T10:00:02Z'));

    expect(await cached(cache, 7, {})).toBeUndefined();
  });

  it('caches nothing when the ttl or the size is zero', async () => {
    for (const env of [{ ENTRIES_CACHE_TTL_SECONDS: '0' }, { ENTRIES_CACHE_MAX_KEYS: '0' }]) {
      const cache = cacheWith(env);
      await store(cache, 7, {});
      expect(await cached(cache, 7, {})).toBeUndefined();
    }
  });

  it('falls back to the defaults for settings that are not numbers', async () => {
    const cache = cacheWith({ ENTRIES_CACHE_TTL_SECONDS: 'soon', ENTRIES_CACHE_MAX_KEYS: '-1' });
    await store(cache, 7, {});

    expect(await cached(cache, 7, {})).toEqual(response);
  });

  it('prunes the oldest keys when the cache reaches its configured size', async () => {
    const cache = cacheWith({ ENTRIES_CACHE_TTL_SECONDS: '30', ENTRIES_CACHE_MAX_KEYS: '1' });

    await store(cache, 7, { page: 1 });
    await store(cache, 8, { page: 2 }, { ...response, page: 2 });

    expect(await cached(cache, 8, { page: 2 })).toEqual({ ...response, page: 2 });
    expect(await cached(cache, 7, { page: 1 })).toBeUndefined();
  });
});
