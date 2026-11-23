import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Config, ProfileStats } from '../types';
import type { Notifier } from './useAppNotice';
import { getTranslation } from '../utils/translations';
import { useApiServices } from './useApiServices';
import { readOfflineDisplay, rememberOfflineDisplay } from '../contexts/offlineSession';

const CONFIG_QUERY_KEY = ['app', 'config'] as const;
const PROFILE_STATS_QUERY_KEY = ['app', 'profile-stats'] as const;

/**
 * The writer's settings. `offline` is set while the journal is open without a connection (see
 * `useAuthSession`): the app then counts as loaded at once, and looks and reads as it did when the
 * settings were last read on this browser, until the API answers.
 */
export const useConfig = (isAuthenticated: boolean, offline = false) => {
  const { configService } = useApiServices();
  const queryClient = useQueryClient();
  const offlineDisplay = useMemo(() => (offline ? readOfflineDisplay() : null), [offline]);
  // Whether the API ever answered with the settings, as opposed to a save shown before they arrived
  const [apiAnswered, setApiAnswered] = useState(false);

  const configQuery = useQuery({
    queryKey: CONFIG_QUERY_KEY,
    // Null when the settings could not be read: the defaults (or offline, the remembered look) apply
    queryFn: async (): Promise<Config | null> => {
      const stored = await configService.fetchConfig();
      if (stored) setApiAnswered(true);
      return stored ?? null;
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

  const config: Config = configQuery.data ?? offlineDisplay ?? {};
  /** True once the profile config has arrived (or failed to), so page-size based lookups use the user's setting. */
  const configLoaded = !configQuery.isPending || offline;
  /**
   * True once the stored settings have really been read from the API (not the defaults or the remembered
   * look), so a setting built on its stored value, such as the prompt cards drawn, can be saved over it.
   */
  const configRead = apiAnswered && configQuery.data != null;

  useEffect(() => {
    if (configQuery.data) rememberOfflineDisplay(configQuery.data);
  }, [configQuery.data]);

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

  /** Shows the new settings at once and saves them; resolves false, with the previous settings back, when the save fails. */
  const updateConfig = useCallback(async (newConfig: Config): Promise<boolean> => {
    const previousConfig = queryClient.getQueryData<Config>(CONFIG_QUERY_KEY) ?? {};
    queryClient.setQueryData<Config>(CONFIG_QUERY_KEY, newConfig);
    const success = await configService.updateConfig(newConfig);
    if (!success) {
      queryClient.setQueryData<Config>(CONFIG_QUERY_KEY, previousConfig);
    }
    return success;
  }, [configService, queryClient]);

  useEffect(() => {
    if (config.theme === 'light') {
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode');
    } else {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
    }

    document.body.classList.toggle('high-contrast-mode', config.highContrast === true || config.highContrast === 'true');
  }, [config.highContrast, config.theme]);

  const t = useCallback((key: string, params: Record<string, string | number> = {}): string => {
    return getTranslation(config.language || 'en', key, params);
  }, [config.language]);

  const downloadUserData = useCallback(async () => {
    return configService.downloadUserData();
  }, [configService]);

  return {
    config,
    configLoaded,
    configRead,
    setConfig,
    profileStats,
    fetchConfig,
    fetchProfileStats,
    updateConfig,
    downloadUserData,
    t,
  };
};

/**
 * Saves settings like `updateConfig` and, when the save fails and the previous settings come back,
 * says so in the app's notice toast, in the language of the settings that stay.
 */
export const useReportedConfigUpdate = (
  updateConfig: (newConfig: Config) => Promise<boolean>,
  notifier: Notifier,
) => useCallback(async (newConfig: Config): Promise<boolean> => {
  const saved = await updateConfig(newConfig);
  if (!saved) {
    notifier.notify(notifier.t('settingsSaveFailed'));
  }
  return saved;
}, [notifier, updateConfig]);
