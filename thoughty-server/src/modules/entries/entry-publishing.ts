import { ConflictException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { isEntryLocked, type EntryLockFlags } from '@/common/content-lock';
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

/** A locked entry (or one in a locked diary) stays private: making it public is refused (409). */
export function assertStaysPrivateWhileLocked(entry: Omit<EntryLockFlags, 'userId'>, visibility: string | undefined): void {
  if (visibility === 'public' && isEntryLocked(entry)) {
    throw apiError(ConflictException, 'CONTENT_LOCKED_PRIVATE');
  }
}
