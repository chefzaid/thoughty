import { safeJsonParse } from './base';
import type { Diary } from '../../types';

export const createDiariesService = (authFetch: (url: string, options?: RequestInit) => Promise<Response>) => {
  /**
   * Fetch all diaries
   */
  const fetchDiaries = async (): Promise<Diary[]> => {
    try {
      const response = await authFetch('/api/diaries');
      const data = await safeJsonParse<Diary[]>(response);
      if (response.ok && Array.isArray(data)) {
        return data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching diaries:', error);
      return [];
    }
  };

  /**
   * Create a new diary
   */
  const createDiary = async (diaryData: Partial<Diary>): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await authFetch('/api/diaries', {
        method: 'POST',
        body: JSON.stringify(diaryData)
      });
      if (!response.ok) {
        const error = await safeJsonParse<{ error?: string }>(response);
        return { success: false, error: error?.error || 'Failed to create diary' };
      }
      return { success: true };
    } catch (error) {
      console.error('Error creating diary:', error);
      return { success: false, error: 'Failed to create diary' };
    }
  };

  /**
   * Update a diary
   */
  const updateDiary = async (id: number, diaryData: Partial<Diary>): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await authFetch(`/api/diaries/${id}`, {
        method: 'PUT',
        body: JSON.stringify(diaryData)
      });
      if (!response.ok) {
        const error = await safeJsonParse<{ error?: string }>(response);
        return { success: false, error: error?.error || 'Failed to update diary' };
      }
      return { success: true };
    } catch (error) {
      console.error('Error updating diary:', error);
      return { success: false, error: 'Failed to update diary' };
    }
  };

  /**
   * Delete a diary
   */
  const deleteDiary = async (id: number): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await authFetch(`/api/diaries/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const error = await safeJsonParse<{ error?: string }>(response);
        return { success: false, error: error?.error || 'Failed to delete diary' };
      }
      return { success: true };
    } catch (error) {
      console.error('Error deleting diary:', error);
      return { success: false, error: 'Failed to delete diary' };
    }
  };

  /**
   * Set a diary as default
   */
  const setDefaultDiary = async (id: number): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await authFetch(`/api/diaries/${id}/default`, { method: 'PATCH' });
      if (!response.ok) {
        const error = await safeJsonParse<{ error?: string }>(response);
        return { success: false, error: error?.error || 'Failed to set default diary' };
      }
      return { success: true };
    } catch (error) {
      console.error('Error setting default diary:', error);
      return { success: false, error: 'Failed to set default diary' };
    }
  };

  return {
    fetchDiaries,
    createDiary,
    updateDiary,
    deleteDiary,
    setDefaultDiary
  };
};

export type DiariesService = ReturnType<typeof createDiariesService>;
