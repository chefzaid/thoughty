import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { vi } from 'vitest';

import type { SavedSearch, SavedSearchFilters } from '../../services/api';
import type { ArchiveStatusFilter, EntrySearchSort } from '../../types';
import type { EntrySearchMode } from '../../hooks/useEntriesState';
import type { MoodFilter } from '../../utils/entryMood';
import { createTestQueryClient } from '../../test/queryClient';
import SavedSearches from './SavedSearches';

export const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${Object.values(params).join(' | ')}` : key;

export const noFilters: SavedSearchFilters = {
  search: '', searchMode: 'keyword', sort: 'relevance', tags: [], date: null,
  visibility: 'all', archiveStatus: 'active', favorites: false, mood: '', eraId: null,
};

export const savedSearch = (overrides: Partial<SavedSearch> = {}): SavedSearch => ({
  id: 4,
  name: 'Family',
  diaryId: 2,
  filters: { ...noFilters, tags: ['family'], date: '2019-07-14', favorites: true },
  bookVersionCount: 0,
  createdAt: '2026-10-27T09:00:00.000Z',
  updatedAt: '2026-10-27T09:00:00.000Z',
  ...overrides,
});

export const listOf = (savedSearches: SavedSearch[], limit = 50) => ({ data: { savedSearches, limit }, error: null });

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

/** The saved searches beside a working filter bar state, so applying and changing filters behave as in the journal. */
function Harness({ notify, onSemanticSearch }: { notify: (message: string) => void; onSemanticSearch: () => Promise<void> }) {
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState<EntrySearchMode>('keyword');
  const [searchSort, setSearchSort] = useState<EntrySearchSort>('relevance');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterDateObj, setFilterDateObj] = useState<Date | null>(null);
  const [filterVisibility, setFilterVisibility] = useState<'all' | 'public' | 'private'>('all');
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [filterArchiveStatus, setFilterArchiveStatus] = useState<ArchiveStatusFilter>('active');
  const [filterMood, setFilterMood] = useState<MoodFilter>('');
  const [filterEraId, setFilterEraId] = useState<number | null>(null);
  const [page, setPage] = useState(3);
  const location = useLocation();
  const diary = new URLSearchParams(location.search).get('diary');
  const currentDiaryId = diary === null || diary === 'all' ? null : Number(diary);

  return (
    <>
      <SavedSearches
        filters={{
          search, setSearch, searchMode, setSearchMode, searchSort, setSearchSort,
          filterTags, setFilterTags, filterDateObj, setFilterDateObj, filterVisibility, setFilterVisibility,
          filterFavorites, setFilterFavorites, filterArchiveStatus, setFilterArchiveStatus, filterMood, setFilterMood,
          filterEraId, setFilterEraId, setPage, onSemanticSearch,
        }}
        currentDiaryId={currentDiaryId}
        diaries={[{ id: 1, name: 'Journal' }, { id: 2, name: 'Travel' }]}
        eras={[{ id: 3, name: 'University', emoji: '🎓', color: null, note: null, startDate: '2010-09-01', endDate: null, createdAt: '', updatedAt: '' }]}
        theme="light"
        language="en"
        t={t}
        notify={notify}
      />
      <output data-testid="filters">
        {JSON.stringify({ search, searchMode, searchSort, filterTags, date: filterDateObj?.toDateString() ?? null, filterVisibility, filterFavorites, filterArchiveStatus, filterMood, filterEraId, page })}
      </output>
      <button type="button" onClick={() => setFilterFavorites((value) => !value)}>Toggle favorites</button>
      <button type="button" onClick={() => setSearch('morning')}>Type a search</button>
    </>
  );
}

export function renderSavedSearches(initialSearch = '?diary=all') {
  const notify = vi.fn();
  const onSemanticSearch = vi.fn().mockResolvedValue(undefined);
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={[`/journal${initialSearch}`]}>
        <Harness notify={notify} onSemanticSearch={onSemanticSearch} />
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { notify, onSemanticSearch };
}
