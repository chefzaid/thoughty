import { readApiErrorMessage, safeJsonParse } from './base';
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
        return { success: false, error: await readApiErrorMessage(response, 'diaryCreateFailed') };
      }
      return { success: true };
    } catch (error) {
      console.error('Error creating diary:', error);
      return { success: false, error: 'diaryCreateFailed' };
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
        return { success: false, error: await readApiErrorMessage(response, 'diaryUpdateFailed') };
      }
      return { success: true };
    } catch (error) {
      console.error('Error updating diary:', error);
      return { success: false, error: 'diaryUpdateFailed' };
    }
  };

  /**
   * Delete a diary
   */
  const deleteDiary = async (id: number): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await authFetch(`/api/diaries/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        return { success: false, error: await readApiErrorMessage(response, 'diaryDeleteFailed') };
      }
      return { success: true };
    } catch (error) {
      console.error('Error deleting diary:', error);
      return { success: false, error: 'diaryDeleteFailed' };
    }
  };

  /**
   * Set a diary as default
   */
  const setDefaultDiary = async (id: number): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await authFetch(`/api/diaries/${id}/default`, { method: 'PATCH' });
      if (!response.ok) {
        return { success: false, error: await readApiErrorMessage(response, 'diarySetDefaultFailed') };
      }
      return { success: true };
    } catch (error) {
      console.error('Error setting default diary:', error);
      return { success: false, error: 'diarySetDefaultFailed' };
    }
  };

  /**
   * Reorder diaries
   */
  const reorderDiaries = async (orderedIds: number[]): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await authFetch('/api/diaries/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ orderedIds }),
      });
      if (!response.ok) {
        return { success: false, error: await readApiErrorMessage(response, 'diaryReorderFailed') };
      }
      return { success: true };
    } catch (error) {
      console.error('Error reordering diaries:', error);
      return { success: false, error: 'diaryReorderFailed' };
    }
  };

  return {
    fetchDiaries,
    createDiary,
    updateDiary,
    deleteDiary,
    setDefaultDiary,
    reorderDiaries
  };
};

export type DiariesService = ReturnType<typeof createDiariesService>;
