import { safeJsonParse } from './base';
import type { Config, ProfileStats } from '../../types';
import type { components, paths } from '../../generated/openapi';
import { downloadBlob } from '../../utils/downloadFile';

export type StatsApiResponse = components['schemas']['StatsResponseDto'];
/** The preferences as the API answers them, every value as text ("16", "true"). */
export type ApiConfig = components['schemas']['UserConfigDto'];
export type FeatureFlags = paths['/api/config/feature-flags']['get']['responses'][200]['content']['application/json'];

/** The app's settings from the API's text: the on/off preferences become true or false. */
export function fromApiConfig({ readDates, highContrast, ...preferences }: ApiConfig): Config {
  return {
    ...preferences,
    ...(readDates === undefined ? {} : { readDates: readDates === 'true' }),
    ...(highContrast === undefined ? {} : { highContrast: highContrast === 'true' }),
  };
}

export const createConfigService = (authFetch: (url: string, options?: RequestInit) => Promise<Response>) => {
  /**
   * Fetch user configuration
   */
  const fetchConfig = async (): Promise<Config | null> => {
    try {
      const response = await authFetch('/api/config');
      if (!response) return null;
      const data = await safeJsonParse<ApiConfig>(response);
      if (response.ok && data) {
        return fromApiConfig(data);
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

  const fetchFeatureFlags = async (): Promise<FeatureFlags> => {
    try {
      const response = await authFetch('/api/config/feature-flags');
      if (!response?.ok) return {};
      const data = await safeJsonParse<FeatureFlags>(response);
      return data ?? {};
    } catch (error) {
      console.error('Error fetching feature flags:', error);
      return {};
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
      downloadBlob(blob, filename);
      return true;
    } catch (error) {
      console.error('Error downloading user data:', error);
      return false;
    }
  };

  return {
    fetchConfig,
    updateConfig,
    fetchFeatureFlags,
    fetchProfileStats,
    downloadUserData
  };
};

export type ConfigService = ReturnType<typeof createConfigService>;
