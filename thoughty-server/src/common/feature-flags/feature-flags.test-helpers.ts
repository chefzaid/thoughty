import type { ConfigService } from '@nestjs/config';
import { FeatureFlagsService, type FeatureFlag } from './feature-flags.service';

/** A real `FeatureFlagsService` with no provider: every feature on, except those given as false. */
export function featureFlagsWith(flags: Partial<Record<FeatureFlag, boolean>> = {}): FeatureFlagsService {
  const inline = Object.entries(flags).map(([flag, on]) => `${flag}=${on}`).join(',');
  const config = { get: (key: string) => (key === 'FEATURE_FLAGS' ? inline : undefined) };
  return new FeatureFlagsService(config as unknown as ConfigService);
}
