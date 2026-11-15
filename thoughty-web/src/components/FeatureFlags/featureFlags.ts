import { createContext, useContext } from 'react';
import type { FeatureFlags } from '../../services/api/configService';

/** The features a runtime flag can switch off; GET /api/config/feature-flags answers each. */
export type FeatureName = 'ai' | 'bookConverter' | 'cloudSync' | 'publicSharing';

/**
 * What the API documents for a flag it does not name: on. The app uses these while the flags load and when
 * they cannot be read, so a slow or failed request never hides a feature that is on.
 */
export const FEATURE_FLAG_DEFAULTS: Readonly<Record<FeatureName, boolean>> = {
  ai: true,
  bookConverter: true,
  cloudSync: true,
  publicSharing: true,
};

/** The flags as the API last answered them (empty before it has, or outside the signed-in app). */
export const FeatureFlagsContext = createContext<FeatureFlags>({});

/**
 * Whether a feature is on. Hiding a switched-off feature is only for the writer's sake: the API refuses its
 * routes itself (503 `FEATURE_DISABLED`).
 */
export function useFeatureFlag(name: FeatureName): boolean {
  const flags = useContext(FeatureFlagsContext);
  return flags[name] ?? FEATURE_FLAG_DEFAULTS[name];
}
