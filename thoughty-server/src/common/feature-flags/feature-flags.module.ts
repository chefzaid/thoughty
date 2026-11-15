import { Global, Module } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';

/** One `FeatureFlagsService` (and so one provider cache) for the whole API or worker process. */
@Global()
@Module({
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
