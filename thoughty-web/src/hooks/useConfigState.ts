import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Config, ProfileStats } from '../types';
import type { Notifier } from './useAppNotice';
import { getTranslation } from '../utils/translations';
import { useApiServices } from './useApiServices';
import { readOfflineDisplay, rememberOfflineDisplay } from '../contexts/offlineSession';
import { resolveLanguage } from '../utils/language';
import type { Language } from '../utils/translations';
import type { Theme } from '../utils/visitorPreferences';
import { useVisitorPreferences } from './useVisitorPreferences';

const CONFIG_QUERY_KEY = ['app', 'config'] as const;
const PROFILE_STATS_QUERY_KEY = ['app', 'profile-stats'] as const;

/**
 * The writer's settings. `offline` is set while the journal is open without a connection (see
 * `useAuthSession`): the app then counts as loaded at once, and looks and reads as it did when the
 * settings were last read on this browser, until the API answers. `pageLanguage` is the language the
 * path of a localized public page asks for (`/fr/…`), which that page is read in by writers and visitors alike.
 */
export const useConfig = (isAuthenticated: boolean, offline = false, pageLanguage: Language | null = null) => {
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

  const visitor = useVisitorPreferences(pageLanguage);
  // A writer's pages follow their settings (English and dark until they load); a visitor's follow the
  // browser's language and the system theme, or what they picked with the switch on the public pages.
  // A localized public page is read in its path's language either way.
  const language: Language = pageLanguage ?? (isAuthenticated ? resolveLanguage(config.language) : visitor.language);
  // Where the English address of a localized public page sends the reader (also every other language's):
  // a writer's saved language once read, a visitor's pick or browser language
  let preferredLanguage: Language | null = visitor.preferredLanguage;
  if (isAuthenticated) preferredLanguage = configLoaded ? resolveLanguage(config.language) : null;
  const accountTheme: Theme = config.theme === 'light' ? 'light' : 'dark';
  const theme = isAuthenticated ? accountTheme : visitor.theme;

  useEffect(() => {
    document.body.classList.toggle('light-mode', theme === 'light');
    document.body.classList.toggle('dark-mode', theme !== 'light');
    document.body.classList.toggle('high-contrast-mode', config.highContrast === true || config.highContrast === 'true');
  }, [config.highContrast, theme]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback((key: string, params: Record<string, string | number> = {}): string => {
    return getTranslation(language, key, params);
  }, [language]);

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
    /** The language and theme the pages show in, for a writer or a visitor. */
    display: { language, theme },
    preferredLanguage,
    visitor,
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
