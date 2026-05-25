import { safeJsonParse } from './base';
import type { ArchiveStatusFilter, Entry, EntriesResponse, EntryRevision } from '../../types';
import type { components, paths } from '../../generated/openapi';

type CreateEntryRequestDto = components['schemas']['CreateEntryDto'];
type UpdateEntryRequestDto = components['schemas']['UpdateEntryDto'];
type BulkOperationRequestDto = components['schemas']['BulkOperationDto'];
type EntriesListApiResponse = paths['/api/entries']['get']['responses'][200]['content']['application/json'];
type EntryDatesApiResponse = paths['/api/entries/dates']['get']['responses'][200]['content']['application/json'];
type CreateEntryApiResponse = paths['/api/entries']['post']['responses'][201]['content']['application/json'];
export type NavigateToFirstResponse = paths['/api/entries/first']['get']['responses'][200]['content']['application/json'];
export type NavigateByDateResponse = paths['/api/entries/by-date']['get']['responses'][200]['content']['application/json'];
type BulkOperationResponse = paths['/api/entries/bulk']['post']['responses'][200]['content']['application/json'];
export type RenameTagResponse = paths['/api/entries/tags/rename']['patch']['responses'][200]['content']['application/json'];

interface CreateEntryInput {
  text: string;
  tags: string[];
  date: string;
  visibility: CreateEntryRequestDto['visibility'] | null;
  format?: CreateEntryRequestDto['format'];
  diaryId: number | null;
}

export const createEntriesService = (authFetch: (url: string, options?: RequestInit) => Promise<Response>) => {
  /**
   * Fetch entries with filters and pagination
   */
  const fetchEntries = async (params: {
    page: number;
    limit: number;
    search: string;
    filterTags: string[];
    filterDate: string;
    filterVisibility: string;
    favorites: boolean;
    archiveStatus: ArchiveStatusFilter;
    diaryId: number | null;
  }): Promise<EntriesResponse | null> => {
    try {
      const urlParams = new URLSearchParams({
        page: params.page.toString(),
        limit: params.limit.toString(),
        search: params.search,
        tags: params.filterTags.join(','),
        date: params.filterDate,
        visibility: params.filterVisibility
      });
      if (params.diaryId) {
        urlParams.append('diaryId', params.diaryId.toString());
      }
      if (params.favorites) {
        urlParams.append('favorites', 'true');
      }
      if (params.archiveStatus !== 'all') {
        urlParams.append('archiveStatus', params.archiveStatus);
      }

      const response = await authFetch(`/api/entries?${urlParams}`);
      const data = await safeJsonParse<EntriesListApiResponse>(response);

      if (response.ok && data) {
        return {
          entries: (data.entries as Entry[]) || [],
          totalPages: data.totalPages || 1,
          allTags: data.allTags || []
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching entries:', error);
      return null;
    }
  };

  /**
   * Fetch all entry dates
   */
  const fetchEntryDates = async (): Promise<string[]> => {
    try {
      const response = await authFetch('/api/entries/dates');
      const data = await safeJsonParse<EntryDatesApiResponse>(response);
      if (response.ok && data) {
        return data.dates || [];
      }
      return [];
    } catch (error) {
      console.error('Error fetching entry dates:', error);
      return [];
    }
  };

  /**
   * Create a new entry
   */
  const createEntry = async (entry: CreateEntryInput): Promise<{ success: boolean; entryId?: number }> => {
    try {
      const payload: CreateEntryRequestDto = {
        text: entry.text,
        tags: entry.tags,
        date: entry.date,
        visibility: entry.visibility ?? 'private',
        format: entry.format ?? 'plain',
        ...(entry.diaryId ? { diaryId: entry.diaryId } : {}),
      };

      const response = await authFetch('/api/entries', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        const data = await safeJsonParse<CreateEntryApiResponse>(response);
        return { success: true, entryId: data?.entryId };
      }
      return { success: false };
    } catch (error) {
      console.error('Error saving entry:', error);
      return { success: false };
    }
  };

  /**
   * Delete an entry
   */
  const deleteEntry = async (id: number): Promise<boolean> => {
    try {
      const response = await authFetch(`/api/entries/${id}`, { method: 'DELETE' });
      return response.ok;
    } catch (error) {
      console.error('Error deleting entry:', error);
      return false;
    }
  };

  /**
   * Update an entry
   */
  const updateEntry = async (
    id: number,
    data: UpdateEntryRequestDto
  ): Promise<boolean> => {
    try {
      const response = await authFetch(`/api/entries/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      return response.ok;
    } catch (error) {
      console.error('Error updating entry:', error);
      return false;
    }
  };

  /**
   * Toggle entry visibility
   */
  const toggleVisibility = async (id: number, visibility: 'public' | 'private'): Promise<boolean> => {
    try {
      const response = await authFetch(`/api/entries/${id}/visibility`, {
        method: 'PATCH',
        body: JSON.stringify({ visibility })
      });
      return response.ok;
    } catch (error) {
      console.error('Error toggling visibility:', error);
      return false;
    }
  };

  const bulkOperation = async (
    ids: number[],
    action: BulkOperationRequestDto['action'],
    options?: Omit<BulkOperationRequestDto, 'ids' | 'action'>
  ): Promise<BulkOperationResponse | null> => {
    try {
      const response = await authFetch('/api/entries/bulk', {
        method: 'POST',
        body: JSON.stringify({ ids, action, ...options })
      });
      if (!response.ok) return null;
      return safeJsonParse<BulkOperationResponse>(response);
    } catch (error) {
      console.error('Error performing bulk operation:', error);
      return null;
    }
  };

  /**
   * Navigate to first entry of a year/month
   */
  const navigateToFirst = async (
    year: number,
    month: number | null,
    limit: number
  ): Promise<NavigateToFirstResponse | null> => {
    try {
      const params = new URLSearchParams({
        year: year.toString(),
        limit: limit.toString()
      });
      if (month) params.append('month', month.toString());

      const response = await authFetch(`/api/entries/first?${params}`);
      return safeJsonParse<NavigateToFirstResponse>(response);
    } catch (error) {
      console.error('Error navigating to first entry:', error);
      return null;
    }
  };

  /**
   * Navigate to entry by date and index
   */
  const navigateByDate = async (
    date: string,
    index: number,
    limit: number
  ): Promise<NavigateByDateResponse | null> => {
    try {
      const params = new URLSearchParams({
        date,
        index: index.toString(),
        limit: limit.toString()
      });

      const response = await authFetch(`/api/entries/by-date?${params}`);
      return safeJsonParse<NavigateByDateResponse>(response);
    } catch (error) {
      console.error('Error navigating to entry:', error);
      return null;
    }
  };

  /**
   * Navigate to entry by ID
   */
  const navigateById = async (id: number, limit: number): Promise<NavigateByDateResponse | null> => {
    try {
      const params = new URLSearchParams({
        id: id.toString(),
        limit: limit.toString()
      });

      const response = await authFetch(`/api/entries/by-date?${params}`);
      return safeJsonParse<NavigateByDateResponse>(response);
    } catch (error) {
      console.error('Error navigating to entry:', error);
      return null;
    }
  };

  /**
   * Fetch available years and months
   */
  const fetchYearsMonths = async (): Promise<{ years: number[]; months: string[] }> => {
    try {
      const response = await authFetch('/api/entries/first');
      const data = await safeJsonParse<NavigateToFirstResponse>(response);
      return {
        years: data?.years || [],
        months: data?.months || []
      };
    } catch (error) {
      console.error('Error fetching years/months:', error);
      return { years: [], months: [] };
    }
  };

  /**
   * Toggle entry favorite status
   */
  const toggleFavorite = async (id: number, isFavorite: boolean): Promise<boolean> => {
    try {
      const response = await authFetch(`/api/entries/${id}/favorite`, {
        method: 'PATCH',
        body: JSON.stringify({ isFavorite })
      });
      return response.ok;
    } catch (error) {
      console.error('Error toggling favorite:', error);
      return false;
    }
  };

  /**
   * Toggle entry archive status
   */
  const toggleArchived = async (id: number, isArchived: boolean): Promise<boolean> => {
    try {
      const response = await authFetch(`/api/entries/${id}/archive`, {
        method: 'PATCH',
        body: JSON.stringify({ isArchived })
      });
      return response.ok;
    } catch (error) {
      console.error('Error toggling archive state:', error);
      return false;
    }
  };

  /**
   * Fetch revision history for an entry
   */
  const fetchEntryHistory = async (id: number): Promise<EntryRevision[]> => {
    try {
      const response = await authFetch(`/api/entries/${id}/history`);
      if (response.ok) {
        return await response.json();
      }
      return [];
    } catch (error) {
      console.error('Error fetching entry history:', error);
      return [];
    }
  };

  const deleteRevision = async (entryId: number, revisionId: number): Promise<boolean> => {
    try {
      const response = await authFetch(`/api/entries/${entryId}/history/${revisionId}`, {
        method: 'DELETE',
      });
      return response.ok;
    } catch (error) {
      console.error('Error deleting revision:', error);
      return false;
    }
  };

  /**
   * Reorder entries within a single day
   */
  const reorderEntries = async (date: string, orderedIds: number[]): Promise<boolean> => {
    try {
      const response = await authFetch('/api/entries/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ date, orderedIds })
      });
      return response.ok;
    } catch (error) {
      console.error('Error reordering entries:', error);
      return false;
    }
  };

  const renameTag = async (oldTag: string, newTag: string): Promise<RenameTagResponse | null> => {
    try {
      const response = await authFetch('/api/entries/tags/rename', {
        method: 'PATCH',
        body: JSON.stringify({ oldTag, newTag })
      });
      if (!response.ok) {
        return null;
      }
      return safeJsonParse<RenameTagResponse>(response);
    } catch (error) {
      console.error('Error renaming tag:', error);
      return null;
    }
  };

  return {
    fetchEntries,
    fetchEntryDates,
    createEntry,
    deleteEntry,
    updateEntry,
    toggleVisibility,
    toggleFavorite,
    toggleArchived,
    bulkOperation,
    renameTag,
    navigateToFirst,
    navigateByDate,
    navigateById,
    fetchYearsMonths,
    fetchEntryHistory,
    deleteRevision,
    reorderEntries
  };
};

export type EntriesService = ReturnType<typeof createEntriesService>;
