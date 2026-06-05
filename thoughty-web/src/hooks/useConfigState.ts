import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Config, ProfileStats } from '../types';
import { getTranslation } from '../utils/translations';
import { useApiServices } from './useApiServices';

const CONFIG_QUERY_KEY = ['app', 'config'] as const;
const PROFILE_STATS_QUERY_KEY = ['app', 'profile-stats'] as const;

export const useConfig = (isAuthenticated: boolean) => {
  const { configService } = useApiServices();
  const queryClient = useQueryClient();

  const configQuery = useQuery({
    queryKey: CONFIG_QUERY_KEY,
    queryFn: async (): Promise<Config> => {
      const data = await configService.fetchConfig();
      return data ?? {};
    },
    enabled: isAuthenticated,
  });

  const profileStatsQuery = useQuery({
    queryKey: PROFILE_STATS_QUERY_KEY,
    queryFn: async (): Promise<ProfileStats | null> => {
      const stats = await configService.fetchProfileStats();
      return stats ?? null;
    },
    enabled: isAuthenticated,
  });

  const config = configQuery.data ?? {};
  const profileStats = profileStatsQuery.data ?? null;

  const fetchConfig = useCallback(async () => {
    return configQuery.refetch();
  }, [configQuery]);

  const fetchProfileStats = useCallback(async () => {
    return profileStatsQuery.refetch();
  }, [profileStatsQuery]);

  const setConfig = useCallback((nextConfig: Config) => {
    queryClient.setQueryData<Config>(CONFIG_QUERY_KEY, nextConfig);
  }, [queryClient]);

  const updateConfig = useCallback(async (newConfig: Config) => {
    const previousConfig = queryClient.getQueryData<Config>(CONFIG_QUERY_KEY) ?? {};
    queryClient.setQueryData<Config>(CONFIG_QUERY_KEY, newConfig);
    const success = await configService.updateConfig(newConfig);
    if (!success) {
      queryClient.setQueryData<Config>(CONFIG_QUERY_KEY, previousConfig);
    }
  }, [configService, queryClient]);

  useEffect(() => {
    if (config.theme === 'light') {
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode');
    } else {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
    }
  }, [config.theme]);

  const t = useCallback((key: string, params: Record<string, string | number> = {}): string => {
    return getTranslation(config.language || 'en', key, params);
  }, [config.language]);

  const downloadUserData = useCallback(async () => {
    return configService.downloadUserData();
  }, [configService]);

  return {
    config,
    setConfig,
    profileStats,
    fetchConfig,
    fetchProfileStats,
    updateConfig,
    downloadUserData,
    t,
  };
};