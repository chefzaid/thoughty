import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagsService, type FeatureFlag } from './feature-flags.service';
import { REQUIRED_FEATURE_KEY } from './require-feature.decorator';

/** Lets a `@RequireFeature(flag)` route through only while its feature is on. */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const flag = this.reflector.getAllAndOverride<FeatureFlag | undefined>(REQUIRED_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (flag) {
      await this.featureFlags.assertEnabled(flag);
    }
    return true;
  }
}
