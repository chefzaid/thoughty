import { EntryListCacheService } from './entry-list-cache.service';
import type { EntriesListResponseDto } from './dto';

describe('EntryListCacheService', () => {
  const response: EntriesListResponseDto = {
    entries: [{
      id: 1,
      user_id: 7,
      diary_id: null,
      date: '2024-01-15',
      index: 1,
      tags: ['focus'],
      content: 'Cached entry',
      format: 'plain',
      visibility: 'public',
      is_favorite: false,
      is_archived: false,
      is_pinned: false,
      created_at: new Date('2024-01-15T10:00:00Z'),
      attachments: [],
    }],
    total: 1,
    page: 1,
    totalPages: 1,
    allTags: ['focus'],
  };

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns cached entry lists with normalized tag and default pagination keys', () => {
    const cache = new EntryListCacheService({ ENTRIES_CACHE_TTL_SECONDS: '30' });
    cache.set(7, { tags: 'work, focus', visibility: 'public' }, response);

    expect(cache.get(7, { tags: 'focus,work', visibility: 'public', page: 1, limit: 10 })).toEqual(response);
    expect(cache.get(8, { tags: 'focus,work', visibility: 'public', page: 1, limit: 10 })).toBeUndefined();
  });

  it('expires cached entries after the configured ttl', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T10:00:00Z'));

    const cache = new EntryListCacheService({ ENTRIES_CACHE_TTL_SECONDS: '1' });
    cache.set(7, {}, response);

    expect(cache.get(7, {})).toEqual(response);

    jest.setSystemTime(new Date('2024-01-15T10:00:02Z'));

    expect(cache.get(7, {})).toBeUndefined();
  });

  it('invalidates all keys for one user without touching other users', () => {
    const cache = new EntryListCacheService({ ENTRIES_CACHE_TTL_SECONDS: '30' });
    cache.set(7, { page: 1 }, response);
    cache.set(7, { page: 2 }, { ...response, page: 2 });
    cache.set(8, { page: 1 }, { ...response, total: 2 });

    cache.invalidateUser(7);

    expect(cache.get(7, { page: 1 })).toBeUndefined();
    expect(cache.get(7, { page: 2 })).toBeUndefined();
    expect(cache.get(8, { page: 1 })).toEqual({ ...response, total: 2 });
  });

  it('prunes the oldest keys when the cache reaches its configured size', () => {
    const cache = new EntryListCacheService({
      ENTRIES_CACHE_TTL_SECONDS: '30',
      ENTRIES_CACHE_MAX_KEYS: '1',
    });

    cache.set(7, { page: 1 }, response);
    cache.set(7, { page: 2 }, { ...response, page: 2 });

    expect(cache.get(7, { page: 1 })).toBeUndefined();
    expect(cache.get(7, { page: 2 })).toEqual({ ...response, page: 2 });
  });
});
