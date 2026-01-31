import { safeJsonParse } from './base';
import type { Entry, EntriesResponse } from '../../types';

export interface NavigateToFirstResponse {
  found?: boolean;
  page?: number;
  entryId?: number;
  years?: number[];
  months?: string[];
}

export interface NavigateByDateResponse {
  found?: boolean;
  page?: number;
  entryId?: number;
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

      const response = await authFetch(`/api/entries?${urlParams}`);
      const data = await safeJsonParse<{
        entries?: Entry[];
        totalPages?: number;
        allTags?: string[];
      }>(response);

      if (response.ok && data) {
        return {
          entries: data.entries || [],
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
      const data = await safeJsonParse<{ dates?: string[] }>(response);
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
  const createEntry = async (entry: {
    text: string;
    tags: string[];
    date: string;
    visibility: 'public' | 'private' | null;
    diaryId: number | null;
  }): Promise<boolean> => {
    try {
      const response = await authFetch('/api/entries', {
        method: 'POST',
        body: JSON.stringify(entry)
      });
      return response.ok;
    } catch (error) {
      console.error('Error saving entry:', error);
      return false;
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
    data: { text: string; tags: string[]; date: string; visibility: 'public' | 'private' }
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
      return await response.json() as NavigateToFirstResponse;
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
      return await response.json() as NavigateByDateResponse;
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
      return await response.json() as NavigateByDateResponse;
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
      const data = await response.json() as { years?: number[]; months?: string[] };
      return {
        years: data.years || [],
        months: data.months || []
      };
    } catch (error) {
      console.error('Error fetching years/months:', error);
      return { years: [], months: [] };
    }
  };

  return {
    fetchEntries,
    fetchEntryDates,
    createEntry,
    deleteEntry,
    updateEntry,
    toggleVisibility,
    navigateToFirst,
    navigateByDate,
    navigateById,
    fetchYearsMonths
  };
};

export type EntriesService = ReturnType<typeof createEntriesService>;
