import type { ReactNode } from 'react';
import { FeatureFlagsContext } from '../components/FeatureFlags/featureFlags';
import type { FeatureFlags } from '../services/api/configService';

/** A `render` wrapper giving the app these runtime feature flags, as the signed-in app does once they load. */
export function withFeatureFlags(flags: FeatureFlags) {
  return function FeatureFlagsWrapper({ children }: Readonly<{ children: ReactNode }>) {
    return <FeatureFlagsContext.Provider value={flags}>{children}</FeatureFlagsContext.Provider>;
  };
}
