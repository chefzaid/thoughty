import { toSavedSearchEntryFilters } from './saved-search-entry-filters';

describe('toSavedSearchEntryFilters', () => {
  const filters = {
    search: 'walk',
    searchMode: 'keyword' as const,
    sort: 'relevance' as const,
    tags: ['family', 'home'],
    date: '2019-07-14',
    visibility: 'private' as const,
    archiveStatus: 'archived' as const,
    favorites: true,
    mood: '4,5',
  };

  it('turns a saved search into the entry list filters and the day it shows', () => {
    expect(toSavedSearchEntryFilters({ diaryId: 2, filters: { ...filters, eraId: 3, personId: 12 } })).toEqual({
      filters: {
        tags: 'family,home',
        visibility: 'private',
        favorites: true,
        archiveStatus: 'archived',
        mood: '4,5',
        diaryId: 2,
        eraId: 3,
        personId: 12,
      },
      date: '2019-07-14',
    });
  });

  it('leaves out what a search does not narrow: all diaries, any visibility, any mood, any day', () => {
    const { filters: entryFilters, date } = toSavedSearchEntryFilters({
      diaryId: null,
      filters: { ...filters, tags: [], visibility: 'all', mood: '', date: null },
    });

    expect(entryFilters).toEqual(expect.objectContaining({ tags: '', visibility: undefined, mood: undefined, diaryId: undefined, eraId: undefined, personId: undefined }));
    expect(toSavedSearchEntryFilters({ diaryId: null, filters: { ...filters, eraId: null } }).filters.eraId).toBeUndefined();
    expect(toSavedSearchEntryFilters({ diaryId: null, filters: { ...filters, personId: null } }).filters.personId).toBeUndefined();
    expect(date).toBeUndefined();
  });
});
