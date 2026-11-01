import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Person, SavedSearch, SavedSearchDraft } from '../../services/api';
import { personViewFilterState, toSavedSearchFilters } from '../../utils/savedSearches';
import { usePersonBook } from './usePersonBook';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => ({ list: mocks.list }) }));
vi.mock('../SavedSearches/useSavedSearches', () => ({ useSavedSearches: () => ({ create: mocks.create }) }));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-router-dom')>(),
  useNavigate: () => mocks.navigate,
}));

const marie: Person = { id: 12, name: 'Marie', handles: ['marie'], entryCount: 3, lastMentionedOn: '2026-10-20', date: null, createdAt: '', updatedAt: '' };
const personFilters = toSavedSearchFilters(personViewFilterState(12));

const savedSearch = (id: number, name: string, overrides: Partial<SavedSearch> = {}): SavedSearch => ({
  id,
  name,
  diaryId: null,
  filters: personFilters,
  bookVersionCount: 0,
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

const listed = (savedSearches: SavedSearch[]) => ({ data: { savedSearches, limit: 50 }, error: null });

function renderPersonBook() {
  const onNotify = vi.fn();
  const hook = renderHook(() => usePersonBook({ onNotify, t: (key, params) => `${key}:${params?.name ?? ''}` }));
  return { ...hook, onNotify };
}

const bookRoute = (savedSearchId: number, savedSearchName: string) => [
  { pathname: '/import-export', search: '?diary=all&section=book&format=txt' },
  { state: { bookStart: { kind: 'person', name: 'Marie', savedSearchId, savedSearchName } } },
];

describe('usePersonBook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reuses the saved search of exactly the person view, across every diary', async () => {
    mocks.list.mockResolvedValue(listed([
      savedSearch(1, 'Marie in Travel', { diaryId: 3 }),
      savedSearch(2, 'Marie, favorites', { filters: { ...personFilters, favorites: true } }),
      savedSearch(3, 'Marie', { filters: { ...personFilters, eraId: undefined } }),
    ]));
    const { result } = renderPersonBook();

    await act(async () => { await result.current.makeBook(marie); });

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith(...bookRoute(3, 'Marie'));
    expect(result.current.pendingPersonId).toBeNull();
  });

  it('saves the person view as a search named after them, or "Book about" them when the name is taken', async () => {
    mocks.list.mockResolvedValue(listed([savedSearch(1, 'Marie', { filters: { ...personFilters, personId: null } })]));
    mocks.create
      .mockResolvedValueOnce({ data: null, error: 'apiError_SAVED_SEARCH_NAME_TAKEN' })
      .mockImplementationOnce(async (draft: SavedSearchDraft) => ({ data: savedSearch(8, draft.name), error: null }));
    const { result } = renderPersonBook();

    await act(async () => { await result.current.makeBook(marie); });

    expect(mocks.create.mock.calls.map(([draft]) => draft)).toEqual([
      { name: 'Marie', diaryId: null, filters: personFilters },
      { name: 'personBookSearchName:Marie', diaryId: null, filters: personFilters },
    ]);
    expect(personFilters).toEqual(expect.objectContaining({ personId: 12, archiveStatus: 'all', tags: [], search: '' }));
    expect(mocks.navigate).toHaveBeenCalledWith(...bookRoute(8, 'personBookSearchName:Marie'));
  });

  it('keeps a long fallback name within what a saved search can be called', async () => {
    const longName = 'M'.repeat(80);
    mocks.list.mockResolvedValue(listed([]));
    mocks.create
      .mockResolvedValueOnce({ data: null, error: 'apiError_SAVED_SEARCH_NAME_TAKEN' })
      .mockResolvedValueOnce({ data: savedSearch(9, 'x'), error: null });
    const { result } = renderPersonBook();

    await act(async () => { await result.current.makeBook({ ...marie, name: longName }); });

    expect(mocks.create.mock.calls[1]![0].name).toHaveLength(80);
  });

  it('says why when the searches cannot be read or the search cannot be saved, and stays put', async () => {
    mocks.list.mockResolvedValueOnce({ data: null, error: 'savedSearchesLoadFailed' });
    const { result, onNotify } = renderPersonBook();
    await act(async () => { await result.current.makeBook(marie); });
    expect(onNotify).toHaveBeenLastCalledWith('savedSearchesLoadFailed:');

    mocks.list.mockResolvedValueOnce(listed([]));
    mocks.create.mockResolvedValueOnce({ data: null, error: 'apiError_SAVED_SEARCH_LIMIT_REACHED' });
    await act(async () => { await result.current.makeBook(marie); });
    expect(onNotify).toHaveBeenLastCalledWith('apiError_SAVED_SEARCH_LIMIT_REACHED:');
    expect(mocks.create).toHaveBeenCalledTimes(1);

    mocks.list.mockResolvedValueOnce({ data: null, error: null });
    await act(async () => { await result.current.makeBook(marie); });
    expect(onNotify).toHaveBeenLastCalledWith('savedSearchSaveFailed:');
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('prepares one book at a time, marking the person while it does', async () => {
    let answer: (value: ReturnType<typeof listed>) => void = () => undefined;
    mocks.list.mockReturnValueOnce(new Promise((resolve) => { answer = resolve; }));
    const { result } = renderPersonBook();

    let first: Promise<void> = Promise.resolve();
    act(() => { first = result.current.makeBook(marie); });
    expect(result.current.pendingPersonId).toBe(12);
    await act(async () => { await result.current.makeBook(marie); });
    expect(mocks.list).toHaveBeenCalledTimes(1);

    await act(async () => {
      answer(listed([savedSearch(3, 'Marie')]));
      await first;
    });
    expect(result.current.pendingPersonId).toBeNull();
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
  });
});
