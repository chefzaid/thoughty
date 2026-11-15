import type { FeatureFlagsService } from '@/common/feature-flags';

/**
 * While the `publicSharing` flag is off, no entry becomes public: making one public (a new public entry,
 * a private one changed to public) is refused with `503 FEATURE_DISABLED`. An entry that is already
 * public keeps its visibility, and can be saved as it is or made private.
 */
export async function assertMayPublish(
  featureFlags: FeatureFlagsService,
  visibility: string | undefined,
  currentVisibility?: string,
): Promise<void> {
  if (visibility === 'public' && currentVisibility !== 'public') {
    await featureFlags.assertEnabled('publicSharing');
  }
}
