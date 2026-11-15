import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEntriesService } from './entriesService';

describe('entriesService semantic result filtering', () => {
  const authFetch = vi.fn();
  const defaultParams = {
    search: '',
    filterTags: [],
    filterDate: '',
    filterVisibility: 'all',
    favorites: false,
    archiveStatus: 'all' as const,
    diaryId: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    authFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ entries: [], total: 0, offset: 0, nextCursor: null, prevCursor: null, allTags: [] }),
    });
  });

  it('includes ranked semantic entry IDs and preserves an empty result', async () => {
    const service = createEntriesService(authFetch);

    await service.fetchEntries({ ...defaultParams, entryIds: [9, 3] }, 50);
    await service.fetchEntries({ ...defaultParams, entryIds: [] }, 50);

    expect(authFetch).toHaveBeenNthCalledWith(1, expect.stringContaining('ids=9%2C3'));
    expect(authFetch).toHaveBeenNthCalledWith(2, expect.stringContaining('ids=0'));
  });
});
