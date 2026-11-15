import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../contexts/AuthContext';
import { useApiServices } from '../../hooks/useApiServices';
import { FeatureFlagsContext } from './featureFlags';

export const FEATURE_FLAGS_QUERY_KEY = ['app', 'feature-flags'] as const;

/** The server keeps a provider's flags for a minute, so asking more often would show nothing newer. */
export const FEATURE_FLAGS_STALE_TIME_MS = 60_000;

/**
 * Loads the runtime feature flags once for the signed-in app, again when the window regains focus after a
 * minute, and gives them to `useFeatureFlag`. A failed request keeps the flags last read, or the API's
 * defaults (every feature on) before any.
 */
export function FeatureFlagsProvider({ children }: { readonly children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { configService } = useApiServices();
  const { data } = useQuery({
    queryKey: FEATURE_FLAGS_QUERY_KEY,
    queryFn: async () => {
      const flags = await configService.fetchFeatureFlags();
      if (!flags) {
        throw new Error('featureFlagsLoadFailed');
      }
      return flags;
    },
    enabled: isAuthenticated,
    staleTime: FEATURE_FLAGS_STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });

  return <FeatureFlagsContext.Provider value={data ?? {}}>{children}</FeatureFlagsContext.Provider>;
}
