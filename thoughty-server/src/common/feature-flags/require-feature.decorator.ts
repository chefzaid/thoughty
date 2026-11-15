import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import type { FeatureFlag } from './feature-flags.service';

export const REQUIRED_FEATURE_KEY = 'requiredFeature';

/**
 * Refuses the route (or every route of the controller) with `503 FEATURE_DISABLED` while the feature's
 * runtime flag is off. `FeatureFlagGuard`, a global guard after authentication, does the check, so a
 * caller without a session still gets `401`.
 */
export const RequireFeature = (flag: FeatureFlag) =>
  applyDecorators(
    SetMetadata(REQUIRED_FEATURE_KEY, flag),
    ApiResponse({ status: 503, description: `FEATURE_DISABLED: the \`${flag}\` feature is turned off on this server` }),
  );
