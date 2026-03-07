import { safeJsonParse } from './base';
import type { Config, ProfileStats } from '../../types';

export interface ConfigResponse extends Config {}

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

  return {
    fetchConfig,
    updateConfig,
    fetchProfileStats
  };
};

export type ConfigService = ReturnType<typeof createConfigService>;
