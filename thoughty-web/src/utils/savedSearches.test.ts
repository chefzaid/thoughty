import { describe, expect, it } from 'vitest';

import type { SavedSearchFilters } from '../services/api/savedSearchesService';
import {
  describeSavedSearch,
  matchesSavedSearch,
  parseSavedSearchDate,
  savedSearchMood,
  toSavedSearchFilters,
  type JournalFilterState,
} from './savedSearches';

const state: JournalFilterState = {
  search: 'walk',
  searchMode: 'keyword',
  searchSort: 'date',
  filterTags: ['family', 'trips'],
  filterDateObj: new Date(2019, 6, 14),
  filterVisibility: 'private',
  filterFavorites: true,
  filterArchiveStatus: 'all',
  filterMood: '4,5',
  filterEraId: null,
};
const saved: SavedSearchFilters = {
  search: 'walk',
  searchMode: 'keyword',
  sort: 'date',
  tags: ['family', 'trips'],
  date: '2019-07-14',
  visibility: 'private',
  archiveStatus: 'all',
  favorites: true,
  mood: '4,5',
  eraId: null,
};
const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key}(${Object.values(params).join(', ')})` : key;
const diaries = [{ id: 2, name: 'Travel' }];

describe('saved search filters', () => {
  it('reads the filter bar into the saved shape, with the date as a local day', () => {
    expect(toSavedSearchFilters(state)).toEqual(saved);
    expect(toSavedSearchFilters({ ...state, filterDateObj: null }).date).toBeNull();
  });

  it('reads a saved date back as the local day, and nothing for no date', () => {
    const date = parseSavedSearchDate('2019-07-14');
    expect([date?.getFullYear(), date?.getMonth(), date?.getDate()]).toEqual([2019, 6, 14]);
    expect(parseSavedSearchDate(null)).toBeNull();
    expect(parseSavedSearchDate('July 14')).toBeNull();
  });

  it('keeps a mood the filter bar offers and drops any other', () => {
    expect(savedSearchMood('4,5')).toBe('4,5');
    expect(savedSearchMood('2,3')).toBe('');
  });

  it('matches the filters on screen with tags in any order, and nothing else', () => {
    expect(matchesSavedSearch(saved, { ...state, filterTags: ['trips', 'family'] })).toBe(true);
    expect(matchesSavedSearch(saved, { ...state, filterTags: ['family'] })).toBe(false);
    expect(matchesSavedSearch(saved, { ...state, search: 'walks' })).toBe(false);
    expect(matchesSavedSearch(saved, { ...state, filterDateObj: new Date(2019, 6, 15) })).toBe(false);
    expect(matchesSavedSearch(saved, { ...state, filterFavorites: false })).toBe(false);
    expect(matchesSavedSearch(saved, { ...state, filterMood: '' })).toBe(false);
    expect(matchesSavedSearch(saved, { ...state, searchMode: 'semantic' })).toBe(false);
    expect(matchesSavedSearch(saved, { ...state, filterEraId: 3 })).toBe(false);
    expect(matchesSavedSearch({ ...saved, eraId: 3 }, { ...state, filterEraId: 3 })).toBe(true);
  });

  it('reads a search saved before life eras as covering every date', () => {
    const { eraId: _eraId, ...beforeEras } = saved;
    expect(matchesSavedSearch(beforeEras, state)).toBe(true);
    expect(matchesSavedSearch(beforeEras, { ...state, filterEraId: 3 })).toBe(false);
    expect(toSavedSearchFilters({ ...state, filterEraId: 3 }).eraId).toBe(3);
  });

  it('names the life era a search is narrowed to, and leaves out one it does not know', () => {
    const eras = [{ id: 3, name: 'University', emoji: '🎓' }];
    const uni: SavedSearchFilters = { ...saved, search: '', tags: [], date: null, visibility: 'all', archiveStatus: 'active', favorites: false, mood: '', eraId: 3 };
    expect(describeSavedSearch(uni, null, diaries, t, eras)).toBe('allDiaries · 🎓 University');
    expect(describeSavedSearch(uni, null, diaries, t)).toBe('allDiaries · savedSearchNoFilters');
  });

  it('describes the diary and every filter a search sets', () => {
    expect(describeSavedSearch(saved, 2, diaries, t)).toBe(
      'Travel · savedSearchText(walk) · family, trips · 2019-07-14 · private · savedSearchActiveAndArchived · favorites · moodFilterHigh',
    );
    expect(describeSavedSearch({ ...saved, searchMode: 'semantic', tags: [], date: null, archiveStatus: 'archived', favorites: false, mood: '', visibility: 'all' }, null, diaries, t))
      .toBe('allDiaries · savedSearchMeaning(walk) · archived');
  });

  it('says when a search sets no filter, and leaves out a diary it does not know', () => {
    const none: SavedSearchFilters = { ...saved, search: '  ', tags: [], date: null, visibility: 'all', archiveStatus: 'active', favorites: false, mood: '' };
    expect(describeSavedSearch(none, 9, diaries, t)).toBe('savedSearchNoFilters');
    expect(describeSavedSearch(none, null, diaries, t)).toBe('allDiaries · savedSearchNoFilters');
  });
});
