import type { MockAppState } from './mockApp.shared';
import { fulfillApiError, fulfillJson, type RouteContext } from './mockApp.route-utils';

export const MOCK_SAVED_SEARCH_LIMIT = 50;

export interface MockSavedSearch {
  id: number;
  name: string;
  diaryId: number | null;
  filters: {
    search: string;
    searchMode: 'keyword' | 'semantic';
    sort: 'relevance' | 'date';
    tags: string[];
    date: string | null;
    visibility: 'all' | 'public' | 'private';
    archiveStatus: 'active' | 'archived' | 'all';
    favorites: boolean;
    mood: string;
  };
  createdAt: string;
  updatedAt: string;
}

const byName = (left: MockSavedSearch, right: MockSavedSearch) =>
  left.name.toLowerCase().localeCompare(right.name.toLowerCase()) || left.id - right.id;

function nameTaken(state: MockAppState, name: string, exceptId?: number): boolean {
  return state.savedSearches.some((saved) => saved.id !== exceptId && saved.name.toLowerCase() === name.toLowerCase());
}

/** `/api/saved-searches` as the API answers it: by name, one name per writer whatever its case, with a limit. */
export async function handleSavedSearchRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/saved-searches' && request.method() === 'GET') {
    await fulfillJson(route, { savedSearches: [...state.savedSearches].sort(byName), limit: MOCK_SAVED_SEARCH_LIMIT });
    return true;
  }

  if (pathname === '/api/saved-searches' && request.method() === 'POST') {
    const draft = request.postDataJSON() as Pick<MockSavedSearch, 'name' | 'diaryId' | 'filters'>;
    if (state.savedSearches.length >= MOCK_SAVED_SEARCH_LIMIT) {
      await fulfillApiError(route, 400, 'SAVED_SEARCH_LIMIT_REACHED', `Saved search limit reached (${MOCK_SAVED_SEARCH_LIMIT})`);
      return true;
    }
    if (nameTaken(state, draft.name)) {
      await fulfillApiError(route, 409, 'SAVED_SEARCH_NAME_TAKEN', 'A saved search with this name already exists');
      return true;
    }
    const now = new Date().toISOString();
    const saved: MockSavedSearch = {
      id: Math.max(0, ...state.savedSearches.map((candidate) => candidate.id)) + 1,
      ...draft,
      createdAt: now,
      updatedAt: now,
    };
    state.savedSearches.push(saved);
    await fulfillJson(route, saved, { status: 201 });
    return true;
  }

  const match = /^\/api\/saved-searches\/(\d+)$/.exec(pathname);
  if (!match) return false;
  const saved = state.savedSearches.find((candidate) => candidate.id === Number(match[1]));
  if (!saved) {
    await fulfillApiError(route, 404, 'SAVED_SEARCH_NOT_FOUND', 'Saved search not found');
    return true;
  }

  if (request.method() === 'PATCH') {
    const { name } = request.postDataJSON() as { name: string };
    if (nameTaken(state, name, saved.id)) {
      await fulfillApiError(route, 409, 'SAVED_SEARCH_NAME_TAKEN', 'A saved search with this name already exists');
      return true;
    }
    saved.name = name;
    saved.updatedAt = new Date().toISOString();
    await fulfillJson(route, saved);
    return true;
  }

  if (request.method() === 'DELETE') {
    state.savedSearches = state.savedSearches.filter((candidate) => candidate.id !== saved.id);
    await fulfillJson(route, { success: true });
    return true;
  }

  return false;
}
