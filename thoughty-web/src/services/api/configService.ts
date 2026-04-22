import { safeJsonParse } from './base';
import type { Config, ProfileStats } from '../../types';
export interface StatsApiResponse {
  totalThoughts?: number;
  thoughtsPerYear?: Record<string, number>;
  thoughtsPerTag?: Record<string, number>;
}

export const createConfigService = (authFetch: (url: string, options?: RequestInit) => Promise<Response>) => {
  /**
   * Fetch user configuration
   */
  const fetchConfig = async (): Promise<Config | null> => {
    try {
      const response = await authFetch('/api/config');
      if (!response) return null;
      const data = await safeJsonParse<Config>(response);
      if (response.ok && data) {
        return data;
      }
      return null;
    } catch (error) {
      console.error('Error fetching config:', error);
      return null;
    }
  };

  /**
   * Update user configuration
   */
  const updateConfig = async (newConfig: Config): Promise<boolean> => {
    try {
      const response = await authFetch('/api/config', {
        method: 'POST',
        body: JSON.stringify(newConfig)
      });
      return response?.ok ?? false;
    } catch (error) {
      console.error('Error updating config:', error);
      return false;
    }
  };

  /**
   * Fetch profile stats
   */
  const fetchProfileStats = async (): Promise<ProfileStats | null> => {
    try {
      const response = await authFetch('/api/stats');
      if (!response) return null;
      const data = await safeJsonParse<StatsApiResponse>(response);
      if (response.ok && data) {
        const years = Object.keys(data.thoughtsPerYear || {});
        const firstYear = years.length > 0 ? Math.min(...years.map(Number)) : new Date().getFullYear();
        return {
          totalEntries: data.totalThoughts || 0,
          uniqueTags: Object.keys(data.thoughtsPerTag || {}).length,
          firstEntryYear: firstYear
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching profile stats:', error);
      return null;
    }
  };

  /**
   * Download all user data (GDPR)
   */
  const downloadUserData = async (): Promise<boolean> => {
    try {
      const response = await authFetch('/api/config/download-data');
      if (!response?.ok) return false;
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const filenameMatch = /filename="?([^"]+)"?/.exec(disposition);
      const filename = filenameMatch?.[1] || 'thoughty_data.json';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      if (typeof a.remove === 'function') {
        a.remove();
      } else {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      console.error('Error downloading user data:', error);
      return false;
    }
  };

  return {
    fetchConfig,
    updateConfig,
    fetchProfileStats,
    downloadUserData
  };
};

export type ConfigService = ReturnType<typeof createConfigService>;
